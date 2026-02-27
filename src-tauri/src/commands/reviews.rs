use rusqlite::params;
use tauri::State;
use crate::models::{AppState, StrategyPillar, StrategyReflection, StrategyReview};

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
