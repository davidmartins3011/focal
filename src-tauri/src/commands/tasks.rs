use rusqlite::params;
use tauri::State;
use chrono::Local;
use crate::models::{AppState, MicroStep, Tag, Task};

fn load_tags(db: &rusqlite::Connection, task_id: &str) -> Result<Vec<Tag>, String> {
    let mut stmt = db
        .prepare("SELECT label, color FROM task_tags WHERE task_id = ?1 ORDER BY position")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map(params![task_id], |row| {
            Ok(Tag {
                label: row.get(0)?,
                color: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(tags)
}

fn load_steps(db: &rusqlite::Connection, task_id: &str) -> Result<Vec<MicroStep>, String> {
    let mut stmt = db
        .prepare("SELECT id, text, done, estimated_minutes FROM micro_steps WHERE task_id = ?1 ORDER BY position")
        .map_err(|e| e.to_string())?;
    let steps = stmt
        .query_map(params![task_id], |row| {
            Ok(MicroStep {
                id: row.get(0)?,
                text: row.get(1)?,
                done: row.get(2)?,
                estimated_minutes: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(steps)
}

fn load_tasks(db: &rusqlite::Connection, ids: &[String]) -> Result<Vec<Task>, String> {
    let mut tasks = Vec::with_capacity(ids.len());
    for id in ids {
        tasks.push(load_task(db, id)?);
    }
    Ok(tasks)
}

fn load_task(db: &rusqlite::Connection, task_id: &str) -> Result<Task, String> {
    let (id, name, done, est, pri, ai, sched, urg, imp): (String, String, bool, Option<i32>, Option<String>, bool, Option<String>, Option<i32>, Option<i32>) = db
        .query_row(
            "SELECT id, name, done, estimated_minutes, priority, ai_decomposed, scheduled_date, urgency, importance FROM tasks WHERE id = ?1",
            params![task_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?)),
        )
        .map_err(|e| e.to_string())?;
    let tags = load_tags(db, &id)?;
    let steps = load_steps(db, &id)?;
    Ok(Task {
        id,
        name,
        done,
        tags,
        micro_steps: if steps.is_empty() { None } else { Some(steps) },
        ai_decomposed: if ai { Some(true) } else { None },
        estimated_minutes: est,
        priority: pri,
        scheduled_date: sched,
        urgency: urg,
        importance: imp,
    })
}

#[tauri::command]
pub fn get_all_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id FROM tasks ORDER BY position")
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    load_tasks(&db, &ids)
}

#[tauri::command]
pub fn get_tasks(state: State<'_, AppState>, context: String) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ids: Vec<String> = if context == "today" {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let mut stmt = db
            .prepare("SELECT id FROM tasks WHERE (view_context = ?1 AND scheduled_date IS NULL) OR scheduled_date = ?2 ORDER BY position")
            .map_err(|e| e.to_string())?;
        let result: Vec<String> = stmt
            .query_map(params![context, today], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        result
    } else {
        let mut stmt = db
            .prepare("SELECT id FROM tasks WHERE view_context = ?1 ORDER BY position")
            .map_err(|e| e.to_string())?;
        let result: Vec<String> = stmt
            .query_map(params![context], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        result
    };
    load_tasks(&db, &ids)
}

#[tauri::command]
pub fn get_tasks_by_date(state: State<'_, AppState>, date: String) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id FROM tasks WHERE scheduled_date = ?1 ORDER BY position")
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt
        .query_map(params![date], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    load_tasks(&db, &ids)
}

#[tauri::command]
pub fn get_tasks_by_date_range(
    state: State<'_, AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id FROM tasks WHERE scheduled_date >= ?1 AND scheduled_date <= ?2 ORDER BY scheduled_date, position")
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt
        .query_map(params![start_date, end_date], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    load_tasks(&db, &ids)
}

#[tauri::command]
pub fn get_overdue_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    let mut stmt = db
        .prepare("SELECT id FROM tasks WHERE scheduled_date < ?1 AND done = 0 ORDER BY scheduled_date, position")
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt
        .query_map(params![today], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    load_tasks(&db, &ids)
}

#[tauri::command]
pub fn create_task(
    state: State<'_, AppState>,
    name: String,
    context: Option<String>,
    priority: Option<String>,
    tags: Option<Vec<Tag>>,
    estimated_minutes: Option<i32>,
    scheduled_date: Option<String>,
) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let ctx = context.as_deref().unwrap_or("today");
    let max_pos: i32 = db
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM tasks WHERE view_context = ?1",
            params![ctx],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO tasks (id, name, done, estimated_minutes, priority, ai_decomposed, view_context, scheduled_date, position) VALUES (?1,?2,0,?3,?4,0,?5,?6,?7)",
        params![id, name, estimated_minutes, priority, ctx, scheduled_date, max_pos + 1],
    )
    .map_err(|e| e.to_string())?;
    if let Some(tag_list) = &tags {
        for (i, tag) in tag_list.iter().enumerate() {
            db.execute(
                "INSERT INTO task_tags (task_id, label, color, position) VALUES (?1,?2,?3,?4)",
                params![id, tag.label, tag.color, i as i32],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    load_task(&db, &id)
}

#[tauri::command]
pub fn update_task(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    done: Option<bool>,
    priority: Option<String>,
    estimated_minutes: Option<i32>,
    ai_decomposed: Option<bool>,
    scheduled_date: Option<String>,
    urgency: Option<i32>,
    importance: Option<i32>,
) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(v) = &name {
        db.execute("UPDATE tasks SET name = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = done {
        db.execute("UPDATE tasks SET done = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &priority {
        db.execute("UPDATE tasks SET priority = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = estimated_minutes {
        db.execute("UPDATE tasks SET estimated_minutes = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = ai_decomposed {
        db.execute("UPDATE tasks SET ai_decomposed = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &scheduled_date {
        db.execute("UPDATE tasks SET scheduled_date = ?1 WHERE id = ?2", params![v, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = urgency {
        let val: Option<i32> = if v == 0 { None } else { Some(v) };
        db.execute("UPDATE tasks SET urgency = ?1 WHERE id = ?2", params![val, id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = importance {
        let val: Option<i32> = if v == 0 { None } else { Some(v) };
        db.execute("UPDATE tasks SET importance = ?1 WHERE id = ?2", params![val, id])
            .map_err(|e| e.to_string())?;
    }
    load_task(&db, &id)
}

#[tauri::command]
pub fn toggle_task(state: State<'_, AppState>, id: String) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("UPDATE tasks SET done = 1 - done WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    load_task(&db, &id)
}

#[tauri::command]
pub fn delete_task(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reorder_tasks(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    for (i, id) in ids.iter().enumerate() {
        db.execute("UPDATE tasks SET position = ?1 WHERE id = ?2", params![i as i32, id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_micro_steps(
    state: State<'_, AppState>,
    task_id: String,
    steps: Vec<MicroStep>,
) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM micro_steps WHERE task_id = ?1", params![task_id])
        .map_err(|e| e.to_string())?;
    for (i, step) in steps.iter().enumerate() {
        let sid = if step.id.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            step.id.clone()
        };
        db.execute(
            "INSERT INTO micro_steps (id, task_id, text, done, estimated_minutes, position) VALUES (?1,?2,?3,?4,?5,?6)",
            params![sid, task_id, step.text, step.done, step.estimated_minutes, i as i32],
        )
        .map_err(|e| e.to_string())?;
    }
    db.execute("UPDATE tasks SET ai_decomposed = 1 WHERE id = ?1", params![task_id])
        .map_err(|e| e.to_string())?;
    load_task(&db, &task_id)
}

#[tauri::command]
pub fn toggle_micro_step(state: State<'_, AppState>, id: String) -> Result<MicroStep, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("UPDATE micro_steps SET done = 1 - done WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    db.query_row(
        "SELECT id, text, done, estimated_minutes FROM micro_steps WHERE id = ?1",
        params![id],
        |row| {
            Ok(MicroStep {
                id: row.get(0)?,
                text: row.get(1)?,
                done: row.get(2)?,
                estimated_minutes: row.get(3)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_streak(state: State<'_, AppState>) -> Result<i32, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let today = Local::now().date_naive();
    let mut streak: i32 = 0;
    let mut consecutive_empty = 0;

    for offset in 0i64..90 {
        let date = today - chrono::Duration::days(offset);
        let date_str = date.format("%Y-%m-%d").to_string();

        let (total, done_count): (i32, i32) = db
            .query_row(
                "SELECT COUNT(*), COALESCE(SUM(done), 0) FROM tasks WHERE scheduled_date = ?1",
                params![date_str],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;

        if total == 0 {
            consecutive_empty += 1;
            if consecutive_empty >= 3 {
                break;
            }
            continue;
        }
        consecutive_empty = 0;

        if done_count >= total {
            streak += 1;
        } else if offset == 0 {
            continue;
        } else {
            break;
        }
    }

    Ok(streak)
}
