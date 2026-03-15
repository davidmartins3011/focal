use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::ai::{call_llm, get_active_provider};
use crate::models::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSuggestion {
    pub id: String,
    pub icon: String,
    pub title: String,
    pub description: String,
    pub source: String,
    pub impact: String,
    pub category: String,
    pub confidence: i32,
    pub status: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub responded_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SuggestionsResponse {
    suggestions: Vec<RawSuggestion>,
}

#[derive(Debug, Deserialize)]
struct RawSuggestion {
    icon: String,
    title: String,
    description: String,
    source: String,
    #[serde(default = "default_impact")]
    impact: String,
    #[serde(default = "default_category")]
    category: String,
    #[serde(default = "default_confidence")]
    confidence: i32,
}

fn default_impact() -> String { "medium".to_string() }
fn default_category() -> String { "organisation".to_string() }
fn default_confidence() -> i32 { 75 }

const SUGGESTIONS_PROMPT: &str = r#"Tu es un coach de productivité spécialisé TDAH, intégré dans l'app focal.

On te donne :
1. L'historique des conversations des 14 derniers jours entre l'utilisateur et son assistant
2. Les tâches des 14 derniers jours (créées, terminées, en cours) avec leurs détails (durée estimée, tags, priorité, urgence/importance, date de planification)
3. Les insights mémoire existants sur l'utilisateur
4. Les suggestions passées que l'utilisateur a acceptées ou rejetées

Ton objectif : générer 3 à 6 suggestions NOUVELLES, concrètes et personnalisées pour aider l'utilisateur à améliorer sa productivité et son organisation.

TYPES DE SUGGESTIONS POSSIBLES (exemples, sois créatif) :
- Patterns temporels : "Vous terminez plus de tâches le matin — planifiez les tâches difficiles avant midi"
- Charge de travail : "Vous avez tendance à surcharger vos lundis — répartissez mieux sur la semaine"
- Estimation : "Vos tâches prennent souvent plus longtemps que prévu — ajoutez 30% de marge"
- Tags/catégories : "Vous avez beaucoup de tâches 'urgent' — essayez de prioriser par importance plutôt qu'urgence"
- Habitudes : "Vous créez souvent des tâches le soir mais les faites le lendemain — essayez de planifier la veille"
- Bien-être : "Vous enchaînez des journées chargées — prévoyez des pauses entre les tâches longues"
- Micro-étapes : "Les tâches décomposées ont un taux de complétion 2x plus élevé — décomposez plus souvent"
- Organisation : "Beaucoup de tâches sans date — planifier réduit la charge mentale"

RÈGLES IMPORTANTES :
- TOUT doit être rédigé en FRANÇAIS (titres, descriptions, sources). Jamais d'anglais.
- NE RÉPÈTE PAS une suggestion déjà acceptée ou rejetée (la liste est fournie ci-dessous).
- Base-toi UNIQUEMENT sur les données réelles fournies. N'invente pas de statistiques.
- Chaque suggestion doit être bienveillante, concrète et actionnable.
- Impact : "high", "medium", ou "low"
- Catégorie : "planification", "habitudes", "focus", "organisation", ou "bien-être"
- Confidence : entre 60 et 95
- Source : décris brièvement l'observation qui mène à cette suggestion
- Icône : un seul emoji pertinent

Réponds UNIQUEMENT en JSON valide :
{"suggestions": [{"icon": "🎯", "title": "...", "description": "...", "source": "...", "impact": "high", "category": "planification", "confidence": 85}]}
Pas de texte avant ou après le JSON. Pas de markdown."#;

fn collect_14d_chat_history(db: &rusqlite::Connection) -> Vec<(String, String)> {
    let Ok(mut stmt) = db.prepare(
        "SELECT role, content FROM chat_messages \
         WHERE created_at >= datetime('now', '-14 days') \
         ORDER BY created_at",
    ) else {
        return vec![];
    };

    stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

fn collect_user_profile(db: &rusqlite::Connection) -> String {
    let json: String = db
        .query_row("SELECT data FROM user_profile WHERE id = 1", [], |row| row.get(0))
        .unwrap_or_else(|_| "{}".to_string());

    let Ok(val) = serde_json::from_str::<serde_json::Value>(&json) else {
        return String::new();
    };

    let mut lines = vec!["PROFIL UTILISATEUR :".to_string()];
    if let Some(v) = val.get("firstName").and_then(|v| v.as_str()) {
        lines.push(format!("- Prénom : {v}"));
    }
    if let Some(v) = val.get("mainContext").and_then(|v| v.as_str()) {
        lines.push(format!("- Contexte : {v}"));
    }
    if let Some(v) = val.get("jobActivity").and_then(|v| v.as_str()) {
        lines.push(format!("- Activité : {v}"));
    }
    if let Some(v) = val.get("adhdRecognition").and_then(|v| v.as_str()) {
        lines.push(format!("- TDAH : {v}"));
    }
    if let Some(arr) = val.get("blockers").and_then(|v| v.as_array()) {
        let blockers: Vec<&str> = arr.iter().filter_map(|v| v.as_str()).collect();
        if !blockers.is_empty() {
            lines.push(format!("- Blocages : {}", blockers.join(", ")));
        }
    }
    if let Some(v) = val.get("organizationHorizon").and_then(|v| v.as_str()) {
        lines.push(format!("- Horizon d'organisation : {v}"));
    }
    if let Some(v) = val.get("mainExpectation").and_then(|v| v.as_str()) {
        lines.push(format!("- Attente principale : {v}"));
    }

    if lines.len() <= 1 { return String::new(); }
    lines.join("\n")
}

fn collect_14d_tasks(db: &rusqlite::Connection) -> String {
    let mut lines = vec!["DONNÉES DES 14 DERNIERS JOURS :".to_string()];

    // --- Aggregated stats by day of week ---
    let day_names = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

    if let Ok(mut stmt) = db.prepare(
        "SELECT CAST(strftime('%w', created_at) AS INTEGER) AS dow, \
                COUNT(*) AS total, \
                SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done \
         FROM tasks \
         WHERE created_at >= datetime('now', '-14 days') \
         GROUP BY dow ORDER BY dow",
    ) {
        let rows: Vec<(i32, i32, i32)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map(|r| r.filter_map(|r| r.ok()).collect())
            .unwrap_or_default();
        if !rows.is_empty() {
            lines.push("\nPATTERNS PAR JOUR DE LA SEMAINE :".to_string());
            for (dow, total, done) in &rows {
                let name = day_names.get(*dow as usize).unwrap_or(&"?");
                let rate = if *total > 0 { (*done as f64 / *total as f64 * 100.0) as i32 } else { 0 };
                lines.push(format!("- {name} : {total} tâches créées, {done} terminées ({rate}% complétion)"));
            }
        }
    }

    // --- Task duration stats ---
    if let Ok(mut stmt) = db.prepare(
        "SELECT COUNT(*), COALESCE(AVG(estimated_minutes), 0), \
                MIN(estimated_minutes), MAX(estimated_minutes) \
         FROM tasks \
         WHERE estimated_minutes IS NOT NULL AND created_at >= datetime('now', '-14 days')",
    ) {
        if let Ok((count, avg, min, max)) = stmt.query_row([], |row| {
            Ok((row.get::<_, i32>(0)?, row.get::<_, f64>(1)?, row.get::<_, i32>(2)?, row.get::<_, i32>(3)?))
        }) {
            if count > 0 {
                lines.push(format!(
                    "\nESTIMATIONS DE DURÉE : {count} tâches estimées, moyenne {avg:.0}min, min {min}min, max {max}min"
                ));
            }
        }
    }

    // --- Urgency/importance distribution ---
    if let Ok(mut stmt) = db.prepare(
        "SELECT \
            SUM(CASE WHEN urgency >= 4 AND importance >= 4 THEN 1 ELSE 0 END) AS urgent_important, \
            SUM(CASE WHEN urgency >= 4 AND importance < 4 THEN 1 ELSE 0 END) AS urgent_not_important, \
            SUM(CASE WHEN urgency < 4 AND importance >= 4 THEN 1 ELSE 0 END) AS not_urgent_important, \
            SUM(CASE WHEN urgency < 4 AND importance < 4 THEN 1 ELSE 0 END) AS neither \
         FROM tasks WHERE created_at >= datetime('now', '-14 days') \
            AND urgency IS NOT NULL AND importance IS NOT NULL",
    ) {
        if let Ok((ui, uni, nui, nn)) = stmt.query_row([], |row| {
            Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?, row.get::<_, i32>(2)?, row.get::<_, i32>(3)?))
        }) {
            if ui + uni + nui + nn > 0 {
                lines.push(format!(
                    "\nMATRICE EISENHOWER : urgent+important={ui}, urgent+pas important={uni}, pas urgent+important={nui}, ni l'un ni l'autre={nn}"
                ));
            }
        }
    }

    // --- Micro-steps completion rate ---
    if let Ok(mut stmt) = db.prepare(
        "SELECT COUNT(DISTINCT t.id), \
                SUM(CASE WHEN t.done = 1 THEN 1 ELSE 0 END) \
         FROM tasks t \
         WHERE t.ai_decomposed = 1 AND t.created_at >= datetime('now', '-14 days')",
    ) {
        if let Ok((decomposed, decomposed_done)) = stmt.query_row([], |row| {
            Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?))
        }) {
            let non_decomposed: (i32, i32) = db.query_row(
                "SELECT COUNT(*), SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) \
                 FROM tasks WHERE ai_decomposed = 0 AND created_at >= datetime('now', '-14 days')",
                [], |row| Ok((row.get(0)?, row.get(1)?)),
            ).unwrap_or((0, 0));

            if decomposed > 0 || non_decomposed.0 > 0 {
                let rate_d = if decomposed > 0 { (decomposed_done as f64 / decomposed as f64 * 100.0) as i32 } else { 0 };
                let rate_nd = if non_decomposed.0 > 0 { (non_decomposed.1 as f64 / non_decomposed.0 as f64 * 100.0) as i32 } else { 0 };
                lines.push(format!(
                    "\nMICRO-ÉTAPES : tâches décomposées={decomposed} ({rate_d}% complétées), non décomposées={} ({rate_nd}% complétées)",
                    non_decomposed.0
                ));
            }
        }
    }

    // --- Task aging: old pending tasks ---
    let stale_count: i32 = db.query_row(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND created_at < datetime('now', '-7 days')",
        [], |row| row.get(0),
    ).unwrap_or(0);
    let very_stale_count: i32 = db.query_row(
        "SELECT COUNT(*) FROM tasks WHERE done = 0 AND created_at < datetime('now', '-14 days')",
        [], |row| row.get(0),
    ).unwrap_or(0);
    if stale_count > 0 {
        lines.push(format!(
            "\nVIEILLISSEMENT : {stale_count} tâches ouvertes depuis +7 jours, {very_stale_count} depuis +14 jours"
        ));
    }

    // --- Tag distribution ---
    if let Ok(mut tag_stmt) = db.prepare(
        "SELECT tt.label, COUNT(*) AS cnt, \
                SUM(CASE WHEN t.done = 1 THEN 1 ELSE 0 END) AS done_cnt \
         FROM task_tags tt \
         INNER JOIN tasks t ON t.id = tt.task_id \
         WHERE t.created_at >= datetime('now', '-14 days') \
         GROUP BY tt.label ORDER BY cnt DESC",
    ) {
        let tags: Vec<(String, i32, i32)> = tag_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map(|r| r.filter_map(|r| r.ok()).collect())
            .unwrap_or_default();
        if !tags.is_empty() {
            lines.push("\nTAGS (répartition et complétion) :".to_string());
            for (label, cnt, done) in &tags {
                let rate = if *cnt > 0 { (*done as f64 / *cnt as f64 * 100.0) as i32 } else { 0 };
                lines.push(format!("- #{label} : {cnt} tâches, {done} terminées ({rate}%)"));
            }
        }
    }

    // --- Scheduling habits ---
    let scheduled: i32 = db.query_row(
        "SELECT COUNT(*) FROM tasks WHERE scheduled_date IS NOT NULL AND created_at >= datetime('now', '-14 days')",
        [], |row| row.get(0),
    ).unwrap_or(0);
    let unscheduled: i32 = db.query_row(
        "SELECT COUNT(*) FROM tasks WHERE scheduled_date IS NULL AND done = 0 AND created_at >= datetime('now', '-14 days')",
        [], |row| row.get(0),
    ).unwrap_or(0);
    let total: i32 = db.query_row(
        "SELECT COUNT(*) FROM tasks WHERE created_at >= datetime('now', '-14 days')",
        [], |row| row.get(0),
    ).unwrap_or(0);
    let done_total: i32 = db.query_row(
        "SELECT COUNT(*) FROM tasks WHERE done = 1 AND created_at >= datetime('now', '-14 days')",
        [], |row| row.get(0),
    ).unwrap_or(0);

    lines.push(format!(
        "\nRÉSUMÉ GLOBAL : {total} tâches, {done_total} terminées, {scheduled} planifiées, {unscheduled} sans date et actives"
    ));

    lines.join("\n")
}

fn collect_past_suggestions(db: &rusqlite::Connection) -> Vec<(String, String, String)> {
    let Ok(mut stmt) = db.prepare(
        "SELECT title, description, status FROM ai_suggestions \
         WHERE status IN ('accepted', 'rejected') \
           AND responded_at >= datetime('now', '-6 months') \
         ORDER BY responded_at DESC",
    ) else {
        return vec![];
    };

    stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

fn collect_memory_insights(db: &rusqlite::Connection) -> Vec<(String, String)> {
    let Ok(mut stmt) = db.prepare(
        "SELECT category, insight FROM ai_memory_insights ORDER BY updated_at DESC",
    ) else {
        return vec![];
    };

    stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

fn build_suggestions_context(
    user_profile: &str,
    conversations: &[(String, String)],
    tasks_summary: &str,
    insights: &[(String, String)],
    past_suggestions: &[(String, String, String)],
) -> Vec<(String, String)> {
    let mut context = String::new();

    if !user_profile.is_empty() {
        context.push_str(user_profile);
        context.push_str("\n\n---\n\n");
    }

    if !insights.is_empty() {
        context.push_str("OBSERVATIONS COMPORTEMENTALES :\n");
        for (cat, insight) in insights {
            context.push_str(&format!("- [{cat}] {insight}\n"));
        }
        context.push_str("\n---\n\n");
    }

    context.push_str(tasks_summary);
    context.push_str("\n\n---\n\n");

    if !conversations.is_empty() {
        context.push_str("CONVERSATIONS DES 14 DERNIERS JOURS (extraits) :\n\n");
        let max_msgs = 50;
        for (role, content) in conversations.iter().rev().take(max_msgs).rev() {
            let label = if role == "user" { "Utilisateur" } else { "Assistant" };
            let truncated = if content.len() > 300 { &content[..300] } else { content };
            context.push_str(&format!("{label} : {truncated}\n\n"));
        }
        context.push_str("---\n\n");
    }

    if !past_suggestions.is_empty() {
        context.push_str("SUGGESTIONS PASSÉES (NE PAS RÉPÉTER) :\n");
        for (title, desc, status) in past_suggestions {
            let label = if status == "accepted" { "✅ Acceptée" } else { "❌ Rejetée" };
            context.push_str(&format!("- [{label}] {title} : {desc}\n"));
        }
        context.push_str("\n");
    }

    vec![(
        "user".to_string(),
        format!("{context}Analyse ces données et génère des suggestions personnalisées nouvelles."),
    )]
}

#[tauri::command]
pub fn get_suggestions(state: State<'_, AppState>) -> Result<Vec<AiSuggestion>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, icon, title, description, source, impact, category, confidence, status, created_at, responded_at \
             FROM ai_suggestions WHERE status NOT IN ('expired', 'rejected') ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let results: Vec<AiSuggestion> = stmt
        .query_map([], |row| {
            Ok(AiSuggestion {
                id: row.get(0)?,
                icon: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                source: row.get(4)?,
                impact: row.get(5)?,
                category: row.get(6)?,
                confidence: row.get(7)?,
                status: row.get(8)?,
                created_at: row.get(9)?,
                responded_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

#[tauri::command]
pub fn get_last_suggestions_run(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let result: Option<String> = db
        .query_row(
            "SELECT ran_at FROM ai_suggestions_log ORDER BY ran_at DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();
    Ok(result)
}

#[tauri::command]
pub fn respond_to_suggestion(
    state: State<'_, AppState>,
    id: String,
    status: String,
) -> Result<(), String> {
    if status != "accepted" && status != "rejected" && status != "later" {
        return Err("Le statut doit être 'accepted', 'rejected' ou 'later'.".to_string());
    }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE ai_suggestions SET status = ?1, responded_at = datetime('now') WHERE id = ?2",
        params![status, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn check_and_run_suggestions(state: State<'_, AppState>) -> Result<bool, String> {
    let should_run = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let last_run: Option<String> = db
            .query_row(
                "SELECT ran_at FROM ai_suggestions_log ORDER BY ran_at DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .ok();

        match last_run {
            Some(ran_at) => {
                let days_since: i64 = db
                    .query_row(
                        "SELECT CAST(julianday('now') - julianday(?1) AS INTEGER)",
                        params![ran_at],
                        |row| row.get(0),
                    )
                    .unwrap_or(999);
                days_since >= 7
            }
            None => true,
        }
    };

    if !should_run {
        return Ok(false);
    }

    run_suggestions_analysis(&state).await
}

#[tauri::command]
pub async fn run_suggestions_now(state: State<'_, AppState>) -> Result<bool, String> {
    run_suggestions_analysis(&state).await
}

async fn run_suggestions_analysis(state: &State<'_, AppState>) -> Result<bool, String> {
    let (provider_id, api_key, model, messages) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;

        let (provider, model) = get_active_provider(&db)?;

        let profile = collect_user_profile(&db);
        let conversations = collect_14d_chat_history(&db);
        let tasks_summary = collect_14d_tasks(&db);
        let insights = collect_memory_insights(&db);
        let past = collect_past_suggestions(&db);

        let msgs = build_suggestions_context(&profile, &conversations, &tasks_summary, &insights, &past);

        (provider.id, provider.api_key, model, msgs)
    };

    let raw = call_llm(&provider_id, &api_key, &model, SUGGESTIONS_PROMPT, messages, false).await?;
    let parsed = parse_suggestions_response(&raw)?;

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let new_count = parsed.suggestions.len() as i32;

        let current_pending: i32 = db
            .query_row("SELECT COUNT(*) FROM ai_suggestions WHERE status = 'pending'", [], |r| r.get(0))
            .unwrap_or(0);
        let overflow = (current_pending + new_count) - 10;
        if overflow > 0 {
            db.execute(
                "UPDATE ai_suggestions SET status = 'expired', responded_at = datetime('now') \
                 WHERE id IN (SELECT id FROM ai_suggestions WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?1)",
                params![overflow],
            ).ok();
        }

        for s in &parsed.suggestions {
            let id = uuid::Uuid::new_v4().to_string();
            db.execute(
                "INSERT INTO ai_suggestions (id, icon, title, description, source, impact, category, confidence) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![id, s.icon, s.title, s.description, s.source, s.impact, s.category, s.confidence],
            )
            .map_err(|e| e.to_string())?;
        }

        db.execute(
            "INSERT OR REPLACE INTO ai_suggestions_log (run_date, ran_at, suggestion_count) \
             VALUES (?1, datetime('now'), ?2)",
            params![today, new_count],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(true)
}

fn parse_suggestions_response(raw: &str) -> Result<SuggestionsResponse, String> {
    let trimmed = raw.trim();

    if let Ok(parsed) = serde_json::from_str::<SuggestionsResponse>(trimmed) {
        return Ok(parsed);
    }

    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            let json_str = &trimmed[start..=end];
            if let Ok(parsed) = serde_json::from_str::<SuggestionsResponse>(json_str) {
                return Ok(parsed);
            }
        }
    }

    // Fallback: try parsing as a direct array
    if let Some(start) = trimmed.find('[') {
        if let Some(end) = trimmed.rfind(']') {
            let json_str = &trimmed[start..=end];
            if let Ok(arr) = serde_json::from_str::<Vec<RawSuggestion>>(json_str) {
                return Ok(SuggestionsResponse { suggestions: arr });
            }
        }
    }

    Err(format!(
        "Impossible de parser les suggestions : {}",
        &trimmed[..trimmed.len().min(200)]
    ))
}
