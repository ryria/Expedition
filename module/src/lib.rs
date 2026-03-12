use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::Sha256;
use spacetimedb::{ProcedureContext, ReducerContext, ScheduleAt, Table, Timestamp};
use std::time::Duration;

const STDB_AUTH_ISSUER: &str = "https://auth.spacetimedb.com/oidc";
const CONFIG_OWNER_SUB_KEY: &str = "_config_owner_sub";
const STRAVA_CLIENT_ID_KEY: &str = "strava_client_id";
const STRAVA_CLIENT_SECRET_KEY: &str = "strava_client_secret";
const STRIPE_SECRET_KEY: &str = "stripe_secret_key";
const STRIPE_PRICE_ID_KEY: &str = "stripe_price_id";
const STRIPE_SUCCESS_URL_KEY: &str = "stripe_success_url";
const STRIPE_CANCEL_URL_KEY: &str = "stripe_cancel_url";
const STRIPE_WEBHOOK_SECRET_KEY: &str = "stripe_webhook_secret";
const STRAVA_OAUTH_TOKEN: &str = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_ENDPOINT: &str = "https://www.strava.com/api/v3/athlete/activities";
const STRIPE_CHECKOUT_SESSIONS_ENDPOINT: &str = "https://api.stripe.com/v1/checkout/sessions";
const STRAVA_OVERALL_LIMIT_15M: u32 = 200;
const STRAVA_OVERALL_LIMIT_DAY: u32 = 2000;
const STRAVA_READ_LIMIT_15M: u32 = 100;
const STRAVA_READ_LIMIT_DAY: u32 = 1000;
const STRAVA_WINDOW_15M_SECONDS: i64 = 15 * 60;
const STRAVA_WINDOW_DAY_SECONDS: i64 = 24 * 60 * 60;
const STRAVA_RATE_LIMIT_KEY: u8 = 1;
const DEFAULT_AI_COACHING_FALLBACK: &str =
    "Keep it up! Every step counts toward the 14,500 km goal!";
const LEGACY_DEFAULT_EXPEDITION_NAME: &str = "Legacy Expedition";
const LEGACY_DEFAULT_EXPEDITION_SLUG: &str = "legacy-default";
const MEMBERSHIP_ROLE_OWNER: &str = "owner";
const MEMBERSHIP_ROLE_ADMIN: &str = "admin";
const MEMBERSHIP_ROLE_MEMBER: &str = "member";
const SUBSCRIPTION_STATUS_TRIALING: &str = "trialing";
const SUBSCRIPTION_STATUS_ACTIVE: &str = "active";
const SUBSCRIPTION_STATUS_PAST_DUE: &str = "past_due";
const SUBSCRIPTION_STATUS_CANCELED: &str = "canceled";
const SUBSCRIPTION_STATUS_INCOMPLETE: &str = "incomplete";
const ENTITLEMENT_KEY_MAX_MEMBERS: &str = "max_members";
const FREE_PLAN_MAX_MEMBERS: u32 = 5;
const NOTIFICATION_EVENT_INVITE_CREATED: &str = "invite_created";
const NOTIFICATION_EVENT_INVITE_ACCEPTED: &str = "invite_accepted";
const NOTIFICATION_EVENT_INVITE_REVOKED: &str = "invite_revoked";
const NOTIFICATION_EVENT_ROLE_CHANGED: &str = "membership_role_changed";
const NOTIFICATION_EVENT_OWNERSHIP_TRANSFERRED: &str = "ownership_transferred";
const NOTIFICATION_EVENT_COMMENT_ADDED: &str = "comment_added";
const NOTIFICATION_EVENT_REACTION_ADDED: &str = "reaction_added";
const NOTIFICATION_EVENT_ACTIVITY_MILESTONE: &str = "activity_milestone";
const ABUSE_TARGET_ACTIVITY_LOG: &str = "activity_log";
const ABUSE_TARGET_COMMENT: &str = "comment";
const ABUSE_STATUS_OPEN: &str = "open";
const ABUSE_STATUS_REVIEWED: &str = "reviewed";
const MODERATION_ACTION_DISMISS: &str = "dismiss";
const MODERATION_ACTION_HIDE: &str = "hide";
const MODERATION_ACTION_REMOVE: &str = "remove";
const EXPEDITION_VISIBILITY_PUBLIC: &str = "public";
const EXPEDITION_VISIBILITY_INVITE_ONLY: &str = "invite_only";
const ROUTE_TEMPLATE_CLASSIC_TRAIL: &str = "classic_trail";
const ROUTE_TEMPLATE_MOUNTAIN_PASS: &str = "mountain_pass";
const ROUTE_TEMPLATE_COASTLINE: &str = "coastline";
const PRODUCT_EVENT_NAME_MAX_LEN: usize = 80;
const PRODUCT_EVENT_PAYLOAD_MAX_LEN: usize = 4096;
const OPERATION_STATUS_SUCCESS: &str = "success";
const OPERATION_STATUS_FAILURE: &str = "failure";
const CHALLENGE_STATUS_SCHEDULED: &str = "scheduled";
const CHALLENGE_STATUS_ACTIVE: &str = "active";
const CHALLENGE_STATUS_CLOSED: &str = "closed";
const CHALLENGE_ACTIVITY_STATUS_ACCEPTED: &str = "accepted";
const CHALLENGE_ACTIVITY_STATUS_FLAGGED: &str = "flagged";
const CHALLENGE_ACTIVITY_STATUS_EXCLUDED: &str = "excluded";
const CHALLENGE_ACTIVITY_STATUS_CONFIRMED: &str = "confirmed";
const CHALLENGE_PARTICIPATION_JOINED: &str = "joined";
const CHALLENGE_PARTICIPATION_COMPLETED: &str = "completed";
const CHALLENGE_INTEGRITY_ACTION_AUTO_FLAG: &str = "auto_flag";
const CHALLENGE_INTEGRITY_ACTION_CONFIRM: &str = "confirm";
const CHALLENGE_INTEGRITY_ACTION_EXCLUDE: &str = "exclude";
const CHALLENGE_INTEGRITY_ACTION_REQUEST_EVIDENCE: &str = "request_evidence";
const PUBLIC_CHALLENGE_MONITOR_SCHEDULE_ID: u64 = 1;
const PUBLIC_CHALLENGE_MONITOR_INTERVAL_SECONDS: u64 = 15 * 60;
const AUTO_CHALLENGE_DEFAULT_ROUTE_KM: f64 = 145.0;
const AUTO_CHALLENGE_DEFAULT_CAPACITY: u32 = 50;
const AUTO_CHALLENGE_DURATION_SECONDS: i64 = 28 * 24 * 60 * 60;
const AUTO_CHALLENGE_START_DELAY_SECONDS: i64 = 24 * 60 * 60;
const AUTO_CHALLENGE_REGISTRATION_LEAD_SECONDS: i64 = 24 * 60 * 60;

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

fn parse_stripe_signature_header(signature_header: &str) -> Option<(String, String)> {
    let mut timestamp: Option<String> = None;
    let mut signature: Option<String> = None;

    for part in signature_header.split(',') {
        let mut split = part.trim().splitn(2, '=');
        let key = split.next()?.trim();
        let value = split.next()?.trim();
        if key == "t" {
            timestamp = Some(value.to_string());
        } else if key == "v1" {
            signature = Some(value.to_string());
        }
    }

    Some((timestamp?, signature?))
}

fn verify_stripe_webhook_signature(
    payload: &str,
    signature_header: &str,
    webhook_secret: &str,
) -> bool {
    type HmacSha256 = Hmac<Sha256>;

    let Some((timestamp, received_sig_hex)) = parse_stripe_signature_header(signature_header) else {
        return false;
    };

    let signed_payload = format!("{}.{}", timestamp, payload);

    let mut mac = match HmacSha256::new_from_slice(webhook_secret.as_bytes()) {
        Ok(mac) => mac,
        Err(_) => return false,
    };
    mac.update(signed_payload.as_bytes());

    let received_sig = match hex::decode(received_sig_hex) {
        Ok(bytes) => bytes,
        Err(_) => return false,
    };

    mac.verify_slice(&received_sig).is_ok()
}

fn json_u64(value: Option<&serde_json::Value>) -> Option<u64> {
    let value = value?;
    if let Some(as_u64) = value.as_u64() {
        return Some(as_u64);
    }
    value
        .as_str()
        .and_then(|text| text.trim().parse::<u64>().ok())
}

fn json_i64(value: Option<&serde_json::Value>) -> Option<i64> {
    let value = value?;
    if let Some(as_i64) = value.as_i64() {
        return Some(as_i64);
    }
    value
        .as_str()
        .and_then(|text| text.trim().parse::<i64>().ok())
}

fn json_bool(value: Option<&serde_json::Value>) -> Option<bool> {
    value?.as_bool()
}

fn json_string(value: Option<&serde_json::Value>) -> Option<String> {
    value
        .and_then(|raw| raw.as_str())
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn resolve_subscription_status_for_event(
    event_kind: &str,
    object: &serde_json::Value,
) -> Option<String> {
    match event_kind {
        "checkout.session.completed" => Some(SUBSCRIPTION_STATUS_ACTIVE.to_string()),
        "customer.subscription.created" | "customer.subscription.updated" => {
            let status = json_string(object.get("status"))?.to_lowercase();
            if is_valid_subscription_status(&status) {
                Some(status)
            } else {
                None
            }
        }
        "customer.subscription.deleted" => Some(SUBSCRIPTION_STATUS_CANCELED.to_string()),
        _ => None,
    }
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
    let expedition_id = resolve_or_create_expedition_for_member_procedure(ctx, member)?;

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
                expedition_id,
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
pub fn init(ctx: &ReducerContext) {
    for mut expedition in ctx.db.expedition().iter() {
        if expedition.route_template_key.is_none() {
            expedition.route_template_key = Some(ROUTE_TEMPLATE_CLASSIC_TRAIL.to_string());
            ctx.db.expedition().id().update(expedition);
        }
    }

    if ctx
        .db
        .public_challenge_monitor_schedule()
        .id()
        .find(PUBLIC_CHALLENGE_MONITOR_SCHEDULE_ID)
        .is_none()
    {
        ctx.db
            .public_challenge_monitor_schedule()
            .insert(PublicChallengeMonitorSchedule {
                id: PUBLIC_CHALLENGE_MONITOR_SCHEDULE_ID,
                scheduled_at: ScheduleAt::Interval(
                    Duration::from_secs(PUBLIC_CHALLENGE_MONITOR_INTERVAL_SECONDS).into(),
                ),
                job_name: "public_challenge_monitor".to_string(),
            });
    }

    run_public_challenge_monitor_core(ctx);
}

#[spacetimedb::reducer]
pub fn run_public_challenge_monitor(
    ctx: &ReducerContext,
    _job: PublicChallengeMonitorSchedule,
) {
    run_public_challenge_monitor_core(ctx);
}

#[spacetimedb::reducer]
pub fn run_public_challenge_monitor_now(ctx: &ReducerContext) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("run_public_challenge_monitor_now: {}", err);
            return;
        }
    };

    if !has_challenge_admin_scope(ctx, me.id) {
        log::error!("run_public_challenge_monitor_now: admin scope required");
        return;
    }

    run_public_challenge_monitor_core(ctx);
}

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
    #[default(false)]
    pub invite_only: bool,
    #[default(None::<String>)]
    pub route_template_key: Option<String>,
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

#[spacetimedb::table(accessor = invite, public)]
pub struct Invite {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub token: String,
    pub expedition_id: u64,
    pub created_by_member_id: u64,
    pub max_uses: u32,
    pub used_count: u32,
    pub expires_at_epoch: i64,
    pub created_at: Timestamp,
    pub last_used_at: Option<Timestamp>,
    pub revoked_at: Option<Timestamp>,
}

#[spacetimedb::table(accessor = plan_subscription, public)]
pub struct PlanSubscription {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub expedition_id: u64,
    pub owner_member_id: u64,
    pub plan_code: String,
    pub status: String,
    pub seat_limit: u32,
    pub cancel_at_period_end: bool,
    pub period_start_epoch: i64,
    pub period_end_epoch: i64,
    #[unique]
    pub expedition_owner_key: String,
    pub updated_at: Timestamp,
}

#[spacetimedb::table(accessor = entitlement, public)]
pub struct Entitlement {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub expedition_id: u64,
    pub feature_key: String,
    pub enabled: bool,
    pub limit_value: u32,
    #[unique]
    pub expedition_feature_key: String,
    pub updated_at: Timestamp,
}

#[spacetimedb::table(accessor = billing_webhook_event)]
pub struct BillingWebhookEvent {
    #[primary_key]
    pub provider_event_id: String,
    pub event_type: String,
    pub processed_at: Timestamp,
}

#[spacetimedb::table(accessor = notification, public)]
pub struct Notification {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub recipient_member_id: u64,
    pub actor_member_id: u64,
    pub expedition_id: u64,
    pub event_kind: String,
    pub title: String,
    pub body: String,
    pub entity_type: String,
    pub entity_id: u64,
    pub is_read: bool,
    pub created_at: Timestamp,
    pub read_at: Option<Timestamp>,
}

#[spacetimedb::table(accessor = abuse_report, public)]
pub struct AbuseReport {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub expedition_id: u64,
    pub reported_by_member_id: u64,
    pub target_type: String,
    pub target_id: u64,
    pub reason: String,
    pub details: String,
    pub status: String,
    pub created_at: Timestamp,
    pub reviewed_at: Option<Timestamp>,
    pub reviewed_by_member_id: Option<u64>,
    pub resolution_note: String,
}

#[spacetimedb::table(accessor = moderation_audit, public)]
pub struct ModerationAudit {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub expedition_id: u64,
    pub report_id: u64,
    pub moderator_member_id: u64,
    pub action: String,
    pub target_type: String,
    pub target_id: u64,
    pub note: String,
    pub created_at: Timestamp,
}

#[spacetimedb::table(accessor = product_analytics_event)]
pub struct ProductAnalyticsEvent {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub event_name: String,
    pub member_id: u64,
    pub expedition_id: u64,
    pub payload_json: String,
    pub created_at: Timestamp,
}

#[spacetimedb::table(accessor = operational_counter, public)]
pub struct OperationalCounter {
    #[primary_key]
    pub key: String,
    pub operation: String,
    pub status: String,
    pub count: u64,
    pub last_error_code: String,
    pub updated_at: Timestamp,
}

#[spacetimedb::table(accessor = public_challenge, public)]
pub struct PublicChallenge {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub slug: String,
    pub title: String,
    pub route_target_km: f64,
    pub capacity: u32,
    pub start_epoch: i64,
    pub end_epoch: i64,
    pub registration_closes_epoch: i64,
    pub status: String,
    pub created_by_member_id: u64,
    pub created_at: Timestamp,
    pub closed_at: Option<Timestamp>,
}

#[spacetimedb::table(accessor = public_challenge_participant, public)]
pub struct PublicChallengeParticipant {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub challenge_id: u64,
    pub member_id: u64,
    pub joined_at: Timestamp,
    pub completion_state: String,
    pub total_distance_km: f64,
    pub flag_count: u32,
    pub is_disqualified: bool,
    #[unique]
    pub challenge_member_key: String,
}

#[spacetimedb::table(accessor = challenge_activity_log, public)]
pub struct ChallengeActivityLog {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub challenge_id: u64,
    pub member_id: u64,
    pub participant_id: u64,
    pub activity_type: String,
    pub distance_km: f64,
    pub duration_minutes: f64,
    pub occurred_at_epoch: i64,
    pub status: String,
    pub risk_score: u32,
    pub flags_csv: String,
    pub note: String,
    pub submitted_at: Timestamp,
}

#[spacetimedb::table(accessor = challenge_integrity_event, public)]
pub struct ChallengeIntegrityEvent {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub challenge_id: u64,
    pub challenge_activity_log_id: u64,
    pub member_id: u64,
    pub risk_score: u32,
    pub flags_csv: String,
    pub action: String,
    pub reason_enum: String,
    pub created_at: Timestamp,
    pub moderator_member_id: Option<u64>,
}

#[spacetimedb::table(accessor = public_challenge_monitor_schedule, scheduled(run_public_challenge_monitor))]
pub struct PublicChallengeMonitorSchedule {
    #[primary_key]
    pub id: u64,
    pub scheduled_at: ScheduleAt,
    pub job_name: String,
}

fn require_authenticated_member(ctx: &ReducerContext) -> Result<Member, String> {
    let owner_sub = authenticated_subject(ctx)?;
    ctx.db
        .member()
        .owner_sub()
        .find(owner_sub)
        .ok_or("profile not found for authenticated user".to_string())
}

fn require_expedition(ctx: &ReducerContext, expedition_id: u64) -> Result<Expedition, String> {
    ctx.db
        .expedition()
        .id()
        .find(expedition_id)
        .ok_or("expedition not found".to_string())
}

fn require_joinable_expedition(
    ctx: &ReducerContext,
    expedition_id: u64,
) -> Result<Expedition, String> {
    let expedition = require_expedition(ctx, expedition_id)?;
    if expedition.is_archived {
        return Err("expedition is archived".to_string());
    }

    Ok(expedition)
}

fn find_active_membership(ctx: &ReducerContext, expedition_id: u64, member_id: u64) -> Option<Membership> {
    let expedition_member_key = format!("{}:{}", expedition_id, member_id);
    let membership = ctx
        .db
        .membership()
        .expedition_member_key()
        .find(expedition_member_key)?;

    if membership.status == "active" {
        Some(membership)
    } else {
        None
    }
}

fn require_active_membership(
    ctx: &ReducerContext,
    expedition_id: u64,
    member_id: u64,
) -> Result<Membership, String> {
    find_active_membership(ctx, expedition_id, member_id)
        .ok_or("active membership required".to_string())
}

fn require_owner_membership_for_archive(
    ctx: &ReducerContext,
    expedition_id: u64,
    member_id: u64,
) -> Result<Membership, String> {
    let membership = require_active_membership(ctx, expedition_id, member_id)?;
    if membership.role != MEMBERSHIP_ROLE_OWNER {
        return Err("only owner can archive expedition".to_string());
    }

    Ok(membership)
}

fn require_membership_with_allowed_roles(
    ctx: &ReducerContext,
    expedition_id: u64,
    member_id: u64,
    allowed_roles: &[&str],
) -> Result<Membership, String> {
    let membership = require_active_membership(ctx, expedition_id, member_id)?;
    if allowed_roles.iter().any(|role| *role == membership.role.as_str()) {
        return Ok(membership);
    }

    Err("insufficient role for this action".to_string())
}

fn is_valid_membership_role(role: &str) -> bool {
    role == MEMBERSHIP_ROLE_OWNER || role == MEMBERSHIP_ROLE_ADMIN || role == MEMBERSHIP_ROLE_MEMBER
}

fn is_invite_manager_role(role: &str) -> bool {
    role == MEMBERSHIP_ROLE_OWNER || role == MEMBERSHIP_ROLE_ADMIN
}

fn is_valid_abuse_target(target_type: &str) -> bool {
    target_type == ABUSE_TARGET_ACTIVITY_LOG || target_type == ABUSE_TARGET_COMMENT
}

fn is_valid_moderation_action(action: &str) -> bool {
    action == MODERATION_ACTION_DISMISS
        || action == MODERATION_ACTION_HIDE
        || action == MODERATION_ACTION_REMOVE
}

fn is_valid_expedition_visibility(visibility: &str) -> bool {
    visibility == EXPEDITION_VISIBILITY_PUBLIC
        || visibility == EXPEDITION_VISIBILITY_INVITE_ONLY
}

fn is_valid_product_event_name(event_name: &str) -> bool {
    let trimmed = event_name.trim();
    !trimmed.is_empty() && trimmed.len() <= PRODUCT_EVENT_NAME_MAX_LEN
}

fn is_valid_subscription_status(status: &str) -> bool {
    status == SUBSCRIPTION_STATUS_TRIALING
        || status == SUBSCRIPTION_STATUS_ACTIVE
        || status == SUBSCRIPTION_STATUS_PAST_DUE
        || status == SUBSCRIPTION_STATUS_CANCELED
        || status == SUBSCRIPTION_STATUS_INCOMPLETE
}

fn now_epoch_seconds(ctx: &ReducerContext) -> i64 {
    (ctx.timestamp.to_micros_since_unix_epoch() / 1_000_000) as i64
}

fn require_challenge(ctx: &ReducerContext, challenge_id: u64) -> Result<PublicChallenge, String> {
    ctx.db
        .public_challenge()
        .id()
        .find(challenge_id)
        .ok_or("public challenge not found".to_string())
}

fn challenge_member_key(challenge_id: u64, member_id: u64) -> String {
    format!("{}:{}", challenge_id, member_id)
}

fn find_challenge_participant(
    ctx: &ReducerContext,
    challenge_id: u64,
    member_id: u64,
) -> Option<PublicChallengeParticipant> {
    ctx.db
        .public_challenge_participant()
        .challenge_member_key()
        .find(challenge_member_key(challenge_id, member_id))
}

fn has_challenge_admin_scope(ctx: &ReducerContext, member_id: u64) -> bool {
    ctx.db.membership().iter().any(|membership| {
        membership.member_id == member_id
            && membership.status == "active"
            && membership.left_at.is_none()
            && (membership.role == MEMBERSHIP_ROLE_OWNER || membership.role == MEMBERSHIP_ROLE_ADMIN)
    })
}

fn infer_challenge_status(now_epoch: i64, challenge: &PublicChallenge) -> String {
    if challenge.closed_at.is_some() || challenge.status == CHALLENGE_STATUS_CLOSED {
        CHALLENGE_STATUS_CLOSED.to_string()
    } else if now_epoch >= challenge.start_epoch && now_epoch <= challenge.end_epoch {
        CHALLENGE_STATUS_ACTIVE.to_string()
    } else {
        CHALLENGE_STATUS_SCHEDULED.to_string()
    }
}

fn is_valid_challenge_activity_type(activity_type: &str) -> bool {
    activity_type == "run" || activity_type == "walk" || activity_type == "cycle" || activity_type == "row"
}

fn pace_flag_for_activity(activity_type: &str, pace_min_per_km: f64) -> Option<&'static str> {
    if activity_type == "run" && pace_min_per_km < 2.75 {
        return Some("pace_outlier_run");
    }
    if activity_type == "walk" && pace_min_per_km < 5.0 {
        return Some("pace_outlier_walk");
    }
    if activity_type == "cycle" && pace_min_per_km < 1.0 {
        return Some("pace_outlier_cycle");
    }
    if activity_type == "row" && pace_min_per_km < 1.25 {
        return Some("pace_outlier_row");
    }

    None
}

fn compute_trailing_median_daily_distance(
    ctx: &ReducerContext,
    member_id: u64,
    now_epoch: i64,
) -> Option<f64> {
    let current_day = now_epoch / 86_400;
    let mut daily_totals: Vec<f64> = (0..14)
        .map(|day_offset| {
            let day = current_day - day_offset;
            let start = day * 86_400;
            let end = start + 86_400;
            ctx.db
                .challenge_activity_log()
                .iter()
                .filter(|row| {
                    row.member_id == member_id
                        && row.occurred_at_epoch >= start
                        && row.occurred_at_epoch < end
                        && row.status != CHALLENGE_ACTIVITY_STATUS_EXCLUDED
                })
                .map(|row| row.distance_km)
                .sum::<f64>()
        })
        .collect();

    let has_any = daily_totals.iter().any(|value| *value > 0.0);
    if !has_any {
        return None;
    }

    daily_totals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mid = daily_totals.len() / 2;
    if daily_totals.len() % 2 == 0 {
        Some((daily_totals[mid - 1] + daily_totals[mid]) / 2.0)
    } else {
        Some(daily_totals[mid])
    }
}

fn count_near_identical_logs_in_24h(
    ctx: &ReducerContext,
    challenge_id: u64,
    member_id: u64,
    distance_km: f64,
    duration_minutes: f64,
    occurred_at_epoch: i64,
) -> usize {
    let from_epoch = occurred_at_epoch - (24 * 60 * 60);
    ctx.db
        .challenge_activity_log()
        .iter()
        .filter(|row| {
            row.challenge_id == challenge_id
                && row.member_id == member_id
                && row.occurred_at_epoch >= from_epoch
                && row.occurred_at_epoch <= occurred_at_epoch
                && row.status != CHALLENGE_ACTIVITY_STATUS_EXCLUDED
        })
        .filter(|row| {
            let distance_delta = (row.distance_km - distance_km).abs();
            let distance_ratio = if distance_km <= f64::EPSILON {
                0.0
            } else {
                distance_delta / distance_km
            };

            let duration_delta = (row.duration_minutes - duration_minutes).abs();
            let duration_ratio = if duration_minutes <= f64::EPSILON {
                0.0
            } else {
                duration_delta / duration_minutes
            };

            distance_ratio <= 0.01 && duration_ratio <= 0.02
        })
        .count()
}

fn is_valid_challenge_integrity_action(action: &str) -> bool {
    action == CHALLENGE_INTEGRITY_ACTION_CONFIRM
        || action == CHALLENGE_INTEGRITY_ACTION_EXCLUDE
        || action == CHALLENGE_INTEGRITY_ACTION_REQUEST_EVIDENCE
}

fn should_auto_close_challenge_values(
    closed_at_is_some: bool,
    end_epoch: i64,
    now_epoch: i64,
) -> bool {
    !closed_at_is_some && now_epoch >= end_epoch + (24 * 60 * 60)
}

fn should_auto_close_challenge(challenge: &PublicChallenge, now_epoch: i64) -> bool {
    should_auto_close_challenge_values(challenge.closed_at.is_some(), challenge.end_epoch, now_epoch)
}

fn has_open_or_upcoming_challenge_values(
    closed_at_is_some: bool,
    status: &str,
    end_epoch: i64,
    now_epoch: i64,
) -> bool {
    !closed_at_is_some && status != CHALLENGE_STATUS_CLOSED && end_epoch >= now_epoch
}

fn has_open_or_upcoming_challenge(challenge: &PublicChallenge, now_epoch: i64) -> bool {
    has_open_or_upcoming_challenge_values(
        challenge.closed_at.is_some(),
        &challenge.status,
        challenge.end_epoch,
        now_epoch,
    )
}

fn compute_auto_challenge_window(now_epoch: i64) -> (i64, i64, i64) {
    let start_epoch = now_epoch + AUTO_CHALLENGE_START_DELAY_SECONDS;
    let end_epoch = start_epoch + AUTO_CHALLENGE_DURATION_SECONDS;
    let registration_closes_epoch = start_epoch - AUTO_CHALLENGE_REGISTRATION_LEAD_SECONDS;
    (start_epoch, end_epoch, registration_closes_epoch)
}

#[derive(Default)]
struct PublicChallengeStatusChanges {
    activated_count: u64,
    scheduled_count: u64,
    closed_count: u64,
}

fn apply_challenge_closeout(ctx: &ReducerContext, challenge: &PublicChallenge) {
    let participant_ids: Vec<u64> = ctx
        .db
        .public_challenge_participant()
        .iter()
        .filter(|row| row.challenge_id == challenge.id)
        .map(|row| row.id)
        .collect();

    for participant_id in participant_ids {
        let Some(mut participant) = ctx.db.public_challenge_participant().id().find(participant_id) else {
            continue;
        };

        if participant.is_disqualified {
            participant.completion_state = CHALLENGE_PARTICIPATION_JOINED.to_string();
        } else if participant.total_distance_km >= challenge.route_target_km {
            participant.completion_state = CHALLENGE_PARTICIPATION_COMPLETED.to_string();
        } else {
            participant.completion_state = CHALLENGE_PARTICIPATION_JOINED.to_string();
        }

        ctx.db
            .public_challenge_participant()
            .id()
            .update(participant);
    }
}

fn upsert_public_challenge_statuses(
    ctx: &ReducerContext,
    now_epoch: i64,
) -> PublicChallengeStatusChanges {
    let mut changes = PublicChallengeStatusChanges::default();
    let challenge_ids: Vec<u64> = ctx.db.public_challenge().iter().map(|row| row.id).collect();

    for challenge_id in challenge_ids {
        let Some(mut challenge) = ctx.db.public_challenge().id().find(challenge_id) else {
            continue;
        };

        if should_auto_close_challenge(&challenge, now_epoch) {
            challenge.status = CHALLENGE_STATUS_CLOSED.to_string();
            challenge.closed_at = Some(ctx.timestamp);
            let challenge_snapshot = PublicChallenge {
                id: challenge.id,
                slug: challenge.slug.clone(),
                title: challenge.title.clone(),
                route_target_km: challenge.route_target_km,
                capacity: challenge.capacity,
                start_epoch: challenge.start_epoch,
                end_epoch: challenge.end_epoch,
                registration_closes_epoch: challenge.registration_closes_epoch,
                status: challenge.status.clone(),
                created_by_member_id: challenge.created_by_member_id,
                created_at: challenge.created_at,
                closed_at: challenge.closed_at,
            };
            ctx.db.public_challenge().id().update(challenge);
            apply_challenge_closeout(ctx, &challenge_snapshot);
            changes.closed_count = changes.closed_count.saturating_add(1);
            continue;
        }

        let inferred = infer_challenge_status(now_epoch, &challenge);
        if challenge.status != inferred {
            if inferred == CHALLENGE_STATUS_ACTIVE {
                changes.activated_count = changes.activated_count.saturating_add(1);
            }
            if inferred == CHALLENGE_STATUS_SCHEDULED {
                changes.scheduled_count = changes.scheduled_count.saturating_add(1);
            }
            challenge.status = inferred;
            ctx.db.public_challenge().id().update(challenge);
        }
    }

    changes
}

fn ensure_recurring_public_challenge(ctx: &ReducerContext, now_epoch: i64) -> bool {
    let has_open_or_upcoming = ctx
        .db
        .public_challenge()
        .iter()
        .any(|challenge| has_open_or_upcoming_challenge(&challenge, now_epoch));
    if has_open_or_upcoming {
        return false;
    }

    let (start_epoch, end_epoch, registration_closes_epoch) =
        compute_auto_challenge_window(now_epoch);

    let mut slug = format!("auto-public-{}", start_epoch);
    let mut collision_counter: u64 = 1;
    while ctx.db.public_challenge().slug().find(slug.clone()).is_some() {
        slug = format!("auto-public-{}-{}", start_epoch, collision_counter);
        collision_counter = collision_counter.saturating_add(1);
    }

    let title = format!("Public Challenge {}", start_epoch);

    ctx.db.public_challenge().insert(PublicChallenge {
        id: 0,
        slug,
        title,
        route_target_km: AUTO_CHALLENGE_DEFAULT_ROUTE_KM,
        capacity: AUTO_CHALLENGE_DEFAULT_CAPACITY,
        start_epoch,
        end_epoch,
        registration_closes_epoch,
        status: CHALLENGE_STATUS_SCHEDULED.to_string(),
        created_by_member_id: 0,
        created_at: ctx.timestamp,
        closed_at: None,
    });

    true
}

fn run_public_challenge_monitor_core(ctx: &ReducerContext) {
    let now_epoch = now_epoch_seconds(ctx);
    let changes = upsert_public_challenge_statuses(ctx, now_epoch);
    let created = ensure_recurring_public_challenge(ctx, now_epoch);

    bump_operational_counter(ctx, "public_challenge_monitor_run", OPERATION_STATUS_SUCCESS, "");
    if changes.activated_count > 0 {
        bump_operational_counter(
            ctx,
            "public_challenge_monitor_transition_active",
            OPERATION_STATUS_SUCCESS,
            "",
        );
    }
    if changes.scheduled_count > 0 {
        bump_operational_counter(
            ctx,
            "public_challenge_monitor_transition_scheduled",
            OPERATION_STATUS_SUCCESS,
            "",
        );
    }
    if changes.closed_count > 0 {
        bump_operational_counter(
            ctx,
            "public_challenge_monitor_closed",
            OPERATION_STATUS_SUCCESS,
            "",
        );
    }
    if created {
        bump_operational_counter(
            ctx,
            "public_challenge_monitor_auto_created",
            OPERATION_STATUS_SUCCESS,
            "",
        );
    }
}

fn subscription_is_access_granting(status: &str) -> bool {
    status == SUBSCRIPTION_STATUS_ACTIVE || status == SUBSCRIPTION_STATUS_TRIALING
}

fn active_members_count(ctx: &ReducerContext, expedition_id: u64) -> u32 {
    ctx.db
        .membership()
        .iter()
        .filter(|membership| membership.expedition_id == expedition_id && membership.status == "active")
        .count() as u32
}

fn bump_operational_counter(
    ctx: &ReducerContext,
    operation: &str,
    status: &str,
    error_code: &str,
) {
    let normalized_error = if status == OPERATION_STATUS_FAILURE {
        error_code.trim()
    } else {
        ""
    };

    let key = if normalized_error.is_empty() {
        format!("{}:{}", operation, status)
    } else {
        format!("{}:{}:{}", operation, status, normalized_error)
    };

    if let Some(mut counter) = ctx.db.operational_counter().key().find(key.clone()) {
        counter.count = counter.count.saturating_add(1);
        counter.last_error_code = normalized_error.to_string();
        counter.updated_at = ctx.timestamp;
        ctx.db.operational_counter().key().update(counter);
        return;
    }

    ctx.db.operational_counter().insert(OperationalCounter {
        key,
        operation: operation.to_string(),
        status: status.to_string(),
        count: 1,
        last_error_code: normalized_error.to_string(),
        updated_at: ctx.timestamp,
    });
}

fn effective_member_limit(ctx: &ReducerContext, expedition_id: u64) -> u32 {
    let mut limit = FREE_PLAN_MAX_MEMBERS;

    let entitlement_feature_key = format!("{}:{}", expedition_id, ENTITLEMENT_KEY_MAX_MEMBERS);
    if let Some(entitlement) = ctx
        .db
        .entitlement()
        .expedition_feature_key()
        .find(entitlement_feature_key)
    {
        if entitlement.enabled && entitlement.limit_value > 0 {
            limit = entitlement.limit_value;
        }
    }

    if let Some(subscription) = ctx
        .db
        .plan_subscription()
        .iter()
        .find(|row| row.expedition_id == expedition_id)
    {
        if subscription_is_access_granting(&subscription.status) && subscription.seat_limit > 0 {
            limit = limit.max(subscription.seat_limit);
        }
    }

    limit
}

fn insert_notification(
    ctx: &ReducerContext,
    recipient_member_id: u64,
    actor_member_id: u64,
    expedition_id: u64,
    event_kind: &str,
    title: String,
    body: String,
    entity_type: &str,
    entity_id: u64,
) {
    if recipient_member_id == 0 || event_kind.trim().is_empty() {
        return;
    }

    ctx.db.notification().insert(Notification {
        id: 0,
        recipient_member_id,
        actor_member_id,
        expedition_id,
        event_kind: event_kind.to_string(),
        title: title.trim().to_string(),
        body: body.trim().to_string(),
        entity_type: entity_type.to_string(),
        entity_id,
        is_read: false,
        created_at: ctx.timestamp,
        read_at: None,
    });
}

fn notify_active_members_except(
    ctx: &ReducerContext,
    expedition_id: u64,
    actor_member_id: u64,
    event_kind: &str,
    title: String,
    body: String,
    entity_type: &str,
    entity_id: u64,
) {
    for membership in ctx.db.membership().iter() {
        if membership.expedition_id != expedition_id || membership.status != "active" {
            continue;
        }

        if membership.member_id == actor_member_id {
            continue;
        }

        insert_notification(
            ctx,
            membership.member_id,
            actor_member_id,
            expedition_id,
            event_kind,
            title.clone(),
            body.clone(),
            entity_type,
            entity_id,
        );
    }
}

fn milestone_label(distance_km: f64) -> Option<&'static str> {
    if distance_km >= 100.0 {
        Some("100K")
    } else if distance_km >= 42.195 {
        Some("Marathon")
    } else if distance_km >= 21.097 {
        Some("Half marathon")
    } else if distance_km >= 10.0 {
        Some("10K")
    } else {
        None
    }
}

fn normalize_route_template_key(raw: &str) -> &'static str {
    match raw.trim() {
        ROUTE_TEMPLATE_CLASSIC_TRAIL => ROUTE_TEMPLATE_CLASSIC_TRAIL,
        ROUTE_TEMPLATE_MOUNTAIN_PASS => ROUTE_TEMPLATE_MOUNTAIN_PASS,
        ROUTE_TEMPLATE_COASTLINE => ROUTE_TEMPLATE_COASTLINE,
        _ => ROUTE_TEMPLATE_CLASSIC_TRAIL,
    }
}

fn require_member_capacity(ctx: &ReducerContext, expedition_id: u64) -> Result<(), String> {
    let member_limit = effective_member_limit(ctx, expedition_id);
    if member_limit == 0 {
        return Ok(());
    }

    let active_count = active_members_count(ctx, expedition_id);
    if active_count >= member_limit {
        return Err(format!(
            "member seat limit reached ({}/{})",
            active_count, member_limit
        ));
    }

    Ok(())
}

fn create_unique_invite_token(ctx: &ReducerContext, expedition_id: u64, member_id: u64) -> String {
    let base = format!(
        "inv-{}-{}-{}",
        expedition_id,
        member_id,
        ctx.timestamp.to_micros_since_unix_epoch()
    );

    if ctx.db.invite().token().find(base.clone()).is_none() {
        return base;
    }

    let mut counter: u64 = 1;
    loop {
        let candidate = format!("{}-{}", base, counter);
        if ctx.db.invite().token().find(candidate.clone()).is_none() {
            return candidate;
        }
        counter += 1;
    }
}

fn resolve_or_create_expedition_for_member_procedure(
    ctx: &mut ProcedureContext,
    member: &Member,
) -> Result<u64, String> {
    let now_ts = ctx.timestamp;
    ctx.with_tx(|tx| {
        let active_expedition_id = tx
            .db
            .membership()
            .iter()
            .filter(|membership| membership.member_id == member.id && membership.status == "active")
            .filter_map(|membership| {
                tx.db
                    .expedition()
                    .id()
                    .find(membership.expedition_id)
                    .filter(|expedition| !expedition.is_archived)
                    .map(|expedition| expedition.id)
            })
            .min();

        if let Some(expedition_id) = active_expedition_id {
            return Ok(expedition_id);
        }

        let mut expedition = if let Some(existing) = tx
            .db
            .expedition()
            .slug()
            .find(LEGACY_DEFAULT_EXPEDITION_SLUG.to_string())
        {
            existing
        } else {
            tx.db.expedition().insert(Expedition {
                id: 0,
                name: LEGACY_DEFAULT_EXPEDITION_NAME.to_string(),
                slug: LEGACY_DEFAULT_EXPEDITION_SLUG.to_string(),
                created_by_member_id: member.id,
                is_archived: false,
                created_at: now_ts,
                archived_at: None,
                invite_only: false,
                route_template_key: Some(ROUTE_TEMPLATE_CLASSIC_TRAIL.to_string()),
            });
            tx.db
                .expedition()
                .slug()
                .find(LEGACY_DEFAULT_EXPEDITION_SLUG.to_string())
                .ok_or("failed to resolve legacy default expedition".to_string())?
        };

        if expedition.is_archived {
            expedition.is_archived = false;
            expedition.archived_at = None;
            tx.db.expedition().id().update(expedition);
            expedition = tx
                .db
                .expedition()
                .slug()
                .find(LEGACY_DEFAULT_EXPEDITION_SLUG.to_string())
                .ok_or("failed to reload legacy default expedition".to_string())?;
        }

        let expedition_member_key = format!("{}:{}", expedition.id, member.id);
        if let Some(mut membership) = tx
            .db
            .membership()
            .expedition_member_key()
            .find(expedition_member_key.clone())
        {
            if membership.status != "active" {
                membership.status = "active".to_string();
                membership.joined_at = now_ts;
                membership.left_at = None;
                tx.db.membership().id().update(membership);
            }
        } else {
            tx.db.membership().insert(Membership {
                id: 0,
                expedition_id: expedition.id,
                member_id: member.id,
                role: MEMBERSHIP_ROLE_MEMBER.to_string(),
                status: "active".to_string(),
                joined_at: now_ts,
                left_at: None,
                expedition_member_key,
            });
        }

        Ok(expedition.id)
    })
}

#[spacetimedb::reducer]
pub fn create_expedition(
    ctx: &ReducerContext,
    name: String,
    slug: String,
    route_template_key: String,
    invite_only: bool,
) {
    let owner_sub = match authenticated_subject(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("create_expedition: {}", err);
            bump_operational_counter(
                ctx,
                "create_expedition",
                OPERATION_STATUS_FAILURE,
                "auth.required",
            );
            return;
        }
    };

    let Some(me) = ctx.db.member().owner_sub().find(owner_sub) else {
        log::error!("create_expedition: profile not found for authenticated user");
        bump_operational_counter(
            ctx,
            "create_expedition",
            OPERATION_STATUS_FAILURE,
            "member.missing",
        );
        return;
    };

    let name = name.trim().to_string();
    if name.is_empty() {
        log::error!("create_expedition: name cannot be empty");
        bump_operational_counter(
            ctx,
            "create_expedition",
            OPERATION_STATUS_FAILURE,
            "validation.name_empty",
        );
        return;
    }

    let slug = slug.trim().to_string();
    if !is_valid_slug(&slug) {
        log::error!(
            "create_expedition: slug must contain only lowercase letters, digits, and hyphens"
        );
        bump_operational_counter(
            ctx,
            "create_expedition",
            OPERATION_STATUS_FAILURE,
            "validation.slug_invalid",
        );
        return;
    }

    if ctx.db.expedition().slug().find(slug.clone()).is_some() {
        log::error!("create_expedition: duplicate slug");
        bump_operational_counter(
            ctx,
            "create_expedition",
            OPERATION_STATUS_FAILURE,
            "validation.slug_duplicate",
        );
        return;
    }

    let route_template_key = normalize_route_template_key(&route_template_key).to_string();

    ctx.db.expedition().insert(Expedition {
        id: 0,
        name,
        slug: slug.clone(),
        created_by_member_id: me.id,
        is_archived: false,
        created_at: ctx.timestamp,
        archived_at: None,
        invite_only,
        route_template_key: Some(route_template_key),
    });

    let Some(expedition) = ctx.db.expedition().slug().find(slug) else {
        log::error!("create_expedition: failed to resolve inserted expedition");
        bump_operational_counter(
            ctx,
            "create_expedition",
            OPERATION_STATUS_FAILURE,
            "db.resolve_insert_failed",
        );
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
        bump_operational_counter(
            ctx,
            "create_expedition",
            OPERATION_STATUS_FAILURE,
            "db.membership_duplicate",
        );
        return;
    }

    ctx.db.membership().insert(Membership {
        id: 0,
        expedition_id: expedition.id,
        member_id: me.id,
        role: MEMBERSHIP_ROLE_OWNER.to_string(),
        status: "active".to_string(),
        joined_at: ctx.timestamp,
        left_at: None,
        expedition_member_key,
    });

    bump_operational_counter(
        ctx,
        "create_expedition",
        OPERATION_STATUS_SUCCESS,
        "",
    );
}

#[spacetimedb::reducer]
pub fn archive_expedition(ctx: &ReducerContext, expedition_id: u64) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("archive_expedition: {}", err);
            return;
        }
    };

    let mut expedition = match require_expedition(ctx, expedition_id) {
        Ok(expedition) => expedition,
        Err(err) => {
            log::error!("archive_expedition: {}", err);
            return;
        }
    };

    if let Err(err) = require_owner_membership_for_archive(ctx, expedition.id, me.id) {
        log::error!("archive_expedition: {}", err);
        return;
    }

    if expedition.is_archived {
        return;
    }

    expedition.is_archived = true;
    expedition.archived_at = Some(ctx.timestamp);
    ctx.db.expedition().id().update(expedition);
}

#[spacetimedb::reducer]
pub fn delete_expedition(ctx: &ReducerContext, expedition_id: u64) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("delete_expedition: {}", err);
            bump_operational_counter(
                ctx,
                "delete_expedition",
                OPERATION_STATUS_FAILURE,
                "auth.required",
            );
            return;
        }
    };

    let expedition = match require_expedition(ctx, expedition_id) {
        Ok(expedition) => expedition,
        Err(err) => {
            log::error!("delete_expedition: {}", err);
            bump_operational_counter(
                ctx,
                "delete_expedition",
                OPERATION_STATUS_FAILURE,
                "expedition.missing",
            );
            return;
        }
    };

    if let Err(err) = require_owner_membership_for_archive(ctx, expedition.id, me.id) {
        log::error!("delete_expedition: {}", err);
        bump_operational_counter(
            ctx,
            "delete_expedition",
            OPERATION_STATUS_FAILURE,
            "authz.owner_required",
        );
        return;
    }

    let membership_ids: Vec<u64> = ctx
        .db
        .membership()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in membership_ids {
        ctx.db.membership().id().delete(id);
    }

    let invite_ids: Vec<u64> = ctx
        .db
        .invite()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in invite_ids {
        ctx.db.invite().id().delete(id);
    }

    let plan_subscription_ids: Vec<u64> = ctx
        .db
        .plan_subscription()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in plan_subscription_ids {
        ctx.db.plan_subscription().id().delete(id);
    }

    let entitlement_ids: Vec<u64> = ctx
        .db
        .entitlement()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in entitlement_ids {
        ctx.db.entitlement().id().delete(id);
    }

    let notification_ids: Vec<u64> = ctx
        .db
        .notification()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in notification_ids {
        ctx.db.notification().id().delete(id);
    }

    let abuse_report_ids: Vec<u64> = ctx
        .db
        .abuse_report()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in abuse_report_ids {
        ctx.db.abuse_report().id().delete(id);
    }

    let moderation_audit_ids: Vec<u64> = ctx
        .db
        .moderation_audit()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in moderation_audit_ids {
        ctx.db.moderation_audit().id().delete(id);
    }

    let analytics_ids: Vec<u64> = ctx
        .db
        .product_analytics_event()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in analytics_ids {
        ctx.db.product_analytics_event().id().delete(id);
    }

    let reaction_ids: Vec<u64> = ctx
        .db
        .reaction()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in reaction_ids {
        ctx.db.reaction().id().delete(id);
    }

    let comment_ids: Vec<u64> = ctx
        .db
        .comment()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in comment_ids {
        ctx.db.comment().id().delete(id);
    }

    let activity_ids: Vec<u64> = ctx
        .db
        .activity_log()
        .iter()
        .filter(|row| row.expedition_id == expedition_id)
        .map(|row| row.id)
        .collect();
    for id in activity_ids {
        ctx.db.activity_log().id().delete(id);
    }

    ctx.db.expedition().id().delete(expedition_id);

    bump_operational_counter(
        ctx,
        "delete_expedition",
        OPERATION_STATUS_SUCCESS,
        "",
    );
}

#[spacetimedb::reducer]
pub fn join_expedition(ctx: &ReducerContext, expedition_id: u64) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("join_expedition: {}", err);
            bump_operational_counter(
                ctx,
                "join_expedition",
                OPERATION_STATUS_FAILURE,
                "auth.required",
            );
            return;
        }
    };

    let expedition = match require_joinable_expedition(ctx, expedition_id) {
        Ok(expedition) => expedition,
        Err(err) => {
            log::error!("join_expedition: {}", err);
            bump_operational_counter(
                ctx,
                "join_expedition",
                OPERATION_STATUS_FAILURE,
                "expedition.invalid",
            );
            return;
        }
    };

    if expedition.invite_only {
        log::error!("join_expedition: expedition is invite-only");
        bump_operational_counter(
            ctx,
            "join_expedition",
            OPERATION_STATUS_FAILURE,
            "expedition.invite_only",
        );
        return;
    }

    if find_active_membership(ctx, expedition.id, me.id).is_some() {
        bump_operational_counter(
            ctx,
            "join_expedition",
            OPERATION_STATUS_SUCCESS,
            "",
        );
        return;
    }

    if let Err(err) = require_member_capacity(ctx, expedition.id) {
        log::error!("join_expedition: {}", err);
        bump_operational_counter(
            ctx,
            "join_expedition",
            OPERATION_STATUS_FAILURE,
            "capacity.limit_reached",
        );
        return;
    }

    let expedition_member_key = format!("{}:{}", expedition.id, me.id);
    if let Some(mut membership) = ctx
        .db
        .membership()
        .expedition_member_key()
        .find(expedition_member_key.clone())
    {
        membership.status = "active".to_string();
        membership.joined_at = ctx.timestamp;
        membership.left_at = None;
        ctx.db.membership().id().update(membership);
        bump_operational_counter(
            ctx,
            "join_expedition",
            OPERATION_STATUS_SUCCESS,
            "",
        );
        return;
    }

    ctx.db.membership().insert(Membership {
        id: 0,
        expedition_id: expedition.id,
        member_id: me.id,
        role: MEMBERSHIP_ROLE_MEMBER.to_string(),
        status: "active".to_string(),
        joined_at: ctx.timestamp,
        left_at: None,
        expedition_member_key,
    });

    bump_operational_counter(
        ctx,
        "join_expedition",
        OPERATION_STATUS_SUCCESS,
        "",
    );
}

#[spacetimedb::reducer]
pub fn leave_expedition(ctx: &ReducerContext, expedition_id: u64) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("leave_expedition: {}", err);
            return;
        }
    };

    let mut membership = match require_active_membership(ctx, expedition_id, me.id) {
        Ok(membership) => membership,
        Err(err) => {
            log::error!("leave_expedition: {}", err);
            return;
        }
    };

    if membership.role == MEMBERSHIP_ROLE_OWNER {
        log::error!("leave_expedition: owner cannot leave expedition");
        return;
    }

    membership.status = "left".to_string();
    membership.left_at = Some(ctx.timestamp);
    ctx.db.membership().id().update(membership);
}

#[spacetimedb::reducer]
pub fn set_membership_role(
    ctx: &ReducerContext,
    expedition_id: u64,
    target_member_id: u64,
    new_role: String,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("set_membership_role: {}", err);
            return;
        }
    };

    if let Err(err) = require_joinable_expedition(ctx, expedition_id) {
        log::error!("set_membership_role: {}", err);
        return;
    }

    if let Err(err) = require_membership_with_allowed_roles(
        ctx,
        expedition_id,
        me.id,
        &[MEMBERSHIP_ROLE_OWNER],
    ) {
        log::error!("set_membership_role: {}", err);
        return;
    }

    if target_member_id == me.id {
        log::error!("set_membership_role: owner cannot change own role");
        return;
    }

    let role = new_role.trim().to_string();
    if !is_valid_membership_role(&role) {
        log::error!("set_membership_role: invalid role");
        return;
    }

    if role == MEMBERSHIP_ROLE_OWNER {
        log::error!("set_membership_role: use transfer_expedition_ownership for owner changes");
        return;
    }

    let mut target_membership = match require_active_membership(ctx, expedition_id, target_member_id)
    {
        Ok(membership) => membership,
        Err(err) => {
            log::error!("set_membership_role: {}", err);
            return;
        }
    };

    if target_membership.role == role {
        return;
    }

    let previous_role = target_membership.role.clone();
    target_membership.role = role.clone();
    let membership_id = target_membership.id;
    ctx.db.membership().id().update(target_membership);

    insert_notification(
        ctx,
        target_member_id,
        me.id,
        expedition_id,
        NOTIFICATION_EVENT_ROLE_CHANGED,
        "Your role was updated".to_string(),
        format!(
            "{} changed your role from {} to {}.",
            me.name, previous_role, role
        ),
        "membership",
        membership_id,
    );
}

#[spacetimedb::reducer]
pub fn transfer_expedition_ownership(
    ctx: &ReducerContext,
    expedition_id: u64,
    new_owner_member_id: u64,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("transfer_expedition_ownership: {}", err);
            return;
        }
    };

    if let Err(err) = require_joinable_expedition(ctx, expedition_id) {
        log::error!("transfer_expedition_ownership: {}", err);
        return;
    }

    let mut current_owner_membership = match require_membership_with_allowed_roles(
        ctx,
        expedition_id,
        me.id,
        &[MEMBERSHIP_ROLE_OWNER],
    ) {
        Ok(membership) => membership,
        Err(err) => {
            log::error!("transfer_expedition_ownership: {}", err);
            return;
        }
    };

    if new_owner_member_id == me.id {
        return;
    }

    let mut next_owner_membership = match require_active_membership(ctx, expedition_id, new_owner_member_id)
    {
        Ok(membership) => membership,
        Err(err) => {
            log::error!("transfer_expedition_ownership: {}", err);
            return;
        }
    };

    next_owner_membership.role = MEMBERSHIP_ROLE_OWNER.to_string();
    ctx.db.membership().id().update(next_owner_membership);

    current_owner_membership.role = MEMBERSHIP_ROLE_ADMIN.to_string();
    ctx.db.membership().id().update(current_owner_membership);

    insert_notification(
        ctx,
        new_owner_member_id,
        me.id,
        expedition_id,
        NOTIFICATION_EVENT_OWNERSHIP_TRANSFERRED,
        "You are now expedition owner".to_string(),
        format!("{} transferred expedition ownership to you.", me.name),
        "expedition",
        expedition_id,
    );
}

#[spacetimedb::reducer]
pub fn set_expedition_visibility(
    ctx: &ReducerContext,
    expedition_id: u64,
    visibility: String,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("set_expedition_visibility: {}", err);
            return;
        }
    };

    let mut expedition = match require_joinable_expedition(ctx, expedition_id) {
        Ok(expedition) => expedition,
        Err(err) => {
            log::error!("set_expedition_visibility: {}", err);
            return;
        }
    };

    if let Err(err) = require_membership_with_allowed_roles(
        ctx,
        expedition_id,
        me.id,
        &[MEMBERSHIP_ROLE_OWNER],
    ) {
        log::error!("set_expedition_visibility: {}", err);
        return;
    }

    let visibility = visibility.trim().to_lowercase();
    if !is_valid_expedition_visibility(&visibility) {
        log::error!("set_expedition_visibility: invalid visibility value");
        return;
    }

    let next_invite_only = visibility == EXPEDITION_VISIBILITY_INVITE_ONLY;
    if expedition.invite_only == next_invite_only {
        return;
    }

    expedition.invite_only = next_invite_only;
    ctx.db.expedition().id().update(expedition);
}

#[spacetimedb::reducer]
pub fn mark_notification_read(ctx: &ReducerContext, notification_id: u64) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("mark_notification_read: {}", err);
            return;
        }
    };

    let Some(mut notification) = ctx.db.notification().id().find(notification_id) else {
        log::error!("mark_notification_read: notification not found");
        return;
    };

    if notification.recipient_member_id != me.id {
        log::error!("mark_notification_read: cannot read another user's notification");
        return;
    }

    if notification.is_read {
        return;
    }

    notification.is_read = true;
    notification.read_at = Some(ctx.timestamp);
    ctx.db.notification().id().update(notification);
}

#[spacetimedb::reducer]
pub fn track_product_event(
    ctx: &ReducerContext,
    event_name: String,
    expedition_id: u64,
    payload_json: String,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("track_product_event: {}", err);
            bump_operational_counter(
                ctx,
                "track_product_event",
                OPERATION_STATUS_FAILURE,
                "auth.required",
            );
            return;
        }
    };

    let event_name = event_name.trim().to_string();
    if !is_valid_product_event_name(&event_name) {
        log::error!("track_product_event: invalid event_name");
        bump_operational_counter(
            ctx,
            "track_product_event",
            OPERATION_STATUS_FAILURE,
            "validation.event_name_invalid",
        );
        return;
    }

    let payload_json = payload_json.trim().to_string();
    if payload_json.len() > PRODUCT_EVENT_PAYLOAD_MAX_LEN {
        log::error!("track_product_event: payload_json too large");
        bump_operational_counter(
            ctx,
            "track_product_event",
            OPERATION_STATUS_FAILURE,
            "validation.payload_too_large",
        );
        return;
    }

    if !payload_json.is_empty() && serde_json::from_str::<serde_json::Value>(&payload_json).is_err() {
        log::error!("track_product_event: payload_json must be valid JSON");
        bump_operational_counter(
            ctx,
            "track_product_event",
            OPERATION_STATUS_FAILURE,
            "validation.payload_invalid_json",
        );
        return;
    }

    let scoped_expedition_id = if expedition_id == 0 {
        0
    } else {
        if require_active_membership(ctx, expedition_id, me.id).is_err() {
            log::error!("track_product_event: active membership required for expedition-scoped events");
            bump_operational_counter(
                ctx,
                "track_product_event",
                OPERATION_STATUS_FAILURE,
                "authz.membership_required",
            );
            return;
        }
        expedition_id
    };

    ctx.db.product_analytics_event().insert(ProductAnalyticsEvent {
        id: 0,
        event_name,
        member_id: me.id,
        expedition_id: scoped_expedition_id,
        payload_json,
        created_at: ctx.timestamp,
    });

    bump_operational_counter(
        ctx,
        "track_product_event",
        OPERATION_STATUS_SUCCESS,
        "",
    );
}

#[spacetimedb::reducer]
pub fn upsert_plan_subscription(
    ctx: &ReducerContext,
    expedition_id: u64,
    plan_code: String,
    status: String,
    seat_limit: u32,
    cancel_at_period_end: bool,
    period_start_epoch: i64,
    period_end_epoch: i64,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("upsert_plan_subscription: {}", err);
            return;
        }
    };

    if let Err(err) = require_joinable_expedition(ctx, expedition_id) {
        log::error!("upsert_plan_subscription: {}", err);
        return;
    }

    if let Err(err) = require_membership_with_allowed_roles(
        ctx,
        expedition_id,
        me.id,
        &[MEMBERSHIP_ROLE_OWNER],
    ) {
        log::error!("upsert_plan_subscription: {}", err);
        return;
    }

    let plan_code = plan_code.trim().to_string();
    if plan_code.is_empty() {
        log::error!("upsert_plan_subscription: plan_code cannot be empty");
        return;
    }

    let status = status.trim().to_lowercase();
    if !is_valid_subscription_status(&status) {
        log::error!("upsert_plan_subscription: invalid status");
        return;
    }

    if period_start_epoch > period_end_epoch {
        log::error!("upsert_plan_subscription: period_start_epoch cannot be after period_end_epoch");
        return;
    }

    let expedition_owner_key = format!("{}:{}", expedition_id, me.id);
    if let Some(mut existing) = ctx
        .db
        .plan_subscription()
        .expedition_owner_key()
        .find(expedition_owner_key.clone())
    {
        existing.plan_code = plan_code;
        existing.status = status;
        existing.seat_limit = seat_limit;
        existing.cancel_at_period_end = cancel_at_period_end;
        existing.period_start_epoch = period_start_epoch;
        existing.period_end_epoch = period_end_epoch;
        existing.updated_at = ctx.timestamp;
        ctx.db.plan_subscription().id().update(existing);
        return;
    }

    ctx.db.plan_subscription().insert(PlanSubscription {
        id: 0,
        expedition_id,
        owner_member_id: me.id,
        plan_code,
        status,
        seat_limit,
        cancel_at_period_end,
        period_start_epoch,
        period_end_epoch,
        expedition_owner_key,
        updated_at: ctx.timestamp,
    });
}

#[spacetimedb::reducer]
pub fn upsert_entitlement(
    ctx: &ReducerContext,
    expedition_id: u64,
    feature_key: String,
    enabled: bool,
    limit_value: u32,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("upsert_entitlement: {}", err);
            return;
        }
    };

    if let Err(err) = require_joinable_expedition(ctx, expedition_id) {
        log::error!("upsert_entitlement: {}", err);
        return;
    }

    if let Err(err) = require_membership_with_allowed_roles(
        ctx,
        expedition_id,
        me.id,
        &[MEMBERSHIP_ROLE_OWNER],
    ) {
        log::error!("upsert_entitlement: {}", err);
        return;
    }

    let feature_key = feature_key.trim().to_string();
    if feature_key.is_empty() {
        log::error!("upsert_entitlement: feature_key cannot be empty");
        return;
    }

    let expedition_feature_key = format!("{}:{}", expedition_id, feature_key);
    if let Some(mut existing) = ctx
        .db
        .entitlement()
        .expedition_feature_key()
        .find(expedition_feature_key.clone())
    {
        existing.enabled = enabled;
        existing.limit_value = limit_value;
        existing.updated_at = ctx.timestamp;
        ctx.db.entitlement().id().update(existing);
        return;
    }

    ctx.db.entitlement().insert(Entitlement {
        id: 0,
        expedition_id,
        feature_key,
        enabled,
        limit_value,
        expedition_feature_key,
        updated_at: ctx.timestamp,
    });
}

#[spacetimedb::reducer]
pub fn create_invite(ctx: &ReducerContext, expedition_id: u64, ttl_minutes: u32, max_uses: u32) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("create_invite: {}", err);
            return;
        }
    };

    let expedition = match require_joinable_expedition(ctx, expedition_id) {
        Ok(expedition) => expedition,
        Err(err) => {
            log::error!("create_invite: {}", err);
            return;
        }
    };

    let membership = match require_membership_with_allowed_roles(
        ctx,
        expedition.id,
        me.id,
        &[MEMBERSHIP_ROLE_OWNER, MEMBERSHIP_ROLE_ADMIN],
    ) {
        Ok(membership) => membership,
        Err(err) => {
            log::error!("create_invite: {}", err);
            return;
        }
    };

    if !is_invite_manager_role(&membership.role) {
        log::error!("create_invite: only owner or admin can create invites");
        return;
    }

    if ttl_minutes == 0 || ttl_minutes > 43_200 {
        log::error!("create_invite: ttl_minutes must be in range 1..=43200");
        return;
    }

    if max_uses == 0 || max_uses > 10_000 {
        log::error!("create_invite: max_uses must be in range 1..=10000");
        return;
    }

    let now_epoch = now_epoch_seconds(ctx);
    let expires_at_epoch = now_epoch.saturating_add((ttl_minutes as i64) * 60);
    let token = create_unique_invite_token(ctx, expedition.id, me.id);

    ctx.db.invite().insert(Invite {
        id: 0,
        token,
        expedition_id: expedition.id,
        created_by_member_id: me.id,
        max_uses,
        used_count: 0,
        expires_at_epoch,
        created_at: ctx.timestamp,
        last_used_at: None,
        revoked_at: None,
    });

    notify_active_members_except(
        ctx,
        expedition.id,
        me.id,
        NOTIFICATION_EVENT_INVITE_CREATED,
        "New invite link created".to_string(),
        format!("{} created an invite link (max uses: {}).", me.name, max_uses),
        "expedition",
        expedition.id,
    );
}

#[spacetimedb::reducer]
pub fn accept_invite(ctx: &ReducerContext, token: String) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("accept_invite: {}", err);
            bump_operational_counter(
                ctx,
                "accept_invite",
                OPERATION_STATUS_FAILURE,
                "auth.required",
            );
            return;
        }
    };

    let token = token.trim().to_string();
    if token.is_empty() {
        log::error!("accept_invite: token cannot be empty");
        bump_operational_counter(
            ctx,
            "accept_invite",
            OPERATION_STATUS_FAILURE,
            "validation.token_empty",
        );
        return;
    }

    let mut invite = match ctx.db.invite().token().find(token) {
        Some(invite) => invite,
        None => {
            log::error!("accept_invite: invite not found");
            bump_operational_counter(
                ctx,
                "accept_invite",
                OPERATION_STATUS_FAILURE,
                "invite.not_found",
            );
            return;
        }
    };

    if invite.revoked_at.is_some() {
        log::error!("accept_invite: invite has been revoked");
        bump_operational_counter(
            ctx,
            "accept_invite",
            OPERATION_STATUS_FAILURE,
            "invite.revoked",
        );
        return;
    }

    let now_epoch = now_epoch_seconds(ctx);
    if invite.expires_at_epoch <= now_epoch {
        log::error!("accept_invite: invite has expired");
        bump_operational_counter(
            ctx,
            "accept_invite",
            OPERATION_STATUS_FAILURE,
            "invite.expired",
        );
        return;
    }

    if invite.used_count >= invite.max_uses {
        log::error!("accept_invite: invite usage limit reached");
        bump_operational_counter(
            ctx,
            "accept_invite",
            OPERATION_STATUS_FAILURE,
            "invite.limit_reached",
        );
        return;
    }

    let expedition = match require_joinable_expedition(ctx, invite.expedition_id) {
        Ok(expedition) => expedition,
        Err(err) => {
            log::error!("accept_invite: {}", err);
            bump_operational_counter(
                ctx,
                "accept_invite",
                OPERATION_STATUS_FAILURE,
                "expedition.invalid",
            );
            return;
        }
    };

    if find_active_membership(ctx, expedition.id, me.id).is_none() {
        if let Err(err) = require_member_capacity(ctx, expedition.id) {
            log::error!("accept_invite: {}", err);
            bump_operational_counter(
                ctx,
                "accept_invite",
                OPERATION_STATUS_FAILURE,
                "capacity.limit_reached",
            );
            return;
        }

        let expedition_member_key = format!("{}:{}", expedition.id, me.id);
        if let Some(mut membership) = ctx
            .db
            .membership()
            .expedition_member_key()
            .find(expedition_member_key.clone())
        {
            membership.status = "active".to_string();
            membership.joined_at = ctx.timestamp;
            membership.left_at = None;
            ctx.db.membership().id().update(membership);
        } else {
            ctx.db.membership().insert(Membership {
                id: 0,
                expedition_id: expedition.id,
                member_id: me.id,
                role: MEMBERSHIP_ROLE_MEMBER.to_string(),
                status: "active".to_string(),
                joined_at: ctx.timestamp,
                left_at: None,
                expedition_member_key,
            });
        }
    }

    invite.used_count = invite.used_count.saturating_add(1);
    invite.last_used_at = Some(ctx.timestamp);
    ctx.db.invite().id().update(invite);

    notify_active_members_except(
        ctx,
        expedition.id,
        me.id,
        NOTIFICATION_EVENT_INVITE_ACCEPTED,
        "A member joined".to_string(),
        format!("{} joined the expedition using an invite.", me.name),
        "expedition",
        expedition.id,
    );

    bump_operational_counter(ctx, "accept_invite", OPERATION_STATUS_SUCCESS, "");
}

#[spacetimedb::reducer]
pub fn revoke_invite(ctx: &ReducerContext, token: String) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("revoke_invite: {}", err);
            return;
        }
    };

    let token = token.trim().to_string();
    if token.is_empty() {
        log::error!("revoke_invite: token cannot be empty");
        return;
    }

    let mut invite = match ctx.db.invite().token().find(token) {
        Some(invite) => invite,
        None => {
            log::error!("revoke_invite: invite not found");
            return;
        }
    };

    let membership = match require_membership_with_allowed_roles(
        ctx,
        invite.expedition_id,
        me.id,
        &[MEMBERSHIP_ROLE_OWNER, MEMBERSHIP_ROLE_ADMIN],
    ) {
        Ok(membership) => membership,
        Err(err) => {
            log::error!("revoke_invite: {}", err);
            return;
        }
    };

    if !is_invite_manager_role(&membership.role) {
        log::error!("revoke_invite: only owner or admin can revoke invites");
        return;
    }

    if invite.revoked_at.is_some() {
        return;
    }

    let expedition_id = invite.expedition_id;
    invite.revoked_at = Some(ctx.timestamp);
    ctx.db.invite().id().update(invite);

    notify_active_members_except(
        ctx,
        expedition_id,
        me.id,
        NOTIFICATION_EVENT_INVITE_REVOKED,
        "Invite link revoked".to_string(),
        format!("{} revoked an invite link.", me.name),
        "expedition",
        expedition_id,
    );
}

#[spacetimedb::reducer]
pub fn ops_backfill_legacy_expedition(ctx: &ReducerContext, owner_member_id: u64) {
    let expedition_count = ctx.db.expedition().iter().count();
    let membership_count = ctx.db.membership().iter().count();
    if expedition_count > 0 || membership_count > 0 {
        log::error!(
            "ops_backfill_legacy_expedition: migration is one-time only and requires empty expedition/membership tables"
        );
        return;
    }

    if ctx.db.member().id().find(owner_member_id).is_none() {
        log::error!(
            "ops_backfill_legacy_expedition: owner_member_id {} not found",
            owner_member_id
        );
        return;
    }

    if ctx
        .db
        .expedition()
        .slug()
        .find(LEGACY_DEFAULT_EXPEDITION_SLUG.to_string())
        .is_none()
    {
        ctx.db.expedition().insert(Expedition {
            id: 0,
            name: LEGACY_DEFAULT_EXPEDITION_NAME.to_string(),
            slug: LEGACY_DEFAULT_EXPEDITION_SLUG.to_string(),
            created_by_member_id: owner_member_id,
            is_archived: false,
            created_at: ctx.timestamp,
            archived_at: None,
            invite_only: false,
            route_template_key: Some(ROUTE_TEMPLATE_CLASSIC_TRAIL.to_string()),
        });
    }

    let Some(mut expedition) = ctx
        .db
        .expedition()
        .slug()
        .find(LEGACY_DEFAULT_EXPEDITION_SLUG.to_string())
    else {
        log::error!("ops_backfill_legacy_expedition: failed to resolve legacy expedition");
        return;
    };

    let expedition_id = expedition.id;

    let mut should_update_expedition = false;
    if expedition.is_archived {
        expedition.is_archived = false;
        expedition.archived_at = None;
        should_update_expedition = true;
    }

    if expedition.route_template_key.is_none() {
        expedition.route_template_key = Some(ROUTE_TEMPLATE_CLASSIC_TRAIL.to_string());
        should_update_expedition = true;
    }

    if should_update_expedition {
        ctx.db.expedition().id().update(expedition);
    }

    let all_member_ids: Vec<u64> = ctx.db.member().iter().map(|member| member.id).collect();
    for member_id in all_member_ids {
        let expedition_member_key = format!("{}:{}", expedition_id, member_id);
        let expected_role = if member_id == owner_member_id {
            MEMBERSHIP_ROLE_OWNER.to_string()
        } else {
            MEMBERSHIP_ROLE_MEMBER.to_string()
        };

        if let Some(mut membership) = ctx
            .db
            .membership()
            .expedition_member_key()
            .find(expedition_member_key.clone())
        {
            membership.status = "active".to_string();
            membership.left_at = None;
            membership.joined_at = ctx.timestamp;
            membership.role = expected_role;
            ctx.db.membership().id().update(membership);
        } else {
            ctx.db.membership().insert(Membership {
                id: 0,
                expedition_id,
                member_id,
                role: expected_role,
                status: "active".to_string(),
                joined_at: ctx.timestamp,
                left_at: None,
                expedition_member_key,
            });
        }
    }

    let activity_ids_to_backfill: Vec<u64> = ctx
        .db
        .activity_log()
        .iter()
        .filter(|activity| activity.expedition_id == 0)
        .map(|activity| activity.id)
        .collect();

    for activity_id in activity_ids_to_backfill {
        if let Some(mut activity) = ctx.db.activity_log().id().find(activity_id) {
            activity.expedition_id = expedition_id;
            ctx.db.activity_log().id().update(activity);
        }
    }

    let comment_ids: Vec<u64> = ctx.db.comment().iter().map(|comment| comment.id).collect();
    for comment_id in comment_ids {
        if let Some(mut comment) = ctx.db.comment().id().find(comment_id) {
            let parent_expedition_id = ctx
                .db
                .activity_log()
                .id()
                .find(comment.log_id)
                .map(|activity| activity.expedition_id)
                .unwrap_or(expedition_id);
            if comment.expedition_id != parent_expedition_id {
                comment.expedition_id = parent_expedition_id;
                ctx.db.comment().id().update(comment);
            }
        }
    }

    let reaction_ids: Vec<u64> = ctx.db.reaction().iter().map(|reaction| reaction.id).collect();
    for reaction_id in reaction_ids {
        if let Some(mut reaction) = ctx.db.reaction().id().find(reaction_id) {
            let parent_expedition_id = ctx
                .db
                .activity_log()
                .id()
                .find(reaction.log_id)
                .map(|activity| activity.expedition_id)
                .unwrap_or(expedition_id);
            if reaction.expedition_id != parent_expedition_id {
                reaction.expedition_id = parent_expedition_id;
                ctx.db.reaction().id().update(reaction);
            }
        }
    }
}

#[spacetimedb::reducer]
pub fn create_public_challenge(
    ctx: &ReducerContext,
    slug: String,
    title: String,
    route_target_km: f64,
    capacity: u32,
    start_epoch: i64,
    end_epoch: i64,
    registration_closes_epoch: i64,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("create_public_challenge: {}", err);
            return;
        }
    };

    if !has_challenge_admin_scope(ctx, me.id) {
        log::error!("create_public_challenge: admin scope required");
        return;
    }

    let slug = slug.trim().to_string();
    if !is_valid_slug(&slug) {
        log::error!("create_public_challenge: invalid slug");
        return;
    }

    let title = title.trim().to_string();
    if title.is_empty() {
        log::error!("create_public_challenge: title cannot be empty");
        return;
    }

    if route_target_km <= 0.0 {
        log::error!("create_public_challenge: route_target_km must be > 0");
        return;
    }

    if capacity == 0 {
        log::error!("create_public_challenge: capacity must be > 0");
        return;
    }

    if start_epoch >= end_epoch {
        log::error!("create_public_challenge: invalid time window");
        return;
    }

    if registration_closes_epoch > start_epoch {
        log::error!("create_public_challenge: registration must close before start");
        return;
    }

    if ctx.db.public_challenge().slug().find(slug.clone()).is_some() {
        log::error!("create_public_challenge: slug already exists");
        return;
    }

    ctx.db.public_challenge().insert(PublicChallenge {
        id: 0,
        slug,
        title,
        route_target_km,
        capacity,
        start_epoch,
        end_epoch,
        registration_closes_epoch,
        status: CHALLENGE_STATUS_SCHEDULED.to_string(),
        created_by_member_id: me.id,
        created_at: ctx.timestamp,
        closed_at: None,
    });
}

#[spacetimedb::reducer]
pub fn join_public_challenge(ctx: &ReducerContext, challenge_id: u64) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("join_public_challenge: {}", err);
            return;
        }
    };

    let mut challenge = match require_challenge(ctx, challenge_id) {
        Ok(challenge) => challenge,
        Err(err) => {
            log::error!("join_public_challenge: {}", err);
            return;
        }
    };

    let now_epoch = now_epoch_seconds(ctx);
    challenge.status = infer_challenge_status(now_epoch, &challenge);
    if challenge.status == CHALLENGE_STATUS_CLOSED {
        log::error!("join_public_challenge: challenge closed");
        return;
    }

    if now_epoch > challenge.registration_closes_epoch {
        log::error!("join_public_challenge: registration closed");
        return;
    }

    if find_challenge_participant(ctx, challenge.id, me.id).is_some() {
        return;
    }

    let participant_count = ctx
        .db
        .public_challenge_participant()
        .iter()
        .filter(|row| row.challenge_id == challenge.id)
        .count() as u32;

    if participant_count >= challenge.capacity {
        log::error!("join_public_challenge: challenge is full");
        return;
    }

    ctx.db
        .public_challenge_participant()
        .insert(PublicChallengeParticipant {
            id: 0,
            challenge_id: challenge.id,
            member_id: me.id,
            joined_at: ctx.timestamp,
            completion_state: CHALLENGE_PARTICIPATION_JOINED.to_string(),
            total_distance_km: 0.0,
            flag_count: 0,
            is_disqualified: false,
            challenge_member_key: challenge_member_key(challenge.id, me.id),
        });
}

#[spacetimedb::reducer]
pub fn submit_challenge_activity(
    ctx: &ReducerContext,
    challenge_id: u64,
    activity_type: String,
    distance_km: f64,
    duration_minutes: f64,
    occurred_at_epoch: i64,
    note: String,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("submit_challenge_activity: {}", err);
            return;
        }
    };

    let mut challenge = match require_challenge(ctx, challenge_id) {
        Ok(challenge) => challenge,
        Err(err) => {
            log::error!("submit_challenge_activity: {}", err);
            return;
        }
    };

    let mut participant = match find_challenge_participant(ctx, challenge.id, me.id) {
        Some(participant) => participant,
        None => {
            log::error!("submit_challenge_activity: challenge participant required");
            return;
        }
    };

    if participant.is_disqualified {
        log::error!("submit_challenge_activity: participant disqualified");
        return;
    }

    let normalized_activity_type = activity_type.trim().to_lowercase();
    if !is_valid_challenge_activity_type(&normalized_activity_type) {
        log::error!("submit_challenge_activity: invalid activity type");
        return;
    }

    if distance_km <= 0.0 || duration_minutes <= 0.0 {
        log::error!("submit_challenge_activity: distance and duration must be > 0");
        return;
    }

    if occurred_at_epoch < challenge.start_epoch || occurred_at_epoch > challenge.end_epoch {
        log::error!("submit_challenge_activity: occurred time outside challenge window");
        return;
    }

    let now_epoch = now_epoch_seconds(ctx);
    challenge.status = infer_challenge_status(now_epoch, &challenge);
    if challenge.status == CHALLENGE_STATUS_CLOSED {
        log::error!("submit_challenge_activity: challenge closed");
        return;
    }

    let has_duplicate = ctx
        .db
        .challenge_activity_log()
        .iter()
        .any(|row| {
            row.challenge_id == challenge.id
                && row.member_id == me.id
                && row.activity_type == normalized_activity_type
                && (row.distance_km - distance_km).abs() < 0.001
                && (row.duration_minutes - duration_minutes).abs() < 0.1
                && (row.occurred_at_epoch - occurred_at_epoch).abs() <= 600
        });
    if has_duplicate {
        log::error!("submit_challenge_activity: duplicate submission fingerprint");
        return;
    }

    let pace_min_per_km = duration_minutes / distance_km;
    let mut flags: Vec<String> = Vec::new();
    let mut risk_score: u32 = 0;

    if let Some(pace_flag) = pace_flag_for_activity(&normalized_activity_type, pace_min_per_km) {
        flags.push(pace_flag.to_string());
        risk_score = risk_score.saturating_add(40);
    }

    if challenge.route_target_km > 0.0 && distance_km > (challenge.route_target_km * 0.35) {
        flags.push("distance_jump".to_string());
        risk_score = risk_score.saturating_add(25);
    }

    let occurred_day = occurred_at_epoch / 86_400;
    let occurred_day_start = occurred_day * 86_400;
    let occurred_day_end = occurred_day_start + 86_400;
    let today_distance_total = ctx
        .db
        .challenge_activity_log()
        .iter()
        .filter(|row| {
            row.member_id == me.id
                && row.occurred_at_epoch >= occurred_day_start
                && row.occurred_at_epoch < occurred_day_end
                && row.status != CHALLENGE_ACTIVITY_STATUS_EXCLUDED
        })
        .map(|row| row.distance_km)
        .sum::<f64>()
        + distance_km;

    if let Some(median) = compute_trailing_median_daily_distance(ctx, me.id, occurred_at_epoch) {
        if median > 0.0 && today_distance_total > (median * 4.0) {
            flags.push("daily_spike".to_string());
            risk_score = risk_score.saturating_add(25);
        }
    } else if today_distance_total > 120.0 {
        flags.push("daily_spike".to_string());
        risk_score = risk_score.saturating_add(25);
    }

    let near_identical_count = count_near_identical_logs_in_24h(
        ctx,
        challenge.id,
        me.id,
        distance_km,
        duration_minutes,
        occurred_at_epoch,
    );
    if near_identical_count >= 2 {
        flags.push("pattern_anomaly".to_string());
        risk_score = risk_score.saturating_add(20);
    }

    let status = if flags.is_empty() {
        CHALLENGE_ACTIVITY_STATUS_ACCEPTED.to_string()
    } else {
        CHALLENGE_ACTIVITY_STATUS_FLAGGED.to_string()
    };
    let flags_csv = flags.join(",");

    ctx.db.challenge_activity_log().insert(ChallengeActivityLog {
        id: 0,
        challenge_id: challenge.id,
        member_id: me.id,
        participant_id: participant.id,
        activity_type: normalized_activity_type,
        distance_km,
        duration_minutes,
        occurred_at_epoch,
        status: status.clone(),
        risk_score,
        flags_csv: flags_csv.clone(),
        note: note.trim().to_string(),
        submitted_at: ctx.timestamp,
    });

    let inserted_log_id = ctx
        .db
        .challenge_activity_log()
        .iter()
        .filter(|row| {
            row.challenge_id == challenge.id
                && row.member_id == me.id
                && row.participant_id == participant.id
                && row.occurred_at_epoch == occurred_at_epoch
        })
        .map(|row| row.id)
        .max()
        .unwrap_or(0);

    if !flags.is_empty() {
        ctx.db.challenge_integrity_event().insert(ChallengeIntegrityEvent {
            id: 0,
            challenge_id: challenge.id,
            challenge_activity_log_id: inserted_log_id,
            member_id: me.id,
            risk_score,
            flags_csv,
            action: CHALLENGE_INTEGRITY_ACTION_AUTO_FLAG.to_string(),
            reason_enum: "heuristic_triggered".to_string(),
            created_at: ctx.timestamp,
            moderator_member_id: None,
        });
        participant.flag_count = participant.flag_count.saturating_add(1);
    }

    participant.total_distance_km += distance_km;
    if participant.total_distance_km >= challenge.route_target_km {
        participant.completion_state = CHALLENGE_PARTICIPATION_COMPLETED.to_string();
    }

    ctx.db
        .public_challenge_participant()
        .id()
        .update(participant);
}

#[spacetimedb::reducer]
pub fn moderate_integrity_event(
    ctx: &ReducerContext,
    integrity_event_id: u64,
    action: String,
    reason_enum: String,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("moderate_integrity_event: {}", err);
            return;
        }
    };

    if !has_challenge_admin_scope(ctx, me.id) {
        log::error!("moderate_integrity_event: admin scope required");
        return;
    }

    let event = match ctx.db.challenge_integrity_event().id().find(integrity_event_id) {
        Some(event) => event,
        None => {
            log::error!("moderate_integrity_event: integrity event not found");
            return;
        }
    };

    let mut activity = match ctx
        .db
        .challenge_activity_log()
        .id()
        .find(event.challenge_activity_log_id)
    {
        Some(activity) => activity,
        None => {
            log::error!("moderate_integrity_event: challenge activity log missing");
            return;
        }
    };

    let normalized_action = action.trim().to_lowercase();
    if !is_valid_challenge_integrity_action(&normalized_action) {
        log::error!("moderate_integrity_event: invalid action");
        return;
    }

    let mut participant = match ctx
        .db
        .public_challenge_participant()
        .id()
        .find(activity.participant_id)
    {
        Some(participant) => participant,
        None => {
            log::error!("moderate_integrity_event: participant missing");
            return;
        }
    };

    if normalized_action == CHALLENGE_INTEGRITY_ACTION_CONFIRM {
        activity.status = CHALLENGE_ACTIVITY_STATUS_CONFIRMED.to_string();
    }

    if normalized_action == CHALLENGE_INTEGRITY_ACTION_EXCLUDE {
        if activity.status != CHALLENGE_ACTIVITY_STATUS_EXCLUDED {
            if participant.total_distance_km >= activity.distance_km {
                participant.total_distance_km -= activity.distance_km;
            } else {
                participant.total_distance_km = 0.0;
            }
            activity.status = CHALLENGE_ACTIVITY_STATUS_EXCLUDED.to_string();
        }
    }

    if normalized_action == CHALLENGE_INTEGRITY_ACTION_REQUEST_EVIDENCE {
        activity.status = CHALLENGE_ACTIVITY_STATUS_FLAGGED.to_string();
    }

    let activity_challenge_id = activity.challenge_id;
    ctx.db.challenge_activity_log().id().update(activity);

    let challenge_route_target = ctx
        .db
        .public_challenge()
        .id()
        .find(activity_challenge_id)
        .map(|challenge| challenge.route_target_km)
        .unwrap_or(f64::MAX);

    if participant.total_distance_km >= challenge_route_target {
        participant.completion_state = CHALLENGE_PARTICIPATION_COMPLETED.to_string();
    } else {
        participant.completion_state = CHALLENGE_PARTICIPATION_JOINED.to_string();
    }

    ctx.db
        .public_challenge_participant()
        .id()
        .update(participant);

    ctx.db.challenge_integrity_event().insert(ChallengeIntegrityEvent {
        id: 0,
        challenge_id: event.challenge_id,
        challenge_activity_log_id: event.challenge_activity_log_id,
        member_id: event.member_id,
        risk_score: event.risk_score,
        flags_csv: event.flags_csv,
        action: normalized_action,
        reason_enum: reason_enum.trim().to_string(),
        created_at: ctx.timestamp,
        moderator_member_id: Some(me.id),
    });
}

#[spacetimedb::reducer]
pub fn close_challenge_standings(ctx: &ReducerContext, challenge_id: u64) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("close_challenge_standings: {}", err);
            return;
        }
    };

    if !has_challenge_admin_scope(ctx, me.id) {
        log::error!("close_challenge_standings: admin scope required");
        return;
    }

    let mut challenge = match require_challenge(ctx, challenge_id) {
        Ok(challenge) => challenge,
        Err(err) => {
            log::error!("close_challenge_standings: {}", err);
            return;
        }
    };

    let now_epoch = now_epoch_seconds(ctx);
    if now_epoch < challenge.end_epoch + (24 * 60 * 60) {
        log::error!("close_challenge_standings: challenge closeout window not reached");
        return;
    }

    challenge.status = CHALLENGE_STATUS_CLOSED.to_string();
    challenge.closed_at = Some(ctx.timestamp);
    let challenge_snapshot = PublicChallenge {
        id: challenge.id,
        slug: challenge.slug.clone(),
        title: challenge.title.clone(),
        route_target_km: challenge.route_target_km,
        capacity: challenge.capacity,
        start_epoch: challenge.start_epoch,
        end_epoch: challenge.end_epoch,
        registration_closes_epoch: challenge.registration_closes_epoch,
        status: challenge.status.clone(),
        created_by_member_id: challenge.created_by_member_id,
        created_at: challenge.created_at,
        closed_at: challenge.closed_at,
    };
    ctx.db.public_challenge().id().update(challenge);
    apply_challenge_closeout(ctx, &challenge_snapshot);
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
    #[default(0u64)]
    pub expedition_id: u64,
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
            bump_operational_counter(
                ctx,
                "log_activity",
                OPERATION_STATUS_FAILURE,
                "auth.required",
            );
            return;
        }
    };

    let Some(me) = ctx.db.member().owner_sub().find(owner_sub) else {
        log::error!("log_activity: profile not found for authenticated user");
        bump_operational_counter(
            ctx,
            "log_activity",
            OPERATION_STATUS_FAILURE,
            "member.missing",
        );
        return;
    };

    if me.id != member_id {
        log::error!("log_activity: you can only log activity for your own profile");
        bump_operational_counter(
            ctx,
            "log_activity",
            OPERATION_STATUS_FAILURE,
            "authz.member_mismatch",
        );
        return;
    }

    let valid_types = ["run", "row", "walk", "cycle"];
    if !valid_types.contains(&activity_type.as_str()) {
        log::error!("log_activity: invalid activity_type: {}", activity_type);
        bump_operational_counter(
            ctx,
            "log_activity",
            OPERATION_STATUS_FAILURE,
            "validation.activity_type_invalid",
        );
        return;
    }
    if distance_km <= 0.0 || distance_km > 500.0 {
        log::error!("log_activity: distance_km out of range: {}", distance_km);
        bump_operational_counter(
            ctx,
            "log_activity",
            OPERATION_STATUS_FAILURE,
            "validation.distance_out_of_range",
        );
        return;
    }

    let target_expedition_ids: Vec<u64> = ctx
        .db
        .membership()
        .iter()
        .filter(|membership| {
            membership.member_id == me.id
                && membership.status == "active"
                && membership.left_at.is_none()
                && membership.joined_at <= ctx.timestamp
        })
        .filter_map(|membership| {
            ctx.db
                .expedition()
                .id()
                .find(membership.expedition_id)
                .filter(|expedition| !expedition.is_archived)
                .map(|expedition| expedition.id)
        })
        .collect();

    if target_expedition_ids.is_empty() {
        log::error!("log_activity: no active expedition memberships available for this member");
        bump_operational_counter(
            ctx,
            "log_activity",
            OPERATION_STATUS_FAILURE,
            "authz.no_active_expeditions",
        );
        return;
    }

    let actor_name = me.name.clone();
    let milestone_activity_type = activity_type.clone();
    let note = note.trim().to_string();

    for expedition_id in target_expedition_ids {
        ctx.db.activity_log().insert(ActivityLog {
            id: 0,
            expedition_id,
            member_id,
            person_name: actor_name.clone(),
            activity_type: activity_type.clone(),
            distance_km,
            note: note.clone(),
            timestamp: ctx.timestamp,
            ai_response: String::new(),
        });

        if let Some(label) = milestone_label(distance_km) {
            notify_active_members_except(
                ctx,
                expedition_id,
                me.id,
                NOTIFICATION_EVENT_ACTIVITY_MILESTONE,
                "New activity milestone".to_string(),
                format!(
                    "{} logged a {} {} activity.",
                    actor_name, label, milestone_activity_type
                ),
                "expedition",
                expedition_id,
            );
        }
    }

    bump_operational_counter(ctx, "log_activity", OPERATION_STATUS_SUCCESS, "");
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
    #[default(0u64)]
    pub expedition_id: u64,
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

    let Some(activity) = ctx.db.activity_log().id().find(log_id) else {
        log::error!("add_reaction: activity log not found");
        return;
    };

    if activity.expedition_id != 0
        && require_active_membership(ctx, activity.expedition_id, me.id).is_err()
    {
        log::error!(
            "add_reaction: active membership required for parent activity expedition"
        );
        return;
    }

    let emoji = emoji.trim().to_string();
    if emoji.is_empty() {
        log::error!("add_reaction: emoji required");
        return;
    }

    let actor_name = me.name.clone();
    let reaction_emoji = emoji.clone();

    ctx.db.reaction().insert(Reaction {
        id: 0,
        expedition_id: activity.expedition_id,
        log_id,
        emoji,
        reacted_by: actor_name.clone(),
        timestamp: ctx.timestamp,
    });

    if activity.member_id != 0 && activity.member_id != me.id {
        insert_notification(
            ctx,
            activity.member_id,
            me.id,
            activity.expedition_id,
            NOTIFICATION_EVENT_REACTION_ADDED,
            "Someone reacted to your activity".to_string(),
            format!("{} reacted with {}.", actor_name, reaction_emoji),
            "activity_log",
            activity.id,
        );
    }
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
    #[default(0u64)]
    pub expedition_id: u64,
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

    let Some(activity) = ctx.db.activity_log().id().find(log_id) else {
        log::error!("add_comment: activity log not found");
        return;
    };

    if activity.expedition_id != 0
        && require_active_membership(ctx, activity.expedition_id, me.id).is_err()
    {
        log::error!(
            "add_comment: active membership required for parent activity expedition"
        );
        return;
    }

    let body = body.trim().to_string();
    if body.is_empty() {
        log::error!("add_comment: body cannot be empty");
        return;
    }

    let actor_name = me.name.clone();

    ctx.db.comment().insert(Comment {
        id: 0,
        expedition_id: activity.expedition_id,
        log_id,
        author: actor_name.clone(),
        body,
        timestamp: ctx.timestamp,
    });

    if activity.member_id != 0 && activity.member_id != me.id {
        insert_notification(
            ctx,
            activity.member_id,
            me.id,
            activity.expedition_id,
            NOTIFICATION_EVENT_COMMENT_ADDED,
            "New comment on your activity".to_string(),
            format!("{} commented on your activity.", actor_name),
            "activity_log",
            activity.id,
        );
    }
}

#[spacetimedb::reducer]
pub fn report_activity_abuse(
    ctx: &ReducerContext,
    log_id: u64,
    reason: String,
    details: String,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("report_activity_abuse: {}", err);
            return;
        }
    };

    let Some(activity) = ctx.db.activity_log().id().find(log_id) else {
        log::error!("report_activity_abuse: activity log not found");
        return;
    };

    if let Err(err) = require_active_membership(ctx, activity.expedition_id, me.id) {
        log::error!("report_activity_abuse: {}", err);
        return;
    }

    let reason = reason.trim().to_string();
    if reason.is_empty() {
        log::error!("report_activity_abuse: reason cannot be empty");
        return;
    }

    let details = details.trim().to_string();

    ctx.db.abuse_report().insert(AbuseReport {
        id: 0,
        expedition_id: activity.expedition_id,
        reported_by_member_id: me.id,
        target_type: ABUSE_TARGET_ACTIVITY_LOG.to_string(),
        target_id: activity.id,
        reason,
        details,
        status: ABUSE_STATUS_OPEN.to_string(),
        created_at: ctx.timestamp,
        reviewed_at: None,
        reviewed_by_member_id: None,
        resolution_note: String::new(),
    });
}

#[spacetimedb::reducer]
pub fn report_comment_abuse(
    ctx: &ReducerContext,
    comment_id: u64,
    reason: String,
    details: String,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("report_comment_abuse: {}", err);
            return;
        }
    };

    let Some(comment) = ctx.db.comment().id().find(comment_id) else {
        log::error!("report_comment_abuse: comment not found");
        return;
    };

    if let Err(err) = require_active_membership(ctx, comment.expedition_id, me.id) {
        log::error!("report_comment_abuse: {}", err);
        return;
    }

    let reason = reason.trim().to_string();
    if reason.is_empty() {
        log::error!("report_comment_abuse: reason cannot be empty");
        return;
    }

    let details = details.trim().to_string();

    ctx.db.abuse_report().insert(AbuseReport {
        id: 0,
        expedition_id: comment.expedition_id,
        reported_by_member_id: me.id,
        target_type: ABUSE_TARGET_COMMENT.to_string(),
        target_id: comment.id,
        reason,
        details,
        status: ABUSE_STATUS_OPEN.to_string(),
        created_at: ctx.timestamp,
        reviewed_at: None,
        reviewed_by_member_id: None,
        resolution_note: String::new(),
    });
}

#[spacetimedb::reducer]
pub fn review_abuse_report(
    ctx: &ReducerContext,
    report_id: u64,
    action: String,
    note: String,
) {
    let me = match require_authenticated_member(ctx) {
        Ok(member) => member,
        Err(err) => {
            log::error!("review_abuse_report: {}", err);
            return;
        }
    };

    let mut report = match ctx.db.abuse_report().id().find(report_id) {
        Some(report) => report,
        None => {
            log::error!("review_abuse_report: report not found");
            return;
        }
    };

    if let Err(err) = require_membership_with_allowed_roles(
        ctx,
        report.expedition_id,
        me.id,
        &[MEMBERSHIP_ROLE_OWNER, MEMBERSHIP_ROLE_ADMIN],
    ) {
        log::error!("review_abuse_report: {}", err);
        return;
    }

    let action = action.trim().to_lowercase();
    if !is_valid_moderation_action(&action) {
        log::error!("review_abuse_report: invalid moderation action");
        return;
    }

    if !is_valid_abuse_target(&report.target_type) {
        log::error!("review_abuse_report: invalid report target type");
        return;
    }

    if action == MODERATION_ACTION_HIDE {
        if report.target_type == ABUSE_TARGET_ACTIVITY_LOG {
            let Some(mut activity) = ctx.db.activity_log().id().find(report.target_id) else {
                log::error!("review_abuse_report: target activity missing");
                return;
            };

            activity.note = "[hidden by moderator]".to_string();
            activity.ai_response = String::new();
            ctx.db.activity_log().id().update(activity);
        } else if report.target_type == ABUSE_TARGET_COMMENT {
            let Some(mut comment) = ctx.db.comment().id().find(report.target_id) else {
                log::error!("review_abuse_report: target comment missing");
                return;
            };

            comment.body = "[hidden by moderator]".to_string();
            ctx.db.comment().id().update(comment);
        }
    }

    if action == MODERATION_ACTION_REMOVE {
        if report.target_type == ABUSE_TARGET_ACTIVITY_LOG {
            ctx.db.activity_log().id().delete(report.target_id);
        } else if report.target_type == ABUSE_TARGET_COMMENT {
            ctx.db.comment().id().delete(report.target_id);
        }
    }

    let resolution_note = note.trim().to_string();
    let report_expedition_id = report.expedition_id;
    let report_target_type = report.target_type.clone();
    let report_target_id = report.target_id;
    let report_id_value = report.id;

    report.status = ABUSE_STATUS_REVIEWED.to_string();
    report.reviewed_at = Some(ctx.timestamp);
    report.reviewed_by_member_id = Some(me.id);
    report.resolution_note = resolution_note.clone();
    ctx.db.abuse_report().id().update(report);

    ctx.db.moderation_audit().insert(ModerationAudit {
        id: 0,
        expedition_id: report_expedition_id,
        report_id: report_id_value,
        moderator_member_id: me.id,
        action,
        target_type: report_target_type,
        target_id: report_target_id,
        note: resolution_note,
        created_at: ctx.timestamp,
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
pub fn create_checkout_session(ctx: &mut ProcedureContext, expedition_id: u64) -> String {
    let owner_sub = match authenticated_subject_from_procedure(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("create_checkout_session: {}", err);
            return String::new();
        }
    };

    let Some((owner_member_id, price_id, success_url, cancel_url, stripe_secret_key)) = ctx.with_tx(|tx| {
        let member = tx.db.member().owner_sub().find(owner_sub.clone())?;
        let expedition = tx.db.expedition().id().find(expedition_id)?;
        if expedition.is_archived {
            return None;
        }

        let expedition_member_key = format!("{}:{}", expedition_id, member.id);
        let membership = tx
            .db
            .membership()
            .expedition_member_key()
            .find(expedition_member_key)?;

        if membership.status != "active" || membership.role != MEMBERSHIP_ROLE_OWNER {
            return None;
        }

        let price_id = tx.db.config().key().find(STRIPE_PRICE_ID_KEY.to_string())?.value;
        let success_url = tx.db.config().key().find(STRIPE_SUCCESS_URL_KEY.to_string())?.value;
        let cancel_url = tx.db.config().key().find(STRIPE_CANCEL_URL_KEY.to_string())?.value;
        let stripe_secret_key = tx.db.config().key().find(STRIPE_SECRET_KEY.to_string())?.value;

        Some((member.id, price_id, success_url, cancel_url, stripe_secret_key))
    }) else {
        log::error!(
            "create_checkout_session: missing owner membership, expedition, or Stripe configuration"
        );
        return String::new();
    };

    let body = format!(
        "mode=subscription&line_items[0][price]={}&line_items[0][quantity]=1&success_url={}&cancel_url={}&client_reference_id={}&metadata[expedition_id]={}&metadata[owner_member_id]={}",
        url_encode(&price_id),
        url_encode(&success_url),
        url_encode(&cancel_url),
        expedition_id,
        expedition_id,
        owner_member_id,
    );

    let request = match http::Request::builder()
        .method("POST")
        .uri(STRIPE_CHECKOUT_SESSIONS_ENDPOINT)
        .header("authorization", format!("Bearer {}", stripe_secret_key))
        .header("content-type", "application/x-www-form-urlencoded")
        .body(body)
    {
        Ok(request) => request,
        Err(err) => {
            log::error!("create_checkout_session: failed to build request: {}", err);
            return String::new();
        }
    };

    let response = match ctx.http.send(request) {
        Ok(response) => response,
        Err(err) => {
            log::error!("create_checkout_session: HTTP request failed: {}", err);
            return String::new();
        }
    };

    let (parts, body) = response.into_parts();
    let body_str = body.into_string_lossy();
    if !parts.status.is_success() {
        log::error!(
            "create_checkout_session: Stripe returned status {}: {}",
            parts.status,
            body_str
        );
        return String::new();
    }

    let checkout = match serde_json::from_str::<StripeCheckoutSessionResponse>(&body_str) {
        Ok(payload) => payload,
        Err(err) => {
            log::error!(
                "create_checkout_session: failed to parse Stripe response JSON: {}",
                err
            );
            return String::new();
        }
    };

    if checkout.url.trim().is_empty() {
        log::error!("create_checkout_session: Stripe response missing checkout URL");
        return String::new();
    }

    let expedition_owner_key = format!("{}:{}", expedition_id, owner_member_id);
    let now_ts = ctx.timestamp;
    ctx.with_tx(|tx| {
        if let Some(mut existing) = tx
            .db
            .plan_subscription()
            .expedition_owner_key()
            .find(expedition_owner_key.clone())
        {
            existing.plan_code = price_id.clone();
            existing.status = SUBSCRIPTION_STATUS_INCOMPLETE.to_string();
            existing.seat_limit = existing.seat_limit.max(1);
            existing.cancel_at_period_end = false;
            existing.period_start_epoch = existing.period_start_epoch.max(0);
            existing.period_end_epoch = existing.period_end_epoch.max(0);
            existing.updated_at = now_ts;
            tx.db.plan_subscription().id().update(existing);
            return;
        }

        tx.db.plan_subscription().insert(PlanSubscription {
            id: 0,
            expedition_id,
            owner_member_id,
            plan_code: price_id.clone(),
            status: SUBSCRIPTION_STATUS_INCOMPLETE.to_string(),
            seat_limit: 1,
            cancel_at_period_end: false,
            period_start_epoch: 0,
            period_end_epoch: 0,
            expedition_owner_key: expedition_owner_key.clone(),
            updated_at: now_ts,
        });
    });

    checkout.url
}

#[spacetimedb::procedure]
pub fn ingest_stripe_webhook(
    ctx: &mut ProcedureContext,
    payload: String,
    signature_header: String,
) {
    let Some(webhook_secret) = config_value(ctx, STRIPE_WEBHOOK_SECRET_KEY) else {
        log::error!("ingest_stripe_webhook: stripe_webhook_secret missing");
        return;
    };

    if !verify_stripe_webhook_signature(&payload, &signature_header, &webhook_secret) {
        log::error!("ingest_stripe_webhook: signature verification failed");
        return;
    }

    let event = match serde_json::from_str::<StripeWebhookEvent>(&payload) {
        Ok(event) => event,
        Err(err) => {
            log::error!("ingest_stripe_webhook: invalid event JSON: {}", err);
            return;
        }
    };

    let event_id = event.id.trim().to_string();
    if event_id.is_empty() {
        log::error!("ingest_stripe_webhook: provider event id missing");
        return;
    }

    let now_ts = ctx.timestamp;

    ctx.with_tx(|tx| {
        if tx
            .db
            .billing_webhook_event()
            .provider_event_id()
            .find(event_id.clone())
            .is_some()
        {
            return;
        }

        tx.db.billing_webhook_event().insert(BillingWebhookEvent {
            provider_event_id: event_id.clone(),
            event_type: event.kind.clone(),
            processed_at: now_ts,
        });

        let object = &event.data.object;
        let metadata = object.get("metadata");
        let expedition_id = json_u64(metadata.and_then(|meta| meta.get("expedition_id")))
            .or_else(|| json_u64(object.get("client_reference_id")));
        let owner_member_id = json_u64(metadata.and_then(|meta| meta.get("owner_member_id")));

        let (Some(expedition_id), Some(owner_member_id)) = (expedition_id, owner_member_id) else {
            return;
        };

        let expedition_owner_key = format!("{}:{}", expedition_id, owner_member_id);
        let mut subscription = tx
            .db
            .plan_subscription()
            .expedition_owner_key()
            .find(expedition_owner_key.clone())
            .unwrap_or(PlanSubscription {
                id: 0,
                expedition_id,
                owner_member_id,
                plan_code: "unknown".to_string(),
                status: SUBSCRIPTION_STATUS_INCOMPLETE.to_string(),
                seat_limit: 1,
                cancel_at_period_end: false,
                period_start_epoch: 0,
                period_end_epoch: 0,
                expedition_owner_key: expedition_owner_key.clone(),
                updated_at: now_ts,
            });

        if let Some(plan_code) = json_string(
            object
                .get("items")
                .and_then(|items| items.get("data"))
                .and_then(|data| data.as_array())
                .and_then(|rows| rows.first())
                .and_then(|row| row.get("price"))
                .and_then(|price| price.get("id")),
        ) {
            subscription.plan_code = plan_code;
        }

        if let Some(quantity) = json_u64(
            object
                .get("items")
                .and_then(|items| items.get("data"))
                .and_then(|data| data.as_array())
                .and_then(|rows| rows.first())
                .and_then(|row| row.get("quantity")),
        ) {
            subscription.seat_limit = quantity as u32;
        }

        if let Some(cancel_at_period_end) = json_bool(object.get("cancel_at_period_end")) {
            subscription.cancel_at_period_end = cancel_at_period_end;
        }

        if let Some(period_start_epoch) = json_i64(object.get("current_period_start")) {
            subscription.period_start_epoch = period_start_epoch;
        }

        if let Some(period_end_epoch) = json_i64(object.get("current_period_end")) {
            subscription.period_end_epoch = period_end_epoch;
        }

        let Some(status) = resolve_subscription_status_for_event(&event.kind, object) else {
            return;
        };

        subscription.status = status;
        if event.kind == "customer.subscription.deleted" {
            subscription.cancel_at_period_end = false;
        }

        subscription.updated_at = now_ts;

        if subscription.id == 0 {
            tx.db.plan_subscription().insert(subscription);
        } else {
            tx.db.plan_subscription().id().update(subscription);
        }
    });
}

#[spacetimedb::procedure]
pub fn reconcile_billing_state(ctx: &mut ProcedureContext) -> String {
    let caller_sub = match authenticated_subject_from_procedure(ctx) {
        Ok(sub) => sub,
        Err(err) => {
            log::error!("reconcile_billing_state: {}", err);
            return "{}".to_string();
        }
    };

    let owner_sub = match config_value(ctx, CONFIG_OWNER_SUB_KEY) {
        Some(value) => value,
        None => {
            log::error!("reconcile_billing_state: config owner not set");
            return "{}".to_string();
        }
    };

    if caller_sub != owner_sub {
        log::error!("reconcile_billing_state: only config owner can run reconciliation");
        return "{}".to_string();
    }

    let summary = ctx.with_tx(|tx| {
        let rows: Vec<PlanSubscription> = tx.db.plan_subscription().iter().collect();

        let total = rows.len() as u64;
        let active = rows
            .iter()
            .filter(|row| row.status == SUBSCRIPTION_STATUS_ACTIVE)
            .count() as u64;
        let trialing = rows
            .iter()
            .filter(|row| row.status == SUBSCRIPTION_STATUS_TRIALING)
            .count() as u64;
        let past_due = rows
            .iter()
            .filter(|row| row.status == SUBSCRIPTION_STATUS_PAST_DUE)
            .count() as u64;
        let canceled = rows
            .iter()
            .filter(|row| row.status == SUBSCRIPTION_STATUS_CANCELED)
            .count() as u64;
        let incomplete = rows
            .iter()
            .filter(|row| row.status == SUBSCRIPTION_STATUS_INCOMPLETE)
            .count() as u64;

        let missing_entitlements = rows
            .iter()
            .filter(|row| {
                !tx.db
                    .entitlement()
                    .iter()
                    .any(|entitlement| entitlement.expedition_id == row.expedition_id)
            })
            .count() as u64;

        serde_json::json!({
            "total": total,
            "active": active,
            "trialing": trialing,
            "past_due": past_due,
            "canceled": canceled,
            "incomplete": incomplete,
            "missing_entitlements": missing_entitlements
        })
        .to_string()
    });

    summary
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

#[derive(Deserialize)]
struct StripeCheckoutSessionResponse {
    url: String,
}

#[derive(Deserialize)]
struct StripeWebhookEvent {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    data: StripeWebhookEventData,
}

#[derive(Deserialize)]
struct StripeWebhookEventData {
    object: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn fixture_subscription_updated_past_due_maps_status() {
        let object = json!({ "status": "past_due" });
        let status = resolve_subscription_status_for_event("customer.subscription.updated", &object);
        assert_eq!(status.as_deref(), Some(SUBSCRIPTION_STATUS_PAST_DUE));
    }

    #[test]
    fn fixture_subscription_deleted_maps_canceled_status() {
        let object = json!({ "status": "active" });
        let status = resolve_subscription_status_for_event("customer.subscription.deleted", &object);
        assert_eq!(status.as_deref(), Some(SUBSCRIPTION_STATUS_CANCELED));
    }

    #[test]
    fn fixture_replay_event_maps_deterministically() {
        let object = json!({ "status": "active" });
        let first = resolve_subscription_status_for_event("customer.subscription.updated", &object);
        let replay = resolve_subscription_status_for_event("customer.subscription.updated", &object);
        assert_eq!(first, replay);
        assert_eq!(first.as_deref(), Some(SUBSCRIPTION_STATUS_ACTIVE));
    }

    #[test]
    fn fixture_product_event_name_validation() {
        assert!(is_valid_product_event_name("expedition_switch_success"));
        assert!(!is_valid_product_event_name("   "));
        assert!(!is_valid_product_event_name(&"x".repeat(PRODUCT_EVENT_NAME_MAX_LEN + 1)));
    }

    #[test]
    fn monitor_closeout_gate_requires_24h_after_end() {
        let end_epoch = 1_000_000;
        let before_gate = end_epoch + (24 * 60 * 60) - 1;
        let at_gate = end_epoch + (24 * 60 * 60);

        assert!(!should_auto_close_challenge_values(false, end_epoch, before_gate));
        assert!(should_auto_close_challenge_values(false, end_epoch, at_gate));
        assert!(!should_auto_close_challenge_values(true, end_epoch, at_gate));
    }

    #[test]
    fn monitor_detects_open_or_upcoming_correctly() {
        let now_epoch = 1_500_000;
        assert!(has_open_or_upcoming_challenge_values(
            false,
            CHALLENGE_STATUS_SCHEDULED,
            now_epoch + 10,
            now_epoch
        ));
        assert!(has_open_or_upcoming_challenge_values(
            false,
            CHALLENGE_STATUS_ACTIVE,
            now_epoch,
            now_epoch
        ));
        assert!(!has_open_or_upcoming_challenge_values(
            false,
            CHALLENGE_STATUS_CLOSED,
            now_epoch + 10,
            now_epoch
        ));
        assert!(!has_open_or_upcoming_challenge_values(
            true,
            CHALLENGE_STATUS_ACTIVE,
            now_epoch + 10,
            now_epoch
        ));
        assert!(!has_open_or_upcoming_challenge_values(
            false,
            CHALLENGE_STATUS_ACTIVE,
            now_epoch - 1,
            now_epoch
        ));
    }

    #[test]
    fn monitor_auto_window_is_28_days_with_registration_lead() {
        let now_epoch = 2_000_000;
        let (start_epoch, end_epoch, registration_closes_epoch) =
            compute_auto_challenge_window(now_epoch);

        assert_eq!(start_epoch, now_epoch + AUTO_CHALLENGE_START_DELAY_SECONDS);
        assert_eq!(end_epoch - start_epoch, AUTO_CHALLENGE_DURATION_SECONDS);
        assert_eq!(start_epoch - registration_closes_epoch, AUTO_CHALLENGE_REGISTRATION_LEAD_SECONDS);
    }
}
