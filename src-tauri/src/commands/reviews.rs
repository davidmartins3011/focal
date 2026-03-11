use chrono::NaiveDate;
use rusqlite::params;
use tauri::State;
use crate::models::{
    AppState,
    StrategyPillar, StrategyReflection, StrategyReview,
    StrategyAction, StrategyGoal, StrategyStrategy, StrategyTactic,
    PeriodSummary, TagDistribution, TaskHighlight,
};

// ── Legacy reviews (pillars / reflections / top3) ──

#[tauri::command]
pub fn get_strategy_reviews(state: State<'_, AppState>) -> Result<Vec<StrategyReview>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, month, year, created_at FROM strategy_reviews ORDER BY year DESC, month DESC")
        .map_err(|e| e.to_string())?;
    let review_rows: Vec<(String, i32, i32, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut reviews = Vec::with_capacity(review_rows.len());
    for (id, month, year, created_at) in &review_rows {
        let mut pstmt = db
            .prepare("SELECT id, name, tag_color, goal, progress, insight FROM strategy_pillars WHERE review_id = ?1 ORDER BY position")
            .map_err(|e| e.to_string())?;
        let pillars: Vec<StrategyPillar> = pstmt
            .query_map(params![id], |row| {
                Ok(StrategyPillar {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    tag_color: row.get(2)?,
                    goal: row.get(3)?,
                    progress: row.get(4)?,
                    insight: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut rstmt = db
            .prepare("SELECT id, prompt, answer FROM strategy_reflections WHERE review_id = ?1 ORDER BY position")
            .map_err(|e| e.to_string())?;
        let reflections: Vec<StrategyReflection> = rstmt
            .query_map(params![id], |row| {
                Ok(StrategyReflection {
                    id: row.get(0)?,
                    prompt: row.get(1)?,
                    answer: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut tstmt = db
            .prepare("SELECT item FROM strategy_top3 WHERE review_id = ?1 ORDER BY position")
            .map_err(|e| e.to_string())?;
        let top3: Vec<String> = tstmt
            .query_map(params![id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        reviews.push(StrategyReview {
            id: id.clone(),
            month: *month,
            year: *year,
            created_at: created_at.clone(),
            pillars,
            reflections,
            top3,
        });
    }
    Ok(reviews)
}

// ── GSTA: Goal → Strategy → Tactic → Action ──

#[tauri::command]
pub fn get_strategy_goals(state: State<'_, AppState>) -> Result<Vec<StrategyGoal>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut goal_stmt = db
        .prepare("SELECT id, title, target, deadline, created_at, updated_at FROM strategy_goals ORDER BY position")
        .map_err(|e| e.to_string())?;
    let goal_rows: Vec<(String, String, String, Option<String>, String, String)> = goal_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut goals = Vec::with_capacity(goal_rows.len());

    for (goal_id, title, target, deadline, created_at, updated_at) in &goal_rows {
        let mut strat_stmt = db
            .prepare("SELECT id, title, description FROM strategy_strategies WHERE goal_id = ?1 ORDER BY position")
            .map_err(|e| e.to_string())?;
        let strat_rows: Vec<(String, String, String)> = strat_stmt
            .query_map(params![goal_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut strategies = Vec::with_capacity(strat_rows.len());
        for (strat_id, strat_title, strat_desc) in &strat_rows {
            let mut tac_stmt = db
                .prepare("SELECT id, title, description FROM strategy_tactics WHERE strategy_id = ?1 ORDER BY position")
                .map_err(|e| e.to_string())?;
            let tac_rows: Vec<(String, String, String)> = tac_stmt
                .query_map(params![strat_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();

            let mut tactics = Vec::with_capacity(tac_rows.len());
            for (tac_id, tac_title, tac_desc) in &tac_rows {
                let mut act_stmt = db
                    .prepare("SELECT id, text, done FROM strategy_actions WHERE tactic_id = ?1 ORDER BY position")
                    .map_err(|e| e.to_string())?;
                let actions: Vec<StrategyAction> = act_stmt
                    .query_map(params![tac_id], |row| {
                        Ok(StrategyAction {
                            id: row.get(0)?,
                            text: row.get(1)?,
                            done: row.get::<_, i32>(2)? != 0,
                        })
                    })
                    .map_err(|e| e.to_string())?
                    .filter_map(|r| r.ok())
                    .collect();

                tactics.push(StrategyTactic {
                    id: tac_id.clone(),
                    title: tac_title.clone(),
                    description: tac_desc.clone(),
                    actions,
                });
            }

            strategies.push(StrategyStrategy {
                id: strat_id.clone(),
                title: strat_title.clone(),
                description: strat_desc.clone(),
                tactics,
            });
        }

        goals.push(StrategyGoal {
            id: goal_id.clone(),
            title: title.clone(),
            target: target.clone(),
            deadline: deadline.clone(),
            strategies,
            created_at: created_at.clone(),
            updated_at: updated_at.clone(),
        });
    }

    Ok(goals)
}

#[tauri::command]
pub fn upsert_strategy_goal(
    state: State<'_, AppState>,
    id: String,
    title: String,
    target: String,
    deadline: Option<String>,
    position: i32,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO strategy_goals (id, title, target, deadline, position, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET title=?2, target=?3, deadline=?4, position=?5, updated_at=datetime('now')",
        params![id, title, target, deadline, position],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_strategy_goal(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM strategy_goals WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn upsert_strategy(
    state: State<'_, AppState>,
    id: String,
    goal_id: String,
    title: String,
    description: String,
    position: i32,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO strategy_strategies (id, goal_id, title, description, position)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET title=?3, description=?4, position=?5",
        params![id, goal_id, title, description, position],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_strategy(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM strategy_strategies WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn upsert_tactic(
    state: State<'_, AppState>,
    id: String,
    strategy_id: String,
    title: String,
    description: String,
    position: i32,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO strategy_tactics (id, strategy_id, title, description, position)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET title=?3, description=?4, position=?5",
        params![id, strategy_id, title, description, position],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_tactic(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM strategy_tactics WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn upsert_action(
    state: State<'_, AppState>,
    id: String,
    tactic_id: String,
    text: String,
    position: i32,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO strategy_actions (id, tactic_id, text, position)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET text=?3, position=?4",
        params![id, tactic_id, text, position],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_action(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM strategy_actions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_action(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE strategy_actions SET done = CASE WHEN done = 0 THEN 1 ELSE 0 END WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Period summary (bilan) ──

#[tauri::command]
pub fn get_period_summary(
    state: State<'_, AppState>,
    start_date: String,
    end_date: String,
) -> Result<PeriodSummary, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let eff = "COALESCE(scheduled_date, DATE(created_at))";

    let tasks_total: i32 = db.query_row(
        &format!("SELECT COUNT(*) FROM tasks WHERE {eff} >= ?1 AND {eff} <= ?2"),
        params![start_date, end_date],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let tasks_completed: i32 = db.query_row(
        &format!("SELECT COUNT(*) FROM tasks WHERE {eff} >= ?1 AND {eff} <= ?2 AND done = 1"),
        params![start_date, end_date],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let focus_days: i32 = db.query_row(
        &format!("SELECT COUNT(DISTINCT {eff}) FROM tasks WHERE {eff} >= ?1 AND {eff} <= ?2 AND done = 1"),
        params![start_date, end_date],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let start = NaiveDate::parse_from_str(&start_date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let end = NaiveDate::parse_from_str(&end_date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let total_days = (end - start).num_days() as i32 + 1;

    let mut dist_stmt = db.prepare(&format!(
        "SELECT tt.color, COUNT(*) as cnt FROM tasks t \
         JOIN task_tags tt ON t.id = tt.task_id \
         WHERE {eff} >= ?1 AND {eff} <= ?2 AND t.done = 1 AND tt.color != 'urgent' \
         GROUP BY tt.color ORDER BY cnt DESC"
    )).map_err(|e| e.to_string())?;
    let distribution: Vec<TagDistribution> = dist_stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(TagDistribution { tag: row.get(0)?, count: row.get(1)? })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut hl_stmt = db.prepare(&format!(
        "SELECT t.name, \
           (SELECT tt.color FROM task_tags tt WHERE tt.task_id = t.id AND tt.color != 'urgent' ORDER BY tt.position LIMIT 1) \
         FROM tasks t \
         WHERE {eff} >= ?1 AND {eff} <= ?2 AND t.done = 1 \
         ORDER BY CASE WHEN t.priority = 'main' THEN 0 ELSE 1 END, \
           t.estimated_minutes DESC, t.position \
         LIMIT 5"
    )).map_err(|e| e.to_string())?;
    let highlights: Vec<TaskHighlight> = hl_stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(TaskHighlight { name: row.get(0)?, tag: row.get(1)? })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(PeriodSummary {
        tasks_completed,
        tasks_total,
        focus_days,
        total_days,
        distribution,
        highlights,
    })
}
