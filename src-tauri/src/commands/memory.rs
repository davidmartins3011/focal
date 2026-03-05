use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::ai::{call_llm, get_active_provider};
use crate::models::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInsight {
    pub id: String,
    pub category: String,
    pub insight: String,
    pub source_date: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
struct AnalysisResponse {
    insights: Vec<RawInsight>,
}

#[derive(Debug, Deserialize)]
struct RawInsight {
    category: String,
    insight: String,
}

const ANALYSIS_PROMPT: &str = r#"Tu es un analyste comportemental spécialisé dans l'organisation et la productivité.

On te donne l'historique des conversations d'une journée entre un utilisateur et son assistant de productivité.

Ton objectif : extraire des observations concrètes sur le FONCTIONNEMENT ORGANISATIONNEL de l'utilisateur.

CATÉGORIES À OBSERVER :
- "prioritization" : Comment il priorise (grosses tâches d'abord ? petites tâches d'abord ? par urgence ? par plaisir ?)
- "work_patterns" : Ses rythmes de travail (quand il est actif, quand il décroche, durée de ses sessions)
- "organization" : Ses mécaniques d'organisation préférées (listes, décomposition, timeboxing, etc.)
- "blockers" : Ses blocages récurrents (procrastination, perfectionnisme, surcharge, démarrage difficile)
- "psychology" : Sa psychologie d'organisation (besoin de structure vs flexibilité, besoin de validation, rapport au temps)
- "habits" : Ses habitudes et routines détectées (rituels du matin, revue du soir, etc.)

RÈGLES :
- Ne génère un insight QUE s'il est clairement visible dans les conversations. N'invente rien.
- Chaque insight doit être formulé comme une observation factuelle, en 1-2 phrases max.
- Si tu n'observes rien de significatif pour une catégorie, ne la mets pas.
- Formule les insights en français, à la troisième personne ("L'utilisateur...").
- Si des insights existants te sont fournis, mets-les à jour ou complète-les (ne duplique pas).

Réponds UNIQUEMENT en JSON valide :
{"insights": [{"category": "prioritization", "insight": "..."}, ...]}
Pas de texte avant ou après le JSON. Pas de markdown."#;

fn read_all_insights(db: &rusqlite::Connection) -> Result<Vec<MemoryInsight>, String> {
    let mut stmt = db
        .prepare(
            "SELECT id, category, insight, source_date, created_at, updated_at \
             FROM ai_memory_insights ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let results: Vec<MemoryInsight> = stmt
        .query_map([], |row| {
            Ok(MemoryInsight {
                id: row.get(0)?,
                category: row.get(1)?,
                insight: row.get(2)?,
                source_date: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

fn build_analysis_messages(
    conversations: &[(String, String)],
    existing_insights: &[MemoryInsight],
) -> Vec<(String, String)> {
    let mut context = String::from("CONVERSATIONS DU JOUR :\n\n");
    for (role, content) in conversations {
        let label = if role == "user" { "Utilisateur" } else { "Assistant" };
        context.push_str(&format!("{label} : {content}\n\n"));
    }

    if !existing_insights.is_empty() {
        context.push_str("\nINSIGHTS EXISTANTS (à compléter ou mettre à jour) :\n");
        for ins in existing_insights {
            context.push_str(&format!("- [{}] {}\n", ins.category, ins.insight));
        }
    }

    vec![("user".to_string(), context)]
}

#[tauri::command]
pub fn get_memory_insights(state: State<'_, AppState>) -> Result<Vec<MemoryInsight>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    read_all_insights(&db)
}

#[tauri::command]
pub fn delete_memory_insight(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM ai_memory_insights WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn check_and_run_analysis(state: State<'_, AppState>) -> Result<bool, String> {
    let today = chrono::Local::now().date_naive();
    let mut any_ran = false;

    for days_ago in 1..=7i64 {
        let date_str = (today - chrono::Duration::days(days_ago))
            .format("%Y-%m-%d")
            .to_string();
        if run_analysis_for_date(&state, &date_str, true).await? {
            any_ran = true;
        }
    }

    Ok(any_ran)
}

#[tauri::command]
pub async fn run_analysis_now(state: State<'_, AppState>) -> Result<bool, String> {
    let today = chrono::Local::now()
        .date_naive()
        .format("%Y-%m-%d")
        .to_string();
    run_analysis_for_date(&state, &today, false).await
}

async fn run_analysis_for_date(
    state: &State<'_, AppState>,
    date_str: &str,
    log_in_history: bool,
) -> Result<bool, String> {
    let (provider_id, api_key, model, conversations, existing_insights) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;

        if log_in_history {
            let already_done: bool = db
                .query_row(
                    "SELECT COUNT(*) FROM ai_memory_analysis_log WHERE analysis_date = ?1",
                    params![date_str],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap_or(0)
                > 0;
            if already_done {
                return Ok(false);
            }
        }

        let mut msg_stmt = db
            .prepare(
                "SELECT role, content FROM chat_messages \
                 WHERE date(created_at) = ?1 ORDER BY created_at",
            )
            .map_err(|e| e.to_string())?;

        let conversations: Vec<(String, String)> = msg_stmt
            .query_map(params![date_str], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        if conversations.is_empty() {
            if log_in_history {
                db.execute(
                    "INSERT OR IGNORE INTO ai_memory_analysis_log (analysis_date, analyzed_at, message_count) \
                     VALUES (?1, datetime('now'), 0)",
                    params![date_str],
                )
                .map_err(|e| e.to_string())?;
            }
            return Ok(false);
        }

        let (provider, model) = match get_active_provider(&db) {
            Ok(v) => v,
            Err(_) => return Ok(false),
        };

        let existing = read_all_insights(&db)?;

        (provider.id, provider.api_key, model, conversations, existing)
    };

    let messages = build_analysis_messages(&conversations, &existing_insights);
    let msg_count = conversations.len() as i64;

    let raw = call_llm(&provider_id, &api_key, &model, ANALYSIS_PROMPT, messages).await?;
    let parsed = parse_analysis_response(&raw)?;

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;

        for ri in &parsed.insights {
            let existing_id: Option<String> = db
                .query_row(
                    "SELECT id FROM ai_memory_insights WHERE category = ?1",
                    params![ri.category],
                    |row| row.get(0),
                )
                .ok();

            if let Some(eid) = existing_id {
                db.execute(
                    "UPDATE ai_memory_insights SET insight = ?1, source_date = ?2, updated_at = datetime('now') \
                     WHERE id = ?3",
                    params![ri.insight, date_str, eid],
                )
                .map_err(|e| e.to_string())?;
            } else {
                let id = uuid::Uuid::new_v4().to_string();
                db.execute(
                    "INSERT INTO ai_memory_insights (id, category, insight, source_date) \
                     VALUES (?1, ?2, ?3, ?4)",
                    params![id, ri.category, ri.insight, date_str],
                )
                .map_err(|e| e.to_string())?;
            }
        }

        if log_in_history {
            db.execute(
                "INSERT OR REPLACE INTO ai_memory_analysis_log (analysis_date, analyzed_at, message_count) \
                 VALUES (?1, datetime('now'), ?2)",
                params![date_str, msg_count],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(true)
}

fn parse_analysis_response(raw: &str) -> Result<AnalysisResponse, String> {
    let trimmed = raw.trim();

    if let Ok(parsed) = serde_json::from_str::<AnalysisResponse>(trimmed) {
        return Ok(parsed);
    }

    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            let json_str = &trimmed[start..=end];
            if let Ok(parsed) = serde_json::from_str::<AnalysisResponse>(json_str) {
                return Ok(parsed);
            }
        }
    }

    Err(format!(
        "Impossible de parser la réponse d'analyse : {}",
        &trimmed[..trimmed.len().min(200)]
    ))
}
