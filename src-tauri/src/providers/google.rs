use super::{CalendarEvent, EmailMessage};

pub const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
pub const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";

/// Fetches the email address of the authenticated Google account.
pub async fn fetch_user_email(access_token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(USERINFO_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Erreur userinfo Google: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Google userinfo API {status}: {body}"));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    data["email"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Email introuvable dans la réponse userinfo".to_string())
}

pub async fn fetch_calendar_events(
    access_token: &str,
    time_min: &str,
    time_max: &str,
) -> Result<Vec<CalendarEvent>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .bearer_auth(access_token)
        .query(&[
            ("timeMin", format!("{time_min}T00:00:00Z")),
            ("timeMax", format!("{time_max}T23:59:59Z")),
            ("singleEvents", "true".into()),
            ("orderBy", "startTime".into()),
            ("maxResults", "50".into()),
        ])
        .send()
        .await
        .map_err(|e| format!("Erreur Calendar API: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Google Calendar API {status}: {body}"));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let empty = vec![];
    let items = data["items"].as_array().unwrap_or(&empty);

    let events = items
        .iter()
        .filter_map(|item| {
            let start = item["start"]["dateTime"]
                .as_str()
                .or_else(|| item["start"]["date"].as_str())?
                .to_string();
            let end = item["end"]["dateTime"]
                .as_str()
                .or_else(|| item["end"]["date"].as_str())?
                .to_string();

            Some(CalendarEvent {
                id: item["id"].as_str()?.to_string(),
                title: item["summary"]
                    .as_str()
                    .unwrap_or("(sans titre)")
                    .to_string(),
                description: item["description"].as_str().map(|s| s.to_string()),
                start,
                end,
                location: item["location"].as_str().map(|s| s.to_string()),
                attendees: item["attendees"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|a| a["email"].as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
                source: "google-calendar".to_string(),
            })
        })
        .collect();

    Ok(events)
}

pub async fn fetch_emails(
    access_token: &str,
    query: Option<&str>,
    max_results: u32,
) -> Result<Vec<EmailMessage>, String> {
    let client = reqwest::Client::new();

    let mut params: Vec<(&str, String)> = vec![("maxResults", max_results.to_string())];
    if let Some(q) = query {
        params.push(("q", q.to_string()));
    }

    let resp = client
        .get("https://gmail.googleapis.com/gmail/v1/users/me/messages")
        .bearer_auth(access_token)
        .query(&params)
        .send()
        .await
        .map_err(|e| format!("Erreur Gmail API: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Gmail API {status}: {body}"));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let empty = vec![];
    let message_refs = data["messages"].as_array().unwrap_or(&empty);

    let mut messages = Vec::new();
    for msg_ref in message_refs.iter().take(max_results as usize) {
        let msg_id = match msg_ref["id"].as_str() {
            Some(id) => id,
            None => continue,
        };
        match fetch_single_email(&client, access_token, msg_id).await {
            Ok(msg) => messages.push(msg),
            Err(_) => continue,
        }
    }

    Ok(messages)
}

async fn fetch_single_email(
    client: &reqwest::Client,
    access_token: &str,
    id: &str,
) -> Result<EmailMessage, String> {
    let resp = client
        .get(format!(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}"
        ))
        .bearer_auth(access_token)
        .query(&[
            ("format", "metadata"),
            ("metadataHeaders", "Subject"),
            ("metadataHeaders", "From"),
            ("metadataHeaders", "To"),
            ("metadataHeaders", "Date"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let empty_headers = vec![];
    let headers = data["payload"]["headers"]
        .as_array()
        .unwrap_or(&empty_headers);

    let get_header = |name: &str| -> String {
        headers
            .iter()
            .find(|h| h["name"].as_str() == Some(name))
            .and_then(|h| h["value"].as_str())
            .unwrap_or("")
            .to_string()
    };

    let labels: Vec<String> = data["labelIds"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|l| l.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let is_read = !labels.contains(&"UNREAD".to_string());

    Ok(EmailMessage {
        id: id.to_string(),
        subject: get_header("Subject"),
        from: get_header("From"),
        to: get_header("To")
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        snippet: data["snippet"].as_str().unwrap_or("").to_string(),
        date: get_header("Date"),
        is_read,
        labels,
        source: "gmail".to_string(),
    })
}
