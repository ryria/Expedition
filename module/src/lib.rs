use spacetimedb::{ProcedureContext, ReducerContext, Table, Timestamp};

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

#[spacetimedb::reducer]
pub fn set_config(ctx: &ReducerContext, key: String, value: String) {
    if ctx.db.config().key().find(key.clone()).is_some() {
        ctx.db.config().key().update(Config {
            key,
            value,
        });
    } else {
        ctx.db.config().insert(Config { key, value });
    }
}

// ─── Member ───────────────────────────────────────────────────────────────────

#[spacetimedb::table(accessor = member, public)]
pub struct Member {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub name: String,
    pub color_hex: String, // e.g. "#8b2020"
    pub created_at: Timestamp,
}

#[spacetimedb::reducer]
pub fn add_member(ctx: &ReducerContext, name: String, color_hex: String) {
    let name = name.trim().to_string();
    if name.is_empty() {
        log::error!("add_member: name cannot be empty");
        return;
    }
    if !color_hex.starts_with('#') || color_hex.len() != 7 {
        log::error!("add_member: invalid colour hex: {}", color_hex);
        return;
    }
    ctx.db.member().insert(Member {
        id: 0,
        name,
        color_hex,
        created_at: ctx.timestamp,
    });
}

#[spacetimedb::reducer]
pub fn remove_member(ctx: &ReducerContext, id: u64) {
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
}

#[spacetimedb::reducer]
pub fn log_activity(
    ctx: &ReducerContext,
    person_name: String,
    activity_type: String,
    distance_km: f64,
    note: String,
) {
    let person_name = person_name.trim().to_string();
    if person_name.is_empty() {
        log::error!("log_activity: person_name required");
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
        person_name,
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
    reacted_by: String,
) {
    let reacted_by = reacted_by.trim().to_string();
    if reacted_by.is_empty() {
        log::error!("add_reaction: reacted_by required");
        return;
    }
    ctx.db.reaction().insert(Reaction {
        id: 0,
        log_id,
        emoji,
        reacted_by,
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
    author: String,
    body: String,
) {
    let author = author.trim().to_string();
    let body = body.trim().to_string();
    if author.is_empty() {
        log::error!("add_comment: author required");
        return;
    }
    if body.is_empty() {
        log::error!("add_comment: body cannot be empty");
        return;
    }
    ctx.db.comment().insert(Comment {
        id: 0,
        log_id,
        author,
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

/// Extract the text content from a Claude API response body.
/// Response shape: `{"content":[{"type":"text","text":"..."}],...}`
fn extract_claude_text(body: &str) -> String {
    if let Some(idx) = body.find("\"text\":\"") {
        let after = &body[idx + 8..];
        let mut result = String::new();
        let mut chars = after.chars().peekable();
        while let Some(c) = chars.next() {
            match c {
                '"' => break,
                '\\' => match chars.next() {
                    Some('n') => result.push('\n'),
                    Some('t') => result.push('\t'),
                    Some('"') => result.push('"'),
                    Some('\\') => result.push('\\'),
                    _ => {}
                },
                _ => result.push(c),
            }
        }
        if !result.is_empty() {
            return result;
        }
    }
    "Keep it up! Every step counts toward the 14,500 km goal!".to_string()
}
