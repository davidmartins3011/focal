use rusqlite::params;
use tauri::State;
use crate::models::{AppState, NotificationHistoryEntry};

#[tauri::command]
pub fn get_notification_history(state: State<'_, AppState>) -> Result<Vec<NotificationHistoryEntry>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, reminder_id, icon, label, description, scheduled_time, fired_at, missed, read_status FROM notification_history ORDER BY fired_at DESC LIMIT 100")
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map([], |row| {
            Ok(NotificationHistoryEntry {
                id: row.get(0)?,
                reminder_id: row.get(1)?,
                icon: row.get(2)?,
                label: row.get(3)?,
                description: row.get(4)?,
                scheduled_time: row.get(5)?,
                fired_at: row.get(6)?,
                missed: row.get(7)?,
                read: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

#[tauri::command]
pub fn add_notification_entry(
    state: State<'_, AppState>,
    reminder_id: String,
    icon: String,
    label: String,
    description: String,
    scheduled_time: String,
    fired_at: String,
    missed: bool,
) -> Result<NotificationHistoryEntry, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO notification_history (id, reminder_id, icon, label, description, scheduled_time, fired_at, missed, read_status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,0)",
        params![id, reminder_id, icon, label, description, scheduled_time, fired_at, missed],
    )
    .map_err(|e| e.to_string())?;
    Ok(NotificationHistoryEntry {
        id,
        reminder_id,
        icon,
        label,
        description,
        scheduled_time,
        fired_at,
        missed,
        read: false,
    })
}

#[tauri::command]
pub fn mark_notification_read(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE notification_history SET read_status = 1 WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn mark_all_notifications_read(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("UPDATE notification_history SET read_status = 1", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_badge_count(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let value = if count == 0 { None } else { Some(count as i64) };
        window.set_badge_count(value).map_err(|e| e.to_string())?;
    }
    Ok(())
}
