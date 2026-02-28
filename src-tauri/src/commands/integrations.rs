use rusqlite::params;
use tauri::State;
use crate::models::{AppState, Integration, IntegrationContext, IntegrationRule};
use crate::providers::{self, CalendarEvent, EmailMessage, OAuthCredentialsInfo};
use crate::providers::oauth;

fn load_integration(db: &rusqlite::Connection, id: &str) -> Result<Integration, String> {
    let (iid, name, desc, icon, connected, category, extra_context, oauth_provider): (String, String, String, String, bool, String, String, Option<String>) = db
        .query_row(
            "SELECT id, name, description, icon, connected, category, extra_context, oauth_provider FROM integrations WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?)),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare("SELECT id, text, urgency, importance FROM integration_rules WHERE integration_id = ?1 ORDER BY position")
        .map_err(|e| e.to_string())?;
    let rules: Vec<IntegrationRule> = stmt
        .query_map(params![iid], |row| {
            Ok(IntegrationRule {
                id: row.get(0)?,
                text: row.get(1)?,
                urgency: row.get(2)?,
                importance: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(Integration {
        id: iid,
        name,
        description: desc,
        icon,
        connected,
        category,
        context: IntegrationContext {
            rules,
            extra_context,
        },
        oauth_provider,
    })
}

#[tauri::command]
pub fn get_integrations(state: State<'_, AppState>) -> Result<Vec<Integration>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id FROM integrations ORDER BY category, name")
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    let mut result = Vec::with_capacity(ids.len());
    for id in &ids {
        result.push(load_integration(&db, id)?);
    }
    Ok(result)
}

#[tauri::command]
pub fn update_integration_connection(
    state: State<'_, AppState>,
    id: String,
    connected: bool,
) -> Result<Integration, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE integrations SET connected = ?1 WHERE id = ?2",
        params![connected, id],
    )
    .map_err(|e| e.to_string())?;
    load_integration(&db, &id)
}

#[tauri::command]
pub fn update_integration_context(
    state: State<'_, AppState>,
    id: String,
    rules: Vec<IntegrationRule>,
    extra_context: String,
) -> Result<Integration, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE integrations SET extra_context = ?1 WHERE id = ?2",
        params![extra_context, id],
    )
    .map_err(|e| e.to_string())?;

    db.execute(
        "DELETE FROM integration_rules WHERE integration_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    for (pos, rule) in rules.iter().enumerate() {
        db.execute(
            "INSERT INTO integration_rules (id, integration_id, text, urgency, importance, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![rule.id, id, rule.text, rule.urgency, rule.importance, pos as i32],
        )
        .map_err(|e| e.to_string())?;
    }

    load_integration(&db, &id)
}

// ─── OAuth credential management ───

#[tauri::command]
pub fn get_oauth_credentials(
    state: State<'_, AppState>,
    provider: String,
) -> Result<OAuthCredentialsInfo, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    match oauth::load_credentials(&db, &provider) {
        Ok((client_id, _)) => Ok(OAuthCredentialsInfo {
            provider,
            client_id,
            configured: true,
        }),
        Err(_) => Ok(OAuthCredentialsInfo {
            provider,
            client_id: String::new(),
            configured: false,
        }),
    }
}

#[tauri::command]
pub fn set_oauth_credentials(
    state: State<'_, AppState>,
    provider: String,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    oauth::store_credentials(&db, &provider, &client_id, &client_secret)
}

// ─── OAuth connect / disconnect ───

#[tauri::command]
pub async fn start_oauth(
    state: State<'_, AppState>,
    integration_id: String,
) -> Result<(), String> {
    let provider = providers::provider_for_integration(&integration_id)
        .ok_or_else(|| format!("L'intégration '{integration_id}' ne supporte pas OAuth"))?;

    // 1. Load credentials + check for existing tokens (under DB lock)
    let (client_id, client_secret, existing_tokens) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let (cid, csec) = oauth::load_credentials(&db, provider)?;
        let tokens = oauth::load_tokens(&db, provider).ok();
        (cid, csec, tokens)
    };

    // If we already have tokens, just mark connected (no new OAuth flow needed)
    if existing_tokens.is_some() {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.execute(
            "UPDATE integrations SET connected = 1 WHERE id = ?1",
            params![integration_id],
        )
        .map_err(|e| e.to_string())?;
        return Ok(());
    }

    // 2. Resolve provider-specific OAuth endpoints
    let (auth_endpoint, token_endpoint, scopes) = match provider {
        "google" => (
            providers::google::AUTH_ENDPOINT,
            providers::google::TOKEN_ENDPOINT,
            providers::google::SCOPES,
        ),
        _ => return Err(format!("Provider OAuth '{provider}' non supporté pour l'instant")),
    };

    // 3. Run the OAuth flow (opens browser, waits for callback)
    let tokens = oauth::run_oauth_flow(
        &client_id,
        &client_secret,
        auth_endpoint,
        token_endpoint,
        scopes,
    )
    .await?;

    // 4. Store tokens and mark integration(s) as connected
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        oauth::store_tokens(&db, provider, &tokens)?;
        db.execute(
            "UPDATE integrations SET connected = 1 WHERE id = ?1",
            params![integration_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn disconnect_integration(
    state: State<'_, AppState>,
    integration_id: String,
) -> Result<Integration, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE integrations SET connected = 0 WHERE id = ?1",
        params![integration_id],
    )
    .map_err(|e| e.to_string())?;

    // If no sibling integrations are still connected, revoke/delete the tokens
    if let Some(provider) = providers::provider_for_integration(&integration_id) {
        let siblings = providers::sibling_integrations(provider);
        let placeholders: Vec<String> = siblings.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!(
            "SELECT COUNT(*) FROM integrations WHERE id IN ({}) AND connected = 1",
            placeholders.join(",")
        );
        let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
        let params: Vec<&dyn rusqlite::types::ToSql> = siblings.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
        let still_connected: i64 = stmt
            .query_row(params.as_slice(), |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if still_connected == 0 {
            oauth::delete_tokens(&db, provider)?;
        }
    }

    load_integration(&db, &integration_id)
}

// ─── Data fetching ───

#[tauri::command]
pub async fn fetch_calendar_events(
    state: State<'_, AppState>,
    integration_id: String,
    date_from: String,
    date_to: String,
) -> Result<Vec<CalendarEvent>, String> {
    let provider = providers::provider_for_integration(&integration_id)
        .ok_or("Intégration non supportée pour le calendrier")?;

    let access_token = resolve_access_token(&state, provider).await?;

    match provider {
        "google" => providers::google::fetch_calendar_events(&access_token, &date_from, &date_to).await,
        _ => Err(format!("Fetch calendrier non implémenté pour '{provider}'")),
    }
}

#[tauri::command]
pub async fn fetch_emails(
    state: State<'_, AppState>,
    integration_id: String,
    query: Option<String>,
    max_results: Option<u32>,
) -> Result<Vec<EmailMessage>, String> {
    let provider = providers::provider_for_integration(&integration_id)
        .ok_or("Intégration non supportée pour les emails")?;

    let access_token = resolve_access_token(&state, provider).await?;
    let max = max_results.unwrap_or(20);

    match provider {
        "google" => providers::google::fetch_emails(&access_token, query.as_deref(), max).await,
        _ => Err(format!("Fetch emails non implémenté pour '{provider}'")),
    }
}

/// Gets a valid access token for the given provider, refreshing if needed.
async fn resolve_access_token(
    state: &State<'_, AppState>,
    provider: &str,
) -> Result<String, String> {
    let (tokens, client_id, client_secret) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let tokens = oauth::load_tokens(&db, provider)?;
        let (cid, csec) = oauth::load_credentials(&db, provider)?;
        (tokens, cid, csec)
    };

    let (access_token, refreshed) =
        oauth::get_valid_access_token(tokens, provider, &client_id, &client_secret).await?;

    if let Some(new_tokens) = refreshed {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        oauth::store_tokens(&db, provider, &new_tokens)?;
    }

    Ok(access_token)
}
