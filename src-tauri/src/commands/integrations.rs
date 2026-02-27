use rusqlite::params;
use tauri::State;
use crate::models::{AppState, Integration, IntegrationContext, IntegrationRule};

fn load_integration(db: &rusqlite::Connection, id: &str) -> Result<Integration, String> {
    let (iid, name, desc, icon, connected, category, extra_context): (String, String, String, String, bool, String, String) = db
        .query_row(
            "SELECT id, name, description, icon, connected, category, extra_context FROM integrations WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
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
