use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::models::AppState;

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

    if let Ok(profile_json) = db.query_row(
        "SELECT data FROM user_profile WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    ) {
        if let Ok(profile) = serde_json::from_str::<serde_json::Value>(&profile_json) {
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
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
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
