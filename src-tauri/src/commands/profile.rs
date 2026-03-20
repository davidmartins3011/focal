use rusqlite::params;
use tauri::State;
use crate::models::{AppState, UserProfile};

#[tauri::command]
pub fn get_profile(state: State<'_, AppState>) -> Result<UserProfile, String> {
    let db = state.get_db()?;
    let json: String = db
        .query_row("SELECT data FROM user_profile WHERE id = 1", [], |row| {
            row.get(0)
        })
        .unwrap_or_else(|_| "{}".to_string());
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_profile(state: State<'_, AppState>, data: String) -> Result<UserProfile, String> {
    let profile: UserProfile = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let db = state.get_db()?;
    db.execute(
        "INSERT OR REPLACE INTO user_profile (id, data) VALUES (1, ?1)",
        params![data],
    )
    .map_err(|e| e.to_string())?;
    Ok(profile)
}
