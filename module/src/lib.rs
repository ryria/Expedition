use serde::Deserialize;
use spacetimedb::{ProcedureContext, ReducerContext, Table, Timestamp};

const STDB_AUTH_ISSUER: &str = "https://auth.spacetimedb.com/oidc";
const CONFIG_OWNER_SUB_KEY: &str = "_config_owner_sub";
const STRAVA_CLIENT_ID_KEY: &str = "strava_client_id";
const STRAVA_CLIENT_SECRET_KEY: &str = "strava_client_secret";
const STRAVA_OAUTH_TOKEN: &str = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_ENDPOINT: &str = "https://www.strava.com/api/v3/athlete/activities";
const STRAVA_OVERALL_LIMIT_15M: u32 = 200;
const STRAVA_OVERALL_LIMIT_DAY: u32 = 2000;
const STRAVA_READ_LIMIT_15M: u32 = 100;
const STRAVA_READ_LIMIT_DAY: u32 = 1000;
const STRAVA_WINDOW_15M_SECONDS: i64 = 15 * 60;
const STRAVA_WINDOW_DAY_SECONDS: i64 = 24 * 60 * 60;
const STRAVA_RATE_LIMIT_KEY: u8 = 1;
const DEFAULT_AI_COACHING_FALLBACK: &str =
    "Keep it up! Every step counts toward the 14,500 km goal!";

fn window_start(epoch_seconds: i64, window_seconds: i64) -> i64 {
    epoch_seconds - (epoch_seconds % window_seconds)
}

fn consume_strava_quota(
    ctx: &mut ProcedureContext,
    read_cost: u32,
    overall_cost: u32,
) -> Result<(), String> {
    let now_epoch = (ctx.timestamp.to_micros_since_unix_epoch() / 1_000_000) as i64;
    let now_15m = window_start(now_epoch, STRAVA_WINDOW_15M_SECONDS);
    let now_day = window_start(now_epoch, STRAVA_WINDOW_DAY_SECONDS);
    let now_ts = ctx.timestamp;

    ctx.with_tx(|tx| {
        let mut state = tx
            .db
            .strava_rate_limit_state()
            .key()
            .find(STRAVA_RATE_LIMIT_KEY)
            .unwrap_or(StravaRateLimitState {
                key: STRAVA_RATE_LIMIT_KEY,
                window_15m_start_epoch: now_15m,
                overall_count_15m: 0,
                read_count_15m: 0,
                window_day_start_epoch: now_day,
                overall_count_day: 0,
                read_count_day: 0,
                updated_at: now_ts,
            });

        if state.window_15m_start_epoch != now_15m {
            state.window_15m_start_epoch = now_15m;
            state.overall_count_15m = 0;
            state.read_count_15m = 0;
        }

        if state.window_day_start_epoch != now_day {
            state.window_day_start_epoch = now_day;
            state.overall_count_day = 0;
            state.read_count_day = 0;
        }

        let projected_overall_15m = state.overall_count_15m.saturating_add(overall_cost);
        let projected_read_15m = state.read_count_15m.saturating_add(read_cost);
        let projected_overall_day = state.overall_count_day.saturating_add(overall_cost);
        let projected_read_day = state.read_count_day.saturating_add(read_cost);

        if projected_overall_15m > STRAVA_OVERALL_LIMIT_15M {
            return Err(format!(
                "Strava overall 15-minute quota reached ({}/{})",
                state.overall_count_15m, STRAVA_OVERALL_LIMIT_15M
            ));
        }
        if projected_read_15m > STRAVA_READ_LIMIT_15M {
            return Err(format!(
                "Strava read 15-minute quota reached ({}/{})",
                state.read_count_15m, STRAVA_READ_LIMIT_15M
            ));
        }
        if projected_overall_day > STRAVA_OVERALL_LIMIT_DAY {
            return Err(format!(
                "Strava overall daily quota reached ({}/{})",
                state.overall_count_day, STRAVA_OVERALL_LIMIT_DAY
            ));
        }
        if projected_read_day > STRAVA_READ_LIMIT_DAY {
            return Err(format!(
                "Strava read daily quota reached ({}/{})",
                state.read_count_day, STRAVA_READ_LIMIT_DAY
            ));
        }

        state.overall_count_15m = projected_overall_15m;
        state.read_count_15m = projected_read_15m;
        state.overall_count_day = projected_overall_day;
        state.read_count_day = projected_read_day;
        state.updated_at = now_ts;

        if tx
            .db
            .strava_rate_limit_state()
            .key()
            .find(STRAVA_RATE_LIMIT_KEY)
            .is_some()
        {
            tx.db.strava_rate_limit_state().key().update(state);
        } else {
            tx.db.strava_rate_limit_state().insert(state);
        }

        Ok(())
    })
}

fn authenticated_subject_from_procedure(ctx: &mut ProcedureContext) -> Result<String, String> {
    if ctx.sender() == ctx.identity() {
        return config_value(ctx, CONFIG_OWNER_SUB_KEY)
            .ok_or("Config owner not set for internal procedure call".to_string());
    }

    let sender_identity = ctx.sender().to_string();
    ctx.with_tx(|tx| {
        tx.db
            .auth_binding()
            .sender_identity()
            .find(sender_identity.clone())
            .map(|binding| binding.owner_sub)
    })
    .ok_or("Authentication binding missing. Re-open Settings and click Connect Strava again (or save profile once).".to_string())
}

fn config_value(ctx: &mut ProcedureContext, key: &str) -> Option<String> {
    ctx.with_tx(|tx| {
        tx.db
            .config()
            .key()
            .find(key.to_string())
            .map(|row| row.value)
    })
}

fn url_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

fn map_strava_activity_type(strava_type: &str) -> Option<&'static str> {
    match strava_type {
        "Run" | "TrailRun" | "VirtualRun" => Some("run"),
        "Walk" | "Hike" => Some("walk"),
        "Ride" | "VirtualRide" | "EBikeRide" | "MountainBikeRide" | "GravelRide" => {
            Some("cycle")
        }
        "Rowing" => Some("row"),
        _ => None,
    }
}

fn strava_token_request(
    ctx: &mut ProcedureContext,
    body: String,
) -> Result<StravaTokenResponse, String> {
    consume_strava_quota(ctx, 0, 1)?;

    let request = http::Request::builder()
        .method("POST")
        .uri(STRAVA_OAUTH_TOKEN)
        .header("content-type", "application/x-www-form-urlencoded")
        .body(body)
        .map_err(|err| format!("Failed to build Strava token request: {}", err))?;

    let response = ctx
        .http
        .send(request)
        .map_err(|err| format!("Strava token request failed: {}", err))?;

    let (parts, body) = response.into_parts();
    let body_str = body.into_string_lossy();
    if !parts.status.is_success() {
        return Err(format!(
            "Strava token request failed with status {}: {}",
            parts.status, body_str
        ));
    }

    serde_json::from_str::<StravaTokenResponse>(&body_str)
        .map_err(|err| format!("Invalid Strava token response JSON: {}", err))
}

fn refresh_strava_token(
    ctx: &mut ProcedureContext,
    connection: &StravaConnection,
    client_id: &str,
    client_secret: &str,
) -> Result<StravaTokenResponse, String> {
    let body = format!(
        "client_id={}&client_secret={}&grant_type=refresh_token&refresh_token={}",
        url_encode(client_id),
        url_encode(client_secret),
        url_encode(&connection.refresh_token),
    );

    strava_token_request(ctx, body)
}

fn upsert_strava_connection(
    ctx: &mut ProcedureContext,
    owner_sub: &str,
    member_id: u64,
    token: &StravaTokenResponse,
) {
    let now_ts = ctx.timestamp;
    ctx.with_tx(|tx| {
        if let Some(mut row) = tx.db.strava_connection().owner_sub().find(owner_sub.to_string()) {
            row.member_id = member_id;
            row.athlete_id = token.athlete.id;
            row.access_token = token.access_token.clone();
            row.refresh_token = token.refresh_token.clone();
            row.expires_at_epoch = token.expires_at;
            row.updated_at = now_ts;
            tx.db.strava_connection().owner_sub().update(row);
        } else {
            tx.db.strava_connection().insert(StravaConnection {
                owner_sub: owner_sub.to_string(),
                member_id,
                athlete_id: token.athlete.id,
                access_token: token.access_token.clone(),
                refresh_token: token.refresh_token.clone(),
                expires_at_epoch: token.expires_at,
                last_synced_epoch: 0,
                created_at: now_ts,
                updated_at: now_ts,
            });
        }
    });
}

fn import_strava_activities_for_owner(
    ctx: &mut ProcedureContext,
    owner_sub: &str,
    member: &Member,
    mut connection: StravaConnection,
    client_id: &str,
    client_secret: &str,
) -> Result<u64, String> {
    let now_epoch = (ctx.timestamp.to_micros_since_unix_epoch() / 1_000_000) as i64;
    let now_ts = ctx.timestamp;

    if connection.expires_at_epoch <= now_epoch + 30 {
        let refreshed = refresh_strava_token(ctx, &connection, client_id, client_secret)?;
        upsert_strava_connection(ctx, owner_sub, member.id, &refreshed);
        connection.access_token = refreshed.access_token;
        connection.refresh_token = refreshed.refresh_token;
        connection.expires_at_epoch = refreshed.expires_at;
    }

    let activities_uri = format!(
        "{}?per_page=200&after={}",
        STRAVA_ACTIVITIES_ENDPOINT,
        connection.last_synced_epoch.max(0)
    );

    consume_strava_quota(ctx, 1, 1)?;

    let request = http::Request::builder()
        .method("GET")
        .uri(activities_uri)
        .header("authorization", format!("Bearer {}", connection.access_token))
        .body(String::new())
        .map_err(|err| format!("Failed to build Strava activities request: {}", err))?;

    let response = ctx
        .http
        .send(request)
        .map_err(|err| format!("Strava activities request failed: {}", err))?;

    let (parts, body) = response.into_parts();
    let body_str = body.into_string_lossy();
    if !parts.status.is_success() {
        return Err(format!(
            "Strava activities fetch failed with status {}: {}",
            parts.status, body_str
        ));
    }

    let activities = serde_json::from_str::<Vec<StravaActivity>>(&body_str)
        .map_err(|err| format!("Invalid Strava activities response JSON: {}", err))?;

    let had_any_activities = !activities.is_empty();
    let mut imported_count = 0u64;
    let mut max_seen_epoch = connection.last_synced_epoch;

    for activity in activities {
        let Some(mapped_type) = map_strava_activity_type(&activity.activity_type) else {
            continue;
        };

        let distance_km = activity.distance / 1000.0;
        if distance_km <= 0.0 || distance_km > 500.0 {
            continue;
        }

        let inserted = ctx.with_tx(|tx| {
            if tx
                .db
                .imported_strava_activity()
                .strava_activity_id()
                .find(activity.id)
                .is_some()
            {
                return false;
            }

            tx.db.imported_strava_activity().insert(ImportedStravaActivity {
                strava_activity_id: activity.id,
                owner_sub: owner_sub.to_string(),
                imported_at: now_ts,
            });

            let note_suffix = if activity.name.trim().is_empty() {
                String::new()
            } else {
                format!(" ({})", activity.name.trim())
            };

            tx.db.activity_log().insert(ActivityLog {
                id: 0,
                member_id: member.id,
                person_name: member.name.clone(),
                activity_type: mapped_type.to_string(),
                distance_km,
                note: format!("Imported from Strava{}", note_suffix),
                timestamp: now_ts,
                ai_response: String::new(),
            });
            true
        });

        if inserted {
            imported_count += 1;
        }

    }

    if had_any_activities && max_seen_epoch < now_epoch {
        max_seen_epoch = now_epoch;
    }

    ctx.with_tx(|tx| {
        if let Some(mut updated) = tx.db.strava_connection().owner_sub().find(owner_sub.to_string()) {
            updated.last_synced_epoch = max_seen_epoch;
            updated.updated_at = now_ts;
            tx.db.strava_connection().owner_sub().update(updated);
        }
    });

    Ok(imported_count)
}

fn authenticated_subject(ctx: &ReducerContext) -> Result<String, String> {
    let jwt = ctx
        .sender_auth()
        .jwt()
        .ok_or("Authentication required".to_string())?;

    if jwt.issuer() != STDB_AUTH_ISSUER {
        return Err("Invalid token issuer".to_string());
    }

    Ok(jwt.subject().to_string())
}

fn is_valid_slug(slug: &str) -> bool {
    if slug.is_empty() {
        return false;
    }

    slug.chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

fn upsert_auth_binding(ctx: &ReducerContext, owner_sub: &str) {
    let sender_identity = ctx.sender().to_string();
    if let Some(mut existing) = ctx
        .db
        .auth_binding()
        .sender_identity()
        .find(sender_identity.clone())
    {
        existing.owner_sub = owner_sub.to_string();
        existing.updated_at = ctx.timestamp;
        ctx.db.auth_binding().sender_identity().update(existing);
    } else {
        ctx.db.auth_binding().insert(AuthBinding {
            sender_identity,
            owner_sub: owner_sub.to_string(),
            updated_at: ctx.timestamp,
        });
    }
}

// ─── Lifecycle reducers ───────────────────────────────────────────────────────

#[spacetimedb::reducer(init)]
pub fn init(_ctx: &ReducerContext) {}

#[spacetimedb::reducer(client_connected)]
pub fn identity_connected(_ctx: &ReducerContext) {}

#[spacetimedb::reducer(client_disconnected)]
pub fn identity_disconnected(_ctx: &ReducerContext) {}

// ─── Config ───────────────────────────────────────────────────────────────────
// Stores runtime configuration (e.g. Claude API key set via set_config reducer).

#[spacetimedb::table(accessor = config)]
pub struct Config {
    #[primary_key]
    pub key: String,
    pub value: String,
}

#[spacetimedb::table(accessor = auth_binding)]
pub struct AuthBinding {
    #[primary_key]
    pub sender_identity: String,
    pub owner_sub: String,
    pub updated_at: Timestamp,
}

#[spacetimedb::reducer]
pub fn set_config(ctx: &ReducerContext, key: String, value: String) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("set_config: {}", err);
            return;
        }
    };

    let key = key.trim().to_string();
    if key.is_empty() {
        log::error!("set_config: key cannot be empty");
        return;
    }

    if key == CONFIG_OWNER_SUB_KEY {
        log::error!("set_config: key is reserved");
        return;
    }

    let owner_key = CONFIG_OWNER_SUB_KEY.to_string();
    if let Some(owner) = ctx.db.config().key().find(owner_key.clone()) {
        if owner.value != owner_sub {
            log::error!("set_config: only config owner may update configuration");
            return;
        }
    } else {
        ctx.db.config().insert(Config {
            key: owner_key,
            value: owner_sub,
        });
    }

    if ctx.db.config().key().find(key.clone()).is_some() {
        ctx.db.config().key().update(Config {
            key,
            value,
        });
    } else {
        ctx.db.config().insert(Config { key, value });
    }
}

#[spacetimedb::table(accessor = strava_connection)]
pub struct StravaConnection {
    #[primary_key]
    pub owner_sub: String,
    pub member_id: u64,
    pub athlete_id: u64,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at_epoch: i64,
    pub last_synced_epoch: i64,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

#[spacetimedb::table(accessor = imported_strava_activity)]
pub struct ImportedStravaActivity {
    #[primary_key]
    pub strava_activity_id: u64,
    pub owner_sub: String,
    pub imported_at: Timestamp,
}

#[spacetimedb::table(accessor = strava_rate_limit_state)]
pub struct StravaRateLimitState {
    #[primary_key]
    pub key: u8,
    pub window_15m_start_epoch: i64,
    pub overall_count_15m: u32,
    pub read_count_15m: u32,
    pub window_day_start_epoch: i64,
    pub overall_count_day: u32,
    pub read_count_day: u32,
    pub updated_at: Timestamp,
}

// ─── Member ───────────────────────────────────────────────────────────────────

#[spacetimedb::table(accessor = expedition, public)]
pub struct Expedition {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub name: String,
    #[unique]
    pub slug: String,
    pub created_by_member_id: u64,
    pub is_archived: bool,
    pub created_at: Timestamp,
    pub archived_at: Option<Timestamp>,
}

#[spacetimedb::table(accessor = membership, public)]
pub struct Membership {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub expedition_id: u64,
    pub member_id: u64,
    pub role: String,
    pub status: String,
    pub joined_at: Timestamp,
    pub left_at: Option<Timestamp>,
    #[unique]
    pub expedition_member_key: String,
}

#[spacetimedb::reducer]
pub fn create_expedition(ctx: &ReducerContext, name: String, slug: String) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("create_expedition: {}", err);
            return;
        }
    };

    let Some(me) = ctx.db.member().owner_sub().find(owner_sub) else {
        log::error!("create_expedition: profile not found for authenticated user");
        return;
    };

    let name = name.trim().to_string();
    if name.is_empty() {
        log::error!("create_expedition: name cannot be empty");
        return;
    }

    let slug = slug.trim().to_string();
    if !is_valid_slug(&slug) {
        log::error!(
            "create_expedition: slug must contain only lowercase letters, digits, and hyphens"
        );
        return;
    }

    if ctx.db.expedition().slug().find(slug.clone()).is_some() {
        log::error!("create_expedition: duplicate slug");
        return;
    }

    ctx.db.expedition().insert(Expedition {
        id: 0,
        name,
        slug: slug.clone(),
        created_by_member_id: me.id,
        is_archived: false,
        created_at: ctx.timestamp,
        archived_at: None,
    });

    let Some(expedition) = ctx.db.expedition().slug().find(slug) else {
        log::error!("create_expedition: failed to resolve inserted expedition");
        return;
    };

    let expedition_member_key = format!("{}:{}", expedition.id, me.id);
    if ctx
        .db
        .membership()
        .expedition_member_key()
        .find(expedition_member_key.clone())
        .is_some()
    {
        log::error!("create_expedition: duplicate active membership");
        return;
    }

    ctx.db.membership().insert(Membership {
        id: 0,
        expedition_id: expedition.id,
        member_id: me.id,
        role: "owner".to_string(),
        status: "active".to_string(),
        joined_at: ctx.timestamp,
        left_at: None,
        expedition_member_key,
    });
}

#[spacetimedb::table(accessor = member, public)]
pub struct Member {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub name: String,
    #[unique]
    pub owner_sub: String,
    pub color_hex: String, // e.g. "#8b2020"
    pub created_at: Timestamp,
}

#[spacetimedb::reducer]
pub fn add_member(ctx: &ReducerContext, name: String, color_hex: String) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("add_member: {}", err);
            return;
        }
    };

    let name = name.trim().to_string();
    if name.is_empty() {
        log::error!("add_member: name cannot be empty");
        return;
    }
    if !color_hex.starts_with('#') || color_hex.len() != 7 {
        log::error!("add_member: invalid colour hex: {}", color_hex);
        return;
    }

    if let Some(existing_with_name) = ctx.db.member().name().find(name.clone()) {
        if existing_with_name.owner_sub != owner_sub {
            log::error!("add_member: name already taken");
            return;
        }
    }

    if let Some(mut me) = ctx.db.member().owner_sub().find(owner_sub.clone()) {
        me.name = name;
        me.color_hex = color_hex;
        ctx.db.member().id().update(me);
        upsert_auth_binding(ctx, &owner_sub);
        return;
    }

    ctx.db.member().insert(Member {
        id: 0,
        name,
        owner_sub,
        color_hex,
        created_at: ctx.timestamp,
    });
    if let Ok(owner_sub) = authenticated_subject(ctx) {
        upsert_auth_binding(ctx, &owner_sub);
    }
}

#[spacetimedb::reducer]
pub fn bind_auth_identity(ctx: &ReducerContext) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("bind_auth_identity: {}", err);
            return;
        }
    };

    if ctx.db.member().owner_sub().find(owner_sub.clone()).is_none() {
        log::error!("bind_auth_identity: member profile missing");
        return;
    }

    upsert_auth_binding(ctx, &owner_sub);
}

#[spacetimedb::reducer]
pub fn remove_member(ctx: &ReducerContext, id: u64) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("remove_member: {}", err);
            return;
        }
    };

    let Some(member) = ctx.db.member().id().find(id) else {
        log::error!("remove_member: member not found");
        return;
    };

    if member.owner_sub != owner_sub {
        log::error!("remove_member: cannot remove another user's profile");
        return;
    }

    ctx.db.member().id().delete(id);
}

// ─── ActivityLog ──────────────────────────────────────────────────────────────

#[spacetimedb::table(accessor = activity_log, public)]
pub struct ActivityLog {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub person_name: String,
    pub activity_type: String, // "run" | "row" | "walk" | "cycle"
    pub distance_km: f64,
    pub note: String,         // empty string if none
    pub timestamp: Timestamp,
    pub ai_response: String,  // empty until request_ai_coaching patches it
    #[default(0u64)]
    pub member_id: u64,
}

#[spacetimedb::reducer]
pub fn log_activity(
    ctx: &ReducerContext,
    member_id: u64,
    activity_type: String,
    distance_km: f64,
    note: String,
) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("log_activity: {}", err);
            return;
        }
    };

    let Some(me) = ctx.db.member().owner_sub().find(owner_sub) else {
        log::error!("log_activity: profile not found for authenticated user");
        return;
    };

    if me.id != member_id {
        log::error!("log_activity: you can only log activity for your own profile");
        return;
    }

    let valid_types = ["run", "row", "walk", "cycle"];
    if !valid_types.contains(&activity_type.as_str()) {
        log::error!("log_activity: invalid activity_type: {}", activity_type);
        return;
    }
    if distance_km <= 0.0 || distance_km > 500.0 {
        log::error!("log_activity: distance_km out of range: {}", distance_km);
        return;
    }
    ctx.db.activity_log().insert(ActivityLog {
        id: 0,
        member_id,
        person_name: me.name,
        activity_type,
        distance_km,
        note: note.trim().to_string(),
        timestamp: ctx.timestamp,
        ai_response: String::new(),
    });
}

// ─── Reaction ─────────────────────────────────────────────────────────────────

#[spacetimedb::table(accessor = reaction, public)]
pub struct Reaction {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub log_id: u64,
    pub emoji: String,
    pub reacted_by: String,
    pub timestamp: Timestamp,
}

#[spacetimedb::reducer]
pub fn add_reaction(
    ctx: &ReducerContext,
    log_id: u64,
    emoji: String,
    _reacted_by: String,
) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("add_reaction: {}", err);
            return;
        }
    };

    let Some(me) = ctx.db.member().owner_sub().find(owner_sub) else {
        log::error!("add_reaction: profile not found for authenticated user");
        return;
    };

    if ctx.db.activity_log().id().find(log_id).is_none() {
        log::error!("add_reaction: activity log not found");
        return;
    }

    let emoji = emoji.trim().to_string();
    if emoji.is_empty() {
        log::error!("add_reaction: emoji required");
        return;
    }

    ctx.db.reaction().insert(Reaction {
        id: 0,
        log_id,
        emoji,
        reacted_by: me.name,
        timestamp: ctx.timestamp,
    });
}

// ─── Comment ──────────────────────────────────────────────────────────────────

#[spacetimedb::table(accessor = comment, public)]
pub struct Comment {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub log_id: u64,
    pub author: String,
    pub body: String,
    pub timestamp: Timestamp,
}

#[spacetimedb::reducer]
pub fn add_comment(
    ctx: &ReducerContext,
    log_id: u64,
    _author: String,
    body: String,
) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("add_comment: {}", err);
            return;
        }
    };

    let Some(me) = ctx.db.member().owner_sub().find(owner_sub) else {
        log::error!("add_comment: profile not found for authenticated user");
        return;
    };

    if ctx.db.activity_log().id().find(log_id).is_none() {
        log::error!("add_comment: activity log not found");
        return;
    }

    let body = body.trim().to_string();
    if body.is_empty() {
        log::error!("add_comment: body cannot be empty");
        return;
    }

    ctx.db.comment().insert(Comment {
        id: 0,
        log_id,
        author: me.name,
        body,
        timestamp: ctx.timestamp,
    });
}

// ─── AI Coaching Procedure ────────────────────────────────────────────────────
// Calls the Claude API and patches ai_response on an ActivityLog row.
// Requires "claude_api_key" to be set via set_config reducer first.
// Procedures must not hold a transaction open during HTTP calls.

#[spacetimedb::procedure]
pub fn request_ai_coaching(ctx: &mut ProcedureContext, log_id: u64) {
    // Step 1: Read data inside a short transaction.
    let maybe = ctx.with_tx(|tx| {
        let log = tx.db.activity_log().id().find(log_id)?;
        let cfg = tx.db.config().key().find("claude_api_key".to_string())?;
        Some((log, cfg.value.clone()))
    });

    let (log, api_key) = match maybe {
        Some(pair) => pair,
        None => {
            log::error!("request_ai_coaching: log {} not found or claude_api_key not set", log_id);
            return;
        }
    };

    // Step 2: Build the Claude API request (outside any transaction).
    let note_part = if log.note.is_empty() {
        String::new()
    } else {
        format!(
            " with note: \"{}\"",
            log.note.replace('\\', "\\\\").replace('"', "\\\"")
        )
    };

    let prompt = format!(
        "You are an encouraging AI coach for The Expedition — three friends cycling, running, \
         rowing, and walking 14,500 km around Australia. \
         {} just logged a {} of {:.1} km{}. \
         Give a short (2-3 sentence) motivational response.",
        log.person_name, log.activity_type, log.distance_km, note_part
    );

    let body = format!(
        "{{\"model\":\"claude-sonnet-4-5\",\"max_tokens\":256,\
          \"messages\":[{{\"role\":\"user\",\"content\":\"{}\"}}]}}",
        prompt
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
    );

    let request = http::Request::builder()
        .method("POST")
        .uri("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key.as_str())
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .body(body)
        .expect("Failed to build HTTP request");

    // Step 3: Send HTTP request.
    match ctx.http.send(request) {
        Ok(response) => {
            let (parts, body) = response.into_parts();
            if !parts.status.is_success() {
                log::error!(
                    "request_ai_coaching: Claude API returned status {}",
                    parts.status
                );
                return;
            }
            let body_str = body.into_string_lossy();
            let ai_text = extract_claude_text(&body_str);

            // Step 4: Write result inside a new transaction.
            ctx.with_tx(|tx| {
                if let Some(mut updated) = tx.db.activity_log().id().find(log_id) {
                    updated.ai_response = ai_text.clone();
                    tx.db.activity_log().id().update(updated);
                }
            });
        }
        Err(e) => {
            log::error!("request_ai_coaching: HTTP fetch failed: {}", e);
        }
    }
}

#[spacetimedb::procedure]
pub fn link_strava_account(ctx: &mut ProcedureContext, code: String, redirect_uri: String) {
    let owner_sub = match authenticated_subject_from_procedure(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("link_strava_account: {}", err);
            return;
        }
    };

    let (member, client_id, client_secret) = match ctx.with_tx(|tx| {
        let member = tx.db.member().owner_sub().find(owner_sub.clone())?;
        let client_id = tx.db.config().key().find(STRAVA_CLIENT_ID_KEY.to_string())?.value;
        let client_secret = tx
            .db
            .config()
            .key()
            .find(STRAVA_CLIENT_SECRET_KEY.to_string())?
            .value;
        Some((member, client_id, client_secret))
    }) {
        Some(tuple) => tuple,
        None => {
            log::error!(
                "link_strava_account: member profile missing or Strava config keys not set"
            );
            return;
        }
    };

    let body = format!(
        "client_id={}&client_secret={}&code={}&grant_type=authorization_code&redirect_uri={}",
        url_encode(&client_id),
        url_encode(&client_secret),
        url_encode(code.trim()),
        url_encode(redirect_uri.trim()),
    );

    let token_response = match strava_token_request(ctx, body) {
        Ok(response) => response,
        Err(err) => {
            log::error!("link_strava_account: {}", err);
            return;
        }
    };

    upsert_strava_connection(ctx, &owner_sub, member.id, &token_response);
}

#[spacetimedb::procedure]
pub fn set_my_strava_tokens(
    ctx: &mut ProcedureContext,
    access_token: String,
    refresh_token: String,
) {
    let owner_sub = match authenticated_subject_from_procedure(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("set_my_strava_tokens: {}", err);
            return;
        }
    };

    let Some(member) = ctx.with_tx(|tx| tx.db.member().owner_sub().find(owner_sub.clone())) else {
        log::error!("set_my_strava_tokens: member profile missing");
        return;
    };

    let token = StravaTokenResponse {
        access_token: access_token.trim().to_string(),
        refresh_token: refresh_token.trim().to_string(),
        expires_at: 0,
        athlete: StravaAthlete { id: 0 },
    };

    if token.access_token.is_empty() || token.refresh_token.is_empty() {
        log::error!("set_my_strava_tokens: tokens cannot be empty");
        return;
    }

    upsert_strava_connection(ctx, &owner_sub, member.id, &token);
}

#[spacetimedb::procedure]
pub fn sync_my_strava_activities(ctx: &mut ProcedureContext) {
    let owner_sub = match authenticated_subject_from_procedure(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("sync_my_strava_activities: {}", err);
            return;
        }
    };

    let Some(member) = ctx.with_tx(|tx| tx.db.member().owner_sub().find(owner_sub.clone())) else {
        log::error!("sync_my_strava_activities: member profile missing");
        return;
    };

    let Some(connection) = ctx.with_tx(|tx| tx.db.strava_connection().owner_sub().find(owner_sub.clone())) else {
        log::error!("sync_my_strava_activities: no linked Strava account");
        return;
    };

    let Some(client_id) = config_value(ctx, STRAVA_CLIENT_ID_KEY) else {
        log::error!("sync_my_strava_activities: strava_client_id missing");
        return;
    };
    let Some(client_secret) = config_value(ctx, STRAVA_CLIENT_SECRET_KEY) else {
        log::error!("sync_my_strava_activities: strava_client_secret missing");
        return;
    };

    match import_strava_activities_for_owner(
        ctx,
        &owner_sub,
        &member,
        connection,
        &client_id,
        &client_secret,
    ) {
        Ok(imported) => log::info!("sync_my_strava_activities: imported {} activities", imported),
        Err(err) => log::error!("sync_my_strava_activities: {}", err),
    }
}

#[spacetimedb::procedure]
pub fn sync_all_strava_activities(ctx: &mut ProcedureContext) {
    let caller_sub = match authenticated_subject_from_procedure(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("sync_all_strava_activities: {}", err);
            return;
        }
    };

    let owner_sub = match config_value(ctx, CONFIG_OWNER_SUB_KEY) {
        Some(value) => value,
        None => {
            log::error!("sync_all_strava_activities: config owner not set");
            return;
        }
    };

    if caller_sub != owner_sub {
        log::error!("sync_all_strava_activities: only config owner can run global sync");
        return;
    }

    let Some(client_id) = config_value(ctx, STRAVA_CLIENT_ID_KEY) else {
        log::error!("sync_all_strava_activities: strava_client_id missing");
        return;
    };
    let Some(client_secret) = config_value(ctx, STRAVA_CLIENT_SECRET_KEY) else {
        log::error!("sync_all_strava_activities: strava_client_secret missing");
        return;
    };

    let rows = ctx.with_tx(|tx| {
        tx.db
            .strava_connection()
            .iter()
            .filter_map(|conn| {
                tx.db
                    .member()
                    .id()
                    .find(conn.member_id)
                    .map(|member| (conn.owner_sub.clone(), member, conn))
            })
            .collect::<Vec<(String, Member, StravaConnection)>>()
    });

    for (linked_owner_sub, member, connection) in rows {
        if let Err(err) = import_strava_activities_for_owner(
            ctx,
            &linked_owner_sub,
            &member,
            connection,
            &client_id,
            &client_secret,
        ) {
            if err.contains("quota reached") {
                log::error!("sync_all_strava_activities: stopping early due to quota: {}", err);
                break;
            }
            log::error!(
                "sync_all_strava_activities: owner_sub={} failed: {}",
                linked_owner_sub,
                err
            );
        }
    }
}

/// Extract the text content from a Claude API response body.
/// Response shape: `{"content":[{"type":"text","text":"..."}],...}`
fn extract_claude_text(body: &str) -> String {
    let parsed: Result<ClaudeApiResponse, serde_json::Error> = serde_json::from_str(body);
    if let Ok(response) = parsed {
        for block in response.content {
            if block.kind == "text" {
                let text = block.text.trim();
                if !text.is_empty() {
                    return text.to_string();
                }
            }
        }
    }

    DEFAULT_AI_COACHING_FALLBACK.to_string()
}

#[derive(Deserialize)]
struct ClaudeApiResponse {
    #[serde(default)]
    content: Vec<ClaudeApiContentBlock>,
}

#[derive(Deserialize)]
struct ClaudeApiContentBlock {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
struct StravaAthlete {
    id: u64,
}

#[derive(Deserialize)]
struct StravaTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_at: i64,
    athlete: StravaAthlete,
}

#[derive(Deserialize)]
struct StravaActivity {
    id: u64,
    name: String,
    #[serde(rename = "type")]
    activity_type: String,
    #[serde(rename = "distance")]
    distance: f64,
}
