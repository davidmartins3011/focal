pub mod google;
pub mod oauth;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start: String,
    pub end: String,
    pub location: Option<String>,
    pub attendees: Vec<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailMessage {
    pub id: String,
    pub subject: String,
    pub from: String,
    pub to: Vec<String>,
    pub snippet: String,
    pub date: String,
    pub is_read: bool,
    pub labels: Vec<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_at: Option<String>,
    pub scopes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthCredentialsInfo {
    pub provider: String,
    pub client_id: String,
    pub configured: bool,
}

/// Maps an integration ID to its OAuth provider.
/// Returns None for integrations that don't use OAuth.
pub fn provider_for_integration(integration_id: &str) -> Option<&'static str> {
    match integration_id {
        "google-calendar" | "gmail" | "google-drive" => Some("google"),
        "outlook-calendar" | "outlook-mail" => Some("microsoft"),
        _ => None,
    }
}

/// Returns the OAuth scopes needed for a specific integration.
pub fn scopes_for_integration(integration_id: &str) -> Option<&'static str> {
    match integration_id {
        "google-calendar" => Some(
            "https://www.googleapis.com/auth/calendar.readonly \
             https://www.googleapis.com/auth/userinfo.email",
        ),
        "gmail" => Some(
            "https://www.googleapis.com/auth/gmail.readonly \
             https://www.googleapis.com/auth/userinfo.email",
        ),
        "google-drive" => Some(
            "https://www.googleapis.com/auth/drive.readonly \
             https://www.googleapis.com/auth/userinfo.email",
        ),
        _ => None,
    }
}
