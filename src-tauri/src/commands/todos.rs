use rusqlite::params;
use tauri::State;
use crate::models::{AppState, TodoItem};

fn load_todo(db: &rusqlite::Connection, id: &str) -> Result<TodoItem, String> {
    db.query_row(
        "SELECT id, text, done, urgency, importance, source, created_at, scheduled_date FROM todos WHERE id = ?1",
        params![id],
        |row| {
            Ok(TodoItem {
                id: row.get(0)?,
                text: row.get(1)?,
                done: row.get(2)?,
                urgency: row.get(3)?,
                importance: row.get(4)?,
                source: row.get(5)?,
                created_at: row.get(6)?,
                scheduled_date: row.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_todos(state: State<'_, AppState>) -> Result<Vec<TodoItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, text, done, urgency, importance, source, created_at, scheduled_date FROM todos ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let todos = stmt
        .query_map([], |row| {
            Ok(TodoItem {
                id: row.get(0)?,
                text: row.get(1)?,
                done: row.get(2)?,
                urgency: row.get(3)?,
                importance: row.get(4)?,
                source: row.get(5)?,
                created_at: row.get(6)?,
                scheduled_date: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(todos)
}

#[tauri::command]
pub fn create_todo(
    state: State<'_, AppState>,
    text: String,
    urgency: Option<i32>,
    importance: Option<i32>,
    source: Option<String>,
    scheduled_date: Option<String>,
) -> Result<TodoItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let src = source.unwrap_or_else(|| "manual".to_string());
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    db.execute(
        "INSERT INTO todos (id, text, done, urgency, importance, source, created_at, scheduled_date) VALUES (?1,?2,0,?3,?4,?5,?6,?7)",
        params![id, text, urgency, importance, src, now, scheduled_date],
    )
    .map_err(|e| e.to_string())?;
    load_todo(&db, &id)
}

#[tauri::command]
pub fn update_todo(
    state: State<'_, AppState>,
    id: String,
    text: Option<String>,
    done: Option<bool>,
    urgency: Option<i32>,
    importance: Option<i32>,
    scheduled_date: Option<String>,
) -> Result<TodoItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(v) = &text {
        db.execute("UPDATE todos SET text = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = done {
        db.execute("UPDATE todos SET done = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = urgency {
        db.execute("UPDATE todos SET urgency = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = importance {
        db.execute("UPDATE todos SET importance = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &scheduled_date {
        db.execute("UPDATE todos SET scheduled_date = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    load_todo(&db, &id)
}

#[tauri::command]
pub fn toggle_todo(state: State<'_, AppState>, id: String) -> Result<TodoItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("UPDATE todos SET done = 1 - done WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    load_todo(&db, &id)
}

#[tauri::command]
pub fn delete_todo(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM todos WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
