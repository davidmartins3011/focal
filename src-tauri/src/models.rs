use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub label: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MicroStep {
    pub id: String,
    pub text: String,
    pub done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub done: bool,
    pub tags: Vec<Tag>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub micro_steps: Option<Vec<MicroStep>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_decomposed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_minutes: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageStep {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<Vec<ChatMessageStep>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyPillar {
    pub id: String,
    pub name: String,
    pub tag_color: String,
    pub goal: String,
    pub progress: i32,
    pub insight: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyReflection {
    pub id: String,
    pub prompt: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyReview {
    pub id: String,
    pub month: i32,
    pub year: i32,
    pub created_at: String,
    pub pillars: Vec<StrategyPillar>,
    pub reflections: Vec<StrategyReflection>,
    pub top3: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationRule {
    pub id: String,
    pub text: String,
    pub urgency: i32,
    pub importance: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationContext {
    pub rules: Vec<IntegrationRule>,
    pub extra_context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Integration {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub connected: bool,
    pub category: String,
    pub context: IntegrationContext,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oauth_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationHistoryEntry {
    pub id: String,
    pub reminder_id: String,
    pub icon: String,
    pub label: String,
    pub description: String,
    pub scheduled_time: String,
    pub fired_at: String,
    pub missed: bool,
    pub read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileResearchSource {
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scraped_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub main_context: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub main_context_other: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub job_activity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_research: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_research_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_research_identifier_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_research_sources: Option<Vec<ProfileResearchSource>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adhd_recognition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blockers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reminders_preference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_horizon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub main_expectation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_info: Option<String>,
}
