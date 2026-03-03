use rusqlite::params;
use tauri::State;
use crate::models::{AppState, ChatMessage, ChatMessageStep};

#[tauri::command]
pub fn get_chat_messages(state: State<'_, AppState>) -> Result<Vec<ChatMessage>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, role, content FROM chat_messages ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut messages = Vec::with_capacity(rows.len());
    for (id, role, content) in &rows {
        let mut sstmt = db
            .prepare("SELECT text FROM chat_message_steps WHERE message_id = ?1 ORDER BY position")
            .map_err(|e| e.to_string())?;
        let steps: Vec<ChatMessageStep> = sstmt
            .query_map(params![id], |row| Ok(ChatMessageStep { text: row.get(0)? }))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        messages.push(ChatMessage {
            id: id.clone(),
            role: role.clone(),
            content: content.clone(),
            steps: if steps.is_empty() { None } else { Some(steps) },
        });
    }
    Ok(messages)
}

#[tauri::command]
pub fn clear_chat(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM chat_message_steps", [])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM chat_messages", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}