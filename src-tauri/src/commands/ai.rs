use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::models::AppState;

#[derive(Deserialize)]
struct HistoryMsg {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResponse {
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
struct ProviderConfig {
    id: String,
    enabled: bool,
    #[serde(rename = "apiKey")]
    api_key: String,
    #[serde(default, rename = "keyStatus")]
    _key_status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiSettings {
    providers: Vec<ProviderConfig>,
    selected_model: Option<String>,
}

fn get_active_provider(db: &rusqlite::Connection) -> Result<ProviderConfig, String> {
    let raw: String = db
        .query_row(
            "SELECT value FROM settings WHERE key = 'ai-settings'",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "Aucun paramètre AI configuré".to_string())?;

    let settings: AiSettings =
        serde_json::from_str(&raw).map_err(|e| format!("Erreur parsing AI settings: {e}"))?;

    let ready: Vec<ProviderConfig> = settings
        .providers
        .into_iter()
        .filter(|p| p.enabled && !p.api_key.is_empty())
        .collect();

    if ready.is_empty() {
        return Err("Aucun provider AI activé avec une clé API. Configure-le dans les paramètres.".to_string());
    }

    if let Some(model_id) = &settings.selected_model {
        let provider_for_model = match model_id.as_str() {
            "gpt-4o" | "gpt-4o-mini" | "o1" | "o3-mini" => Some("openai"),
            "claude-4-opus" | "claude-4-sonnet" => Some("anthropic"),
            "mistral-large" | "mistral-medium" | "codestral" => Some("mistral"),
            _ => None,
        };
        if let Some(pid) = provider_for_model {
            if let Some(p) = ready.iter().find(|p| p.id == pid) {
                return Ok(p.clone());
            }
        }
    }

    Ok(ready.into_iter().next().unwrap())
}

fn get_user_profile(db: &rusqlite::Connection) -> Option<serde_json::Value> {
    db.query_row(
        "SELECT data FROM user_profile WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|json| serde_json::from_str(&json).ok())
}

fn build_system_prompt(db: &rusqlite::Connection) -> String {
    let mut parts = vec![
        "Tu es l'assistant IA de focal., une application d'aide à la productivité pour les personnes TDAH.".to_string(),
        "Tu es bienveillant, concret, et orienté action. Tu ne fais jamais la morale.".to_string(),
        "Tu tutoies l'utilisateur. Tu es direct et encourageant.".to_string(),
        "Quand on te demande de décomposer une tâche, tu retournes des micro-étapes claires et actionnables.".to_string(),
        String::new(),
        "INSTRUCTIONS DE FORMAT :".to_string(),
        "- Réponds en JSON valide avec cette structure exacte :".to_string(),
        r#"  {"content": "ton message texte", "steps": ["étape 1", "étape 2", ...] }"#.to_string(),
        "- Le champ \"steps\" est optionnel. Inclus-le UNIQUEMENT quand tu décomposes une tâche en micro-étapes.".to_string(),
        "- Le champ \"content\" est toujours présent et contient ton message textuel.".to_string(),
        "- N'utilise jamais de markdown dans content. Utilise des sauts de ligne (\\n) pour les paragraphes.".to_string(),
        String::new(),
    ];

    if let Some(profile) = get_user_profile(db) {
        let mut ctx = vec!["PROFIL UTILISATEUR :".to_string()];
        if let Some(name) = profile.get("firstName").and_then(|v| v.as_str()) {
            ctx.push(format!("- Prénom : {name}"));
        }
        if let Some(job) = profile.get("jobActivity").and_then(|v| v.as_str()) {
            ctx.push(format!("- Activité : {job}"));
        }
        if let Some(adhd) = profile.get("adhdRecognition").and_then(|v| v.as_str()) {
            ctx.push(format!("- TDAH : {adhd}"));
        }
        if let Some(blockers) = profile.get("blockers").and_then(|v| v.as_array()) {
            let b: Vec<&str> = blockers.iter().filter_map(|v| v.as_str()).collect();
            if !b.is_empty() {
                ctx.push(format!("- Blocages principaux : {}", b.join(", ")));
            }
        }
        if ctx.len() > 1 {
            parts.push(ctx.join("\n"));
            parts.push(String::new());
        }
    }

    if let Ok(mut stmt) = db.prepare(
        "SELECT name, done, priority FROM tasks WHERE view_context = 'today' ORDER BY position",
    ) {
        if let Ok(tasks) = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, bool>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        }) {
            let task_lines: Vec<String> = tasks
                .filter_map(|r| r.ok())
                .map(|(name, done, pri)| {
                    let check = if done { "✓" } else { "○" };
                    let tag = pri.map_or(String::new(), |p| format!(" [{p}]"));
                    format!("  {check} {name}{tag}")
                })
                .collect();
            if !task_lines.is_empty() {
                parts.push("TÂCHES DU JOUR :".to_string());
                parts.extend(task_lines);
                parts.push(String::new());
            }
        }
    }

    parts.join("\n")
}

#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<AnthropicMessage>,
}

#[derive(Deserialize)]
struct AnthropicContentBlock {
    text: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Option<Vec<AnthropicContentBlock>>,
    error: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    max_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    message: OpenAIChoiceMessage,
}

#[derive(Deserialize)]
struct OpenAIChoiceMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Option<Vec<OpenAIChoice>>,
    error: Option<serde_json::Value>,
}

async fn call_anthropic(
    api_key: &str,
    system: &str,
    messages: Vec<(String, String)>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let msgs: Vec<AnthropicMessage> = messages
        .into_iter()
        .map(|(role, content)| AnthropicMessage {
            role: if role == "ai" {
                "assistant".to_string()
            } else {
                role
            },
            content,
        })
        .collect();

    let body = AnthropicRequest {
        model: "claude-sonnet-4-20250514".to_string(),
        max_tokens: 1024,
        system: system.to_string(),
        messages: msgs,
    };

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Anthropic: {e}"))?;

    let data: AnthropicResponse = resp
        .json()
        .await
        .map_err(|e| format!("Erreur parsing réponse Anthropic: {e}"))?;

    if let Some(err) = data.error {
        return Err(format!("Erreur API Anthropic: {err}"));
    }

    data.content
        .and_then(|blocks| blocks.into_iter().find_map(|b| b.text))
        .ok_or_else(|| "Réponse Anthropic vide".to_string())
}

async fn call_openai_compatible(
    api_key: &str,
    base_url: &str,
    model: &str,
    system: &str,
    messages: Vec<(String, String)>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut msgs: Vec<OpenAIMessage> = vec![OpenAIMessage {
        role: "system".to_string(),
        content: system.to_string(),
    }];
    msgs.extend(messages.into_iter().map(|(role, content)| OpenAIMessage {
        role: if role == "ai" {
            "assistant".to_string()
        } else {
            role
        },
        content,
    }));

    let body = OpenAIRequest {
        model: model.to_string(),
        messages: msgs,
        max_tokens: Some(1024),
    };

    let resp = client
        .post(format!("{base_url}/chat/completions"))
        .header("Authorization", format!("Bearer {api_key}"))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau: {e}"))?;

    let data: OpenAIResponse = resp
        .json()
        .await
        .map_err(|e| format!("Erreur parsing réponse: {e}"))?;

    if let Some(err) = data.error {
        return Err(format!("Erreur API: {err}"));
    }

    data.choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message.content)
        .ok_or_else(|| "Réponse vide".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecompStep {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_minutes: Option<i32>,
}

async fn call_llm(
    provider_id: &str,
    api_key: &str,
    system: &str,
    messages: Vec<(String, String)>,
) -> Result<String, String> {
    match provider_id {
        "anthropic" => call_anthropic(api_key, system, messages).await,
        "openai" => {
            call_openai_compatible(api_key, "https://api.openai.com/v1", "gpt-4o", system, messages).await
        }
        "mistral" => {
            call_openai_compatible(api_key, "https://api.mistral.ai/v1", "mistral-large-latest", system, messages).await
        }
        _ => Err(format!("Provider inconnu : {provider_id}")),
    }
}

fn parse_ai_text(raw: &str) -> AiResponse {
    if let Some(parsed) = clean_and_find_json(raw) {
        let content = parsed
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or(raw)
            .to_string();
        let steps = parsed.get("steps").and_then(|v| v.as_array()).map(|arr| {
            arr.iter()
                .filter_map(|s| s.as_str().map(|s| s.to_string()))
                .collect()
        });
        return AiResponse { content, steps };
    }
    AiResponse {
        content: raw.to_string(),
        steps: None,
    }
}

#[tauri::command]
pub async fn validate_api_key(provider_id: String, api_key: String) -> Result<bool, String> {
    if api_key.trim().is_empty() {
        return Ok(false);
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Client error: {e}"))?;

    match provider_id.as_str() {
        "openai" => {
            let resp = client
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {api_key}"))
                .send()
                .await
                .map_err(|e| format!("Erreur réseau: {e}"))?;
            Ok(resp.status().is_success())
        }
        "anthropic" => {
            let resp = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .body(r#"{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"ping"}]}"#)
                .send()
                .await
                .map_err(|e| format!("Erreur réseau: {e}"))?;
            let status = resp.status().as_u16();
            // 200 = valid, 401/403 = invalid key, 429 = rate-limited but key is valid
            Ok(status == 200 || status == 429)
        }
        "mistral" => {
            let resp = client
                .get("https://api.mistral.ai/v1/models")
                .header("Authorization", format!("Bearer {api_key}"))
                .send()
                .await
                .map_err(|e| format!("Erreur réseau: {e}"))?;
            Ok(resp.status().is_success())
        }
        _ => Err(format!("Provider inconnu : {provider_id}")),
    }
}

#[tauri::command]
pub async fn send_message(
    state: State<'_, AppState>,
    user_message: String,
) -> Result<AiResponse, String> {
    let (provider_id, api_key, system_prompt, history) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let provider = get_active_provider(&db)?;
        let system = build_system_prompt(&db);

        let mut stmt = db
            .prepare("SELECT role, content FROM chat_messages ORDER BY created_at")
            .map_err(|e| e.to_string())?;
        let history: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        (provider.id, provider.api_key, system, history)
    };

    // Save user message
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let id = uuid::Uuid::new_v4().to_string();
        db.execute(
            "INSERT INTO chat_messages (id, role, content) VALUES (?1,'user',?2)",
            params![id, user_message],
        )
        .map_err(|e| e.to_string())?;
    }

    let mut msgs = history;
    msgs.push(("user".to_string(), user_message));

    let raw_response = call_llm(&provider_id, &api_key, &system_prompt, msgs).await?;

    let response = parse_ai_text(&raw_response);

    // Save AI response
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let id = uuid::Uuid::new_v4().to_string();
        db.execute(
            "INSERT INTO chat_messages (id, role, content) VALUES (?1,'ai',?2)",
            params![id, response.content],
        )
        .map_err(|e| e.to_string())?;

        if let Some(ref steps) = response.steps {
            for (i, text) in steps.iter().enumerate() {
                db.execute(
                    "INSERT INTO chat_message_steps (message_id, text, position) VALUES (?1,?2,?3)",
                    params![id, text, i as i32],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(response)
}

#[tauri::command]
pub async fn decompose_task(
    state: State<'_, AppState>,
    task_name: String,
    context: Option<String>,
) -> Result<Vec<DecompStep>, String> {
    let (provider_id, api_key) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let provider = get_active_provider(&db)?;
        (provider.id, provider.api_key)
    };

    let system = concat!(
        "Tu es un assistant spécialisé dans la décomposition de tâches pour les personnes TDAH.\n",
        "Ton rôle est de découper une tâche en 3 à 5 micro-étapes concrètes et actionnables.\n",
        "Chaque étape doit être faisable en une seule action, sans ambiguïté.\n",
        "Estime le temps en minutes pour chaque étape.\n\n",
        "Réponds UNIQUEMENT en JSON valide, un tableau d'objets :\n",
        "[{\"text\": \"description de l'étape\", \"estimatedMinutes\": 5}, ...]\n",
        "Pas de texte avant ou après le JSON. Pas de markdown.",
    );

    let prompt = if let Some(ctx) = context {
        format!("Décompose cette tâche : \"{task_name}\"\nContexte : {ctx}")
    } else {
        format!("Décompose cette tâche : \"{task_name}\"")
    };

    let msgs = vec![("user".to_string(), prompt)];
    let raw = call_llm(&provider_id, &api_key, system, msgs).await?;

    let trimmed = raw.trim();
    if let Ok(steps) = serde_json::from_str::<Vec<DecompStep>>(trimmed) {
        return Ok(steps);
    }
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(arr) = val.as_array() {
            let steps: Vec<DecompStep> = arr
                .iter()
                .filter_map(|v| {
                    let text = v.get("text").and_then(|t| t.as_str())?.to_string();
                    let estimated_minutes = v
                        .get("estimatedMinutes")
                        .or_else(|| v.get("estimated_minutes"))
                        .and_then(|m| m.as_i64())
                        .map(|m| m as i32);
                    Some(DecompStep { text, estimated_minutes })
                })
                .collect();
            if !steps.is_empty() {
                return Ok(steps);
            }
        }
    }

    Err("L'IA n'a pas retourné un format de décomposition valide.".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub id: String,
    pub icon: String,
    pub title: String,
    pub description: String,
    pub source: String,
    pub impact: String,
    pub category: String,
    pub confidence: i32,
}

fn collect_task_stats(db: &rusqlite::Connection) -> String {
    let mut lines = vec!["STATISTIQUES DE L'UTILISATEUR :".to_string()];

    let total: i32 = db
        .query_row("SELECT COUNT(*) FROM tasks", [], |r| r.get(0))
        .unwrap_or(0);
    let done: i32 = db
        .query_row("SELECT COUNT(*) FROM tasks WHERE done = 1", [], |r| r.get(0))
        .unwrap_or(0);
    lines.push(format!("- Tâches totales : {total}, terminées : {done}"));

    let today_total: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE view_context = 'today'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let today_done: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE view_context = 'today' AND done = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    lines.push(format!(
        "- Tâches du jour : {today_total}, terminées : {today_done}"
    ));

    let with_steps: i32 = db
        .query_row(
            "SELECT COUNT(DISTINCT task_id) FROM micro_steps",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let ai_decomposed: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE ai_decomposed = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    lines.push(format!(
        "- Tâches avec micro-étapes : {with_steps}, décomposées par IA : {ai_decomposed}"
    ));

    let with_estimate: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE estimated_minutes IS NOT NULL",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let avg_estimate: f64 = db
        .query_row(
            "SELECT COALESCE(AVG(estimated_minutes), 0) FROM tasks WHERE estimated_minutes IS NOT NULL",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);
    lines.push(format!(
        "- Tâches avec estimation : {with_estimate}, moyenne : {avg_estimate:.0} min"
    ));

    let scheduled: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE scheduled_date IS NOT NULL",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let unscheduled: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE scheduled_date IS NULL AND done = 0",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    lines.push(format!(
        "- Tâches programmées : {scheduled}, non programmées et actives : {unscheduled}"
    ));

    lines.join("\n")
}

#[tauri::command]
pub async fn generate_suggestions(
    state: State<'_, AppState>,
) -> Result<Vec<Suggestion>, String> {
    let (provider_id, api_key, stats) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let provider = get_active_provider(&db)?;
        let stats = collect_task_stats(&db);
        (provider.id, provider.api_key, stats)
    };

    let system = format!(
        concat!(
            "Tu es l'assistant IA de focal., une app de productivité pour personnes TDAH.\n",
            "Ton rôle est d'analyser les statistiques de l'utilisateur et de générer ",
            "des suggestions personnalisées et actionnables pour améliorer sa productivité.\n\n",
            "{}\n\n",
            "INSTRUCTIONS :\n",
            "- Génère entre 3 et 6 suggestions pertinentes basées sur les données réelles.\n",
            "- Chaque suggestion doit être concrète, bienveillante, et adaptée au TDAH.\n",
            "- Impact : \"high\", \"medium\", ou \"low\".\n",
            "- Catégorie : \"planification\", \"habitudes\", \"focus\", \"organisation\", ou \"bien-être\".\n",
            "- Confidence : entre 60 et 95 (pas 100%).\n",
            "- Source : décris brièvement d'où vient l'observation (ex: \"Basé sur tes 15 tâches actives\").\n",
            "- Icône : un seul emoji pertinent.\n\n",
            "Réponds UNIQUEMENT en JSON valide, un tableau d'objets :\n",
            "[{{\"id\": \"s1\", \"icon\": \"🎯\", \"title\": \"...\", \"description\": \"...\", ",
            "\"source\": \"...\", \"impact\": \"high\", \"category\": \"planification\", \"confidence\": 85}}]\n",
            "Pas de texte avant ou après le JSON. Pas de markdown.",
        ),
        stats
    );

    let msgs = vec![(
        "user".to_string(),
        "Analyse mes données et génère des suggestions personnalisées pour améliorer ma productivité.".to_string(),
    )];

    let raw = call_llm(&provider_id, &api_key, &system, msgs).await?;

    let trimmed = raw.trim();
    if let Ok(suggestions) = serde_json::from_str::<Vec<Suggestion>>(trimmed) {
        return Ok(suggestions);
    }
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(arr) = val.as_array() {
            let suggestions: Vec<Suggestion> = arr
                .iter()
                .enumerate()
                .filter_map(|(i, v)| {
                    Some(Suggestion {
                        id: v
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or(&format!("s{}", i + 1))
                            .to_string(),
                        icon: v.get("icon").and_then(|v| v.as_str())?.to_string(),
                        title: v.get("title").and_then(|v| v.as_str())?.to_string(),
                        description: v.get("description").and_then(|v| v.as_str())?.to_string(),
                        source: v.get("source").and_then(|v| v.as_str())?.to_string(),
                        impact: v
                            .get("impact")
                            .and_then(|v| v.as_str())
                            .unwrap_or("medium")
                            .to_string(),
                        category: v
                            .get("category")
                            .and_then(|v| v.as_str())
                            .unwrap_or("organisation")
                            .to_string(),
                        confidence: v
                            .get("confidence")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(75) as i32,
                    })
                })
                .collect();
            if !suggestions.is_empty() {
                return Ok(suggestions);
            }
        }
    }

    Err("L'IA n'a pas retourné des suggestions dans un format valide.".to_string())
}

/// Strip markdown fences and locate the first valid JSON object containing a "content" field.
fn clean_and_find_json(raw: &str) -> Option<serde_json::Value> {
    let trimmed = raw.trim();
    let clean = if trimmed.starts_with("```") {
        trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        trimmed
    };

    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(clean) {
        if parsed.get("content").and_then(|v| v.as_str()).is_some() {
            return Some(parsed);
        }
    }

    for (i, _) in clean.char_indices().filter(|(_, c)| *c == '{') {
        let slice = &clean[i..];
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(slice) {
            if parsed.get("content").and_then(|v| v.as_str()).is_some() {
                return Some(parsed);
            }
        }
    }

    None
}

// ── Daily Prep ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPrepTask {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_minutes: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPrepTaskUpdate {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPrepResponse {
    pub content: String,
    #[serde(default)]
    pub tasks_to_add: Vec<DailyPrepTask>,
    #[serde(default)]
    pub tasks_to_remove: Vec<String>,
    #[serde(default)]
    pub tasks_to_update: Vec<DailyPrepTaskUpdate>,
    #[serde(default)]
    pub prep_complete: bool,
}

fn build_daily_prep_prompt(db: &rusqlite::Connection) -> String {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tomorrow = (chrono::Local::now() + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    let mut parts = vec![
        "Tu es focal., l'assistant de productivité conçu pour les personnes TDAH.".to_string(),
        "Tu es en mode PRÉPARATION DU JOUR : tu aides l'utilisateur à construire sa journée en discutant avec lui.".to_string(),
        format!("Date d'aujourd'hui : {today}"),
        format!("Date de demain : {tomorrow}"),
        String::new(),
        "RÈGLES DE CONVERSATION :".to_string(),
        "- Pose UNE SEULE question par message. JAMAIS deux questions dans le même message.".to_string(),
        "- Tu ne dictes PAS quoi faire. Tu DEMANDES à l'utilisateur ce qu'il a prévu, ce qui est important, etc.".to_string(),
        "- Tu es un facilitateur : tu aides à formuler, clarifier, prioriser — mais c'est l'utilisateur qui décide.".to_string(),
        "- Tutoie l'utilisateur. Sois chaleureux, bienveillant et encourageant.".to_string(),
        "- Ne fais jamais la morale. Pas de jugement.".to_string(),
        "- Sois concis : des messages courts et naturels, pas des pavés.".to_string(),
        String::new(),
        "DÉROULEMENT NATUREL (pas un script rigide, adapte-toi) :".to_string(),
        "1. Demande ce que l'utilisateur a prévu ou en tête pour aujourd'hui".to_string(),
        "2. Quand il décrit des choses à faire, propose de les ajouter comme tâches (via tasksToAdd)".to_string(),
        "3. Continue à explorer : \"Il y a autre chose ?\" / \"Des réunions, des deadlines ?\"".to_string(),
        "4. Quand il semble avoir tout listé, aide à prioriser : \"Si tu devais n'en faire que 2-3, lesquelles ?\"".to_string(),
        "5. Propose d'estimer les durées si pertinent".to_string(),
        "6. Confirme le plan et propose de lancer la journée (prepComplete: true). IMPORTANT : quand tu mets prepComplete à true, ne remets PAS les tâches déjà ajoutées dans tasksToAdd — elles ont déjà été créées au fil de la conversation.".to_string(),
        String::new(),
        "AJOUT DE TÂCHES :".to_string(),
        "- Quand l'utilisateur mentionne quelque chose à faire, mets-le dans tasksToAdd.".to_string(),
        "- Ne les ajoute que quand l'utilisateur les mentionne ou confirme. Ne les invente pas.".to_string(),
        "- Si tu n'es pas sûr, demande confirmation avant d'ajouter.".to_string(),
        "- Le champ estimatedMinutes est optionnel — ne l'ajoute que si l'utilisateur donne une estimation ou si tu proposes et qu'il confirme.".to_string(),
        "- Le champ priority est optionnel : \"main\" pour prioritaire, \"secondary\" pour secondaire. Ne le mets que si l'utilisateur indique la priorité.".to_string(),
        "- Le champ scheduledDate est optionnel (format YYYY-MM-DD). Par défaut les tâches sont ajoutées pour aujourd'hui. Si l'utilisateur dit \"demain\", \"lundi prochain\", ou une autre date, mets la date correcte.".to_string(),
        "- IMPORTANT : chaque tâche n'est ajoutée qu'UNE SEULE FOIS dans toute la conversation. Ne remets JAMAIS dans tasksToAdd une tâche que tu as déjà ajoutée dans un message précédent.".to_string(),
        String::new(),
        "RETRAIT DE TÂCHES :".to_string(),
        "- Si l'utilisateur demande de retirer/supprimer une tâche, mets son ID dans tasksToRemove.".to_string(),
        "- Confirme le retrait dans ton message.".to_string(),
        String::new(),
        "MODIFICATION DE TÂCHES EXISTANTES :".to_string(),
        "- Si l'utilisateur veut changer la priorité d'une tâche, ou la déplacer à un autre jour, utilise tasksToUpdate.".to_string(),
        "- Chaque entrée dans tasksToUpdate contient l'ID de la tâche et les champs à modifier : priority, scheduledDate, estimatedMinutes.".to_string(),
        "- Pour déprioriser une tâche : mets priority à \"secondary\" ou null.".to_string(),
        "- Pour déplacer une tâche à un autre jour : mets scheduledDate à la date (YYYY-MM-DD). Exemples : \"demain\" → la date de demain, \"lundi\" → la date du prochain lundi, etc.".to_string(),
        String::new(),
    ];

    if let Some(profile) = get_user_profile(db) {
        if let Some(name) = profile.get("firstName").and_then(|v| v.as_str()) {
            parts.push(format!("PRÉNOM DE L'UTILISATEUR : {name}"));
            parts.push(String::new());
        }
    }

    let mut priority_count = 0i32;
    if let Ok(mut stmt) = db.prepare(
        "SELECT id, name, done, priority, estimated_minutes, scheduled_date FROM tasks WHERE view_context = 'today' ORDER BY position",
    ) {
        if let Ok(tasks) = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, bool>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<i32>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        }) {
            let task_lines: Vec<String> = tasks
                .filter_map(|r| r.ok())
                .map(|(id, name, done, pri, est, sched)| {
                    if pri.as_deref() == Some("main") && !done {
                        priority_count += 1;
                    }
                    let check = if done { "✓" } else { "○" };
                    let tag = pri.map_or(String::new(), |p| format!(" [priorité: {p}]"));
                    let est_str = est.map_or(String::new(), |m| format!(" (~{m} min)"));
                    let sched_str = sched.map_or(String::new(), |s| format!(" (planifié: {s})"));
                    format!("  {check} [{id}] {name}{tag}{est_str}{sched_str}")
                })
                .collect();
            if !task_lines.is_empty() {
                parts.push("TÂCHES DÉJÀ PRÉSENTES AUJOURD'HUI (pour référence, ne pas re-proposer) :".to_string());
                parts.push("(L'ID entre crochets est à utiliser pour tasksToRemove et tasksToUpdate)".to_string());
                parts.extend(task_lines);
                parts.push(String::new());
            } else {
                parts.push("AUCUNE TÂCHE AUJOURD'HUI — la journée est vierge, c'est le moment de la construire.".to_string());
                parts.push(String::new());
            }
        }
    }

    if priority_count >= 3 {
        parts.push(format!("ATTENTION : il y a déjà {priority_count} tâches prioritaires (\"main\") aujourd'hui."));
        parts.push("Si l'utilisateur veut ajouter une nouvelle tâche prioritaire, propose-lui de déprioriser une des tâches existantes. Liste-les dans ton message pour qu'il choisisse.".to_string());
        parts.push(String::new());
    }

    parts.push("FORMAT DE RÉPONSE :".to_string());
    parts.push("Réponds UNIQUEMENT en JSON valide :".to_string());
    parts.push(r#"{"content": "ton message", "tasksToAdd": [], "tasksToRemove": [], "tasksToUpdate": [], "prepComplete": false}"#.to_string());
    parts.push("- content : ton message textuel (pas de markdown, utilise \\n pour les paragraphes)".to_string());
    parts.push(format!(r#"- tasksToAdd : tableau de tâches à ajouter [{{"name": "...", "estimatedMinutes": 30, "priority": "main", "scheduledDate": "{today}"}}] — vide si rien à ajouter"#));
    parts.push("- tasksToRemove : tableau d'IDs de tâches à supprimer [\"id1\", \"id2\"] — vide si rien à supprimer".to_string());
    parts.push(format!(r#"- tasksToUpdate : tableau de modifications [{{"id": "...", "priority": "secondary", "scheduledDate": "{tomorrow}"}}] — vide si rien à modifier"#));
    parts.push("- prepComplete : true UNIQUEMENT quand l'utilisateur confirme que la préparation est terminée".to_string());
    parts.push("- Pas de texte avant ou après le JSON".to_string());

    parts.join("\n")
}

fn parse_daily_prep_response(raw: &str) -> Result<DailyPrepResponse, String> {
    let Some(parsed) = clean_and_find_json(raw) else {
        return Ok(DailyPrepResponse {
            content: raw.to_string(),
            tasks_to_add: vec![],
            tasks_to_remove: vec![],
            tasks_to_update: vec![],
            prep_complete: false,
        });
    };

    let content = parsed.get("content").and_then(|v| v.as_str()).unwrap_or(raw).to_string();

    let tasks_to_add = parsed
        .get("tasksToAdd")
        .or_else(|| parsed.get("tasks_to_add"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| {
                    let name = t.get("name").and_then(|v| v.as_str())?.to_string();
                    let estimated_minutes = t
                        .get("estimatedMinutes")
                        .or_else(|| t.get("estimated_minutes"))
                        .and_then(|v| v.as_i64())
                        .map(|m| m as i32);
                    let priority = t.get("priority").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let scheduled_date = t
                        .get("scheduledDate")
                        .or_else(|| t.get("scheduled_date"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    Some(DailyPrepTask { name, estimated_minutes, priority, scheduled_date })
                })
                .collect()
        })
        .unwrap_or_default();

    let tasks_to_remove = parsed
        .get("tasksToRemove")
        .or_else(|| parsed.get("tasks_to_remove"))
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let tasks_to_update = parsed
        .get("tasksToUpdate")
        .or_else(|| parsed.get("tasks_to_update"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| {
                    let id = t.get("id").and_then(|v| v.as_str())?.to_string();
                    let priority = t.get("priority").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let scheduled_date = t
                        .get("scheduledDate")
                        .or_else(|| t.get("scheduled_date"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let estimated_minutes = t
                        .get("estimatedMinutes")
                        .or_else(|| t.get("estimated_minutes"))
                        .and_then(|v| v.as_i64())
                        .map(|m| m as i32);
                    Some(DailyPrepTaskUpdate { id, priority, scheduled_date, estimated_minutes })
                })
                .collect()
        })
        .unwrap_or_default();

    let prep_complete = parsed
        .get("prepComplete")
        .or_else(|| parsed.get("prep_complete"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    Ok(DailyPrepResponse { content, tasks_to_add, tasks_to_remove, tasks_to_update, prep_complete })
}

#[tauri::command]
pub async fn send_daily_prep_message(
    state: State<'_, AppState>,
    user_message: String,
    history: String,
) -> Result<DailyPrepResponse, String> {
    let (provider_id, api_key, system_prompt) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let provider = get_active_provider(&db)?;
        let system = build_daily_prep_prompt(&db);
        (provider.id, provider.api_key, system)
    };

    let past: Vec<HistoryMsg> = serde_json::from_str(&history).unwrap_or_default();
    let mut msgs: Vec<(String, String)> = past.into_iter().map(|m| (m.role, m.content)).collect();
    msgs.push(("user".to_string(), user_message));

    let raw = call_llm(&provider_id, &api_key, &system_prompt, msgs).await?;
    parse_daily_prep_response(&raw)
}

// ── Onboarding ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingResponse {
    pub content: String,
    #[serde(default)]
    pub profile_updates: serde_json::Value,
    #[serde(default)]
    pub onboarding_complete: bool,
}

fn build_onboarding_prompt(current_profile: &str) -> String {
    format!(
        r#"Tu es focal., l'assistant d'aide à la productivité conçu pour les personnes TDAH.
Tu es en mode onboarding : c'est la première fois que l'utilisateur utilise l'application.
Ton objectif est de faire connaissance avec l'utilisateur de manière naturelle et bienveillante pour remplir son profil.

RÈGLES DE CONVERSATION :
- Pose UNE SEULE question par message. JAMAIS deux questions dans le même message, même séparées par un saut de ligne.
- Ne fais pas un formulaire, discute naturellement
- Tutoie l'utilisateur
- Sois chaleureux, bienveillant et encourageant
- Reformule positivement ce que l'utilisateur dit
- Ne fais jamais la morale
- Attends la réponse de l'utilisateur avant de passer au sujet suivant

MESSAGE DE BIENVENUE (déjà affiché à l'utilisateur) :
"Salut ! Bienvenue sur focal. ✨

Je suis ton assistant de productivité, pensé spécialement pour les cerveaux qui fonctionnent un peu différemment.

Avant de commencer, j'aimerais apprendre à te connaître pour adapter l'outil à ton fonctionnement. On va discuter quelques minutes, rien de compliqué.

Comment tu t'appelles ?"

Le premier message de l'utilisateur sera sa réponse à cette question. Continue la conversation à partir de là.

PROFIL À REMPLIR (champs et valeurs autorisées) :
- firstName : prénom (texte libre)
- mainContext : contexte principal → "travail_salarie", "independant", "etudes", "parent", "mix", "autre"
- mainContextOther : si mainContext = "autre", précision (texte libre)
- jobActivity : métier ou activité principale (texte libre)
- adhdRecognition : reconnaissance du TDAH → "diagnostique" (diagnostiqué), "fortement" (se reconnaît fortement), "un_peu" (un peu), "non" (pas du tout / je ne sais pas)
- blockers : ce qui bloque le plus (TABLEAU, plusieurs choix possibles) → "commencer" (savoir par quoi commencer), "oublier" (ne pas oublier), "agir" (passer à l'action), "finir" (finir ce qu'on commence), "trop_head" (trop de choses en tête), "motivation" (manque de motivation)
- remindersPreference : préférence rappels → "clairs_frequents", "peu_choisis", "minimum", "ca_depend"
- organizationHorizon : horizon d'organisation → "aujourdhui", "semaine", "projets_longs", "mix"
- mainExpectation : attente principale envers focal → "me_dire_quoi_faire", "prioriser", "allege_tete", "avancer_sans_pression", "cadrer"
- extraInfo : info supplémentaire (texte libre, optionnel)

INSTRUCTIONS DE REMPLISSAGE :
- Déduis les valeurs à partir des réponses naturelles (l'utilisateur ne connaît pas les clés techniques)
- Exemple : "j'oublie tout et j'arrive jamais à commencer" → blockers: ["oublier", "commencer"]
- Ordre naturel : prénom → contexte/métier → LIENS PUBLICS → TDAH → blocages → préférences → attentes
- Tu n'es pas obligé de remplir TOUS les champs
- extraInfo est optionnel, propose-le seulement à la fin

LIENS PUBLICS (étape dédiée, un message entier rien que pour ça) :
- Après avoir compris le contexte et le métier, consacre un message ENTIER uniquement à cette question. N'ajoute AUCUNE autre question dans ce message.
- Formule ça de manière naturelle et optionnelle, par exemple : "Au fait, si tu as un profil LinkedIn ou un site perso, tu peux me le partager — ça m'aidera à mieux cerner ton univers pro. Sinon, pas de souci, on continue !"
- Si l'utilisateur partage une ou plusieurs URLs, mets-les dans profileUpdates avec le champ "profileUrls" (un tableau de strings)
- Exemple : si l'utilisateur dit "voici mon LinkedIn https://linkedin.com/in/toto" → profileUpdates: {{"profileUrls": ["https://linkedin.com/in/toto"]}}
- Si l'utilisateur ne veut pas partager, c'est OK, passe à la suite sans insister
- Ne repose pas la question s'il a déjà répondu
- Après sa réponse (qu'il partage un lien ou non), passe au TDAH dans le message SUIVANT

PROFIL ACTUEL :
{current_profile}

COMPLÉTION :
Quand le profil contient au minimum firstName, mainContext, adhdRecognition et blockers, propose de terminer. S'il accepte, mets onboardingComplete à true avec un message de conclusion encourageant.

FORMAT DE RÉPONSE :
Réponds UNIQUEMENT en JSON valide :
{{"content": "ton message", "profileUpdates": {{}}, "onboardingComplete": false}}
- profileUpdates : seulement les champs nouveaux/modifiés (objet vide si rien)
- onboardingComplete : true uniquement quand l'utilisateur confirme terminer
- Pas de markdown dans content, utilise \n pour les paragraphes
- Pas de texte avant ou après le JSON"#
    )
}

fn parse_onboarding_response(raw: &str) -> Result<OnboardingResponse, String> {
    let Some(parsed) = clean_and_find_json(raw) else {
        return Ok(OnboardingResponse {
            content: raw.to_string(),
            profile_updates: serde_json::Value::Object(Default::default()),
            onboarding_complete: false,
        });
    };

    let content = parsed.get("content").and_then(|v| v.as_str()).unwrap_or(raw).to_string();
    let profile_updates = parsed
        .get("profileUpdates")
        .or_else(|| parsed.get("profile_updates"))
        .cloned()
        .unwrap_or(serde_json::Value::Object(Default::default()));
    let onboarding_complete = parsed
        .get("onboardingComplete")
        .or_else(|| parsed.get("onboarding_complete"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    Ok(OnboardingResponse { content, profile_updates, onboarding_complete })
}

#[tauri::command]
pub async fn send_onboarding_message(
    state: State<'_, AppState>,
    user_message: String,
    history: String,
    current_profile: String,
) -> Result<OnboardingResponse, String> {
    let (provider_id, api_key) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let provider = get_active_provider(&db)?;
        (provider.id, provider.api_key)
    };

    let system_prompt = build_onboarding_prompt(&current_profile);

    let past: Vec<HistoryMsg> = serde_json::from_str(&history).unwrap_or_default();
    let mut msgs: Vec<(String, String)> = past.into_iter().map(|m| (m.role, m.content)).collect();
    msgs.push(("user".to_string(), user_message));

    let raw = call_llm(&provider_id, &api_key, &system_prompt, msgs).await?;
    parse_onboarding_response(&raw)
}

// ── Analyse de profil public ──

async fn fetch_url_text(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (compatible; focal-app/1.0)")
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Client HTTP error: {e}"))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Impossible de charger l'URL: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("L'URL a retourné le statut {}", resp.status()));
    }

    let body = resp
        .text()
        .await
        .map_err(|e| format!("Erreur de lecture du contenu: {e}"))?;

    // Strip HTML tags to get readable text, keep it under ~6000 chars for the LLM
    let text = body
        .split('<')
        .filter_map(|seg| {
            seg.find('>').map(|i| &seg[i + 1..])
        })
        .collect::<Vec<&str>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");

    let truncated = if text.len() > 6000 {
        let end = text.char_indices()
            .take_while(|(i, _)| *i < 6000)
            .last()
            .map(|(i, c)| i + c.len_utf8())
            .unwrap_or(text.len());
        format!("{}…", &text[..end])
    } else {
        text
    };

    Ok(truncated)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAnalysis {
    pub summary: String,
    pub source_url: String,
}

#[tauri::command]
pub async fn analyze_profile_url(
    state: State<'_, AppState>,
    url: String,
) -> Result<ProfileAnalysis, String> {
    let page_text = fetch_url_text(&url).await?;

    if page_text.trim().len() < 30 {
        return Err("Le contenu de la page est trop court ou inaccessible.".to_string());
    }

    let (provider_id, api_key) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let provider = get_active_provider(&db)?;
        (provider.id, provider.api_key)
    };

    let system = concat!(
        "Tu es un assistant qui analyse des pages de profil public (LinkedIn, site web, portfolio, etc.).\n",
        "Ton objectif est d'extraire un résumé concis et utile sur la personne : qui elle est, ce qu'elle fait, ",
        "ses compétences clés, son secteur d'activité, et tout ce qui peut être pertinent pour adapter un outil de productivité.\n\n",
        "RÈGLES :\n",
        "- Résumé en 3 à 6 phrases maximum\n",
        "- En français\n",
        "- Factuel, pas de spéculation\n",
        "- Mentionne le métier/rôle, le secteur, les compétences principales\n",
        "- Si c'est un site d'entreprise, décris l'activité de l'entreprise et le rôle probable de la personne\n",
        "- Réponds UNIQUEMENT avec le texte du résumé, sans JSON, sans markdown, sans préambule",
    );

    let prompt = format!(
        "Voici le contenu textuel extrait de la page {url} :\n\n{page_text}\n\nRésume ce que tu apprends sur cette personne."
    );

    let msgs = vec![("user".to_string(), prompt)];
    let summary = call_llm(&provider_id, &api_key, system, msgs).await?;

    Ok(ProfileAnalysis {
        summary: summary.trim().to_string(),
        source_url: url,
    })
}
