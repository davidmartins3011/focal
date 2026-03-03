use super::OAuthTokens;
use rusqlite::{params, Connection};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// Runs the full OAuth authorization code flow:
/// 1. Starts a local HTTP server on a random port
/// 2. Opens the auth URL in the user's default browser
/// 3. Waits for the callback (with timeout)
/// 4. Exchanges the auth code for tokens
pub async fn run_oauth_flow(
    client_id: &str,
    client_secret: &str,
    auth_endpoint: &str,
    token_endpoint: &str,
    scopes: &str,
) -> Result<OAuthTokens, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Impossible de démarrer le serveur OAuth: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();
    let redirect_uri = format!("http://localhost:{port}/callback");

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        auth_endpoint,
        urlencoding::encode(client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(scopes),
    );

    open::that_detached(&auth_url)
        .map_err(|e| format!("Impossible d'ouvrir le navigateur: {e}"))?;

    let code = tokio::time::timeout(
        Duration::from_secs(300),
        wait_for_callback(listener),
    )
    .await
    .map_err(|_| "Timeout : l'autorisation n'a pas été complétée dans les 5 minutes.".to_string())?
    ?;

    exchange_code(&code, client_id, client_secret, &redirect_uri, token_endpoint).await
}

/// Listens for a single HTTP request on the bound listener,
/// extracts the `code` query parameter, and sends a user-friendly HTML response.
async fn wait_for_callback(listener: TcpListener) -> Result<String, String> {
    let (mut stream, _) = listener
        .accept()
        .await
        .map_err(|e| format!("Erreur serveur OAuth: {e}"))?;

    let mut buf = vec![0u8; 4096];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("Erreur lecture callback: {e}"))?;

    let request = String::from_utf8_lossy(&buf[..n]);
    let first_line = request.lines().next().ok_or("Requête vide")?;
    let path = first_line
        .split_whitespace()
        .nth(1)
        .ok_or("Requête HTTP invalide")?;

    if let Some(error) = extract_param(path, "error") {
        let html = format!(
            "<html><body style='font-family:system-ui;text-align:center;padding:60px'>\
             <h2 style='color:#e74c3c'>Erreur d'autorisation</h2>\
             <p>{error}</p>\
             <p style='color:#888'>Tu peux fermer cet onglet.</p>\
             </body></html>"
        );
        send_response(&mut stream, &html).await;
        return Err(format!("Autorisation refusée : {error}"));
    }

    let code = extract_param(path, "code")
        .ok_or("Paramètre 'code' manquant dans le callback")?;

    let html = "<html><body style='font-family:system-ui;text-align:center;padding:60px'>\
        <h2 style='color:#27ae60'>✓ Connecté avec succès !</h2>\
        <p>Tu peux fermer cet onglet et retourner sur <strong>focal.</strong></p>\
        </body></html>";
    send_response(&mut stream, html).await;

    Ok(code)
}

async fn send_response(stream: &mut tokio::net::TcpStream, html: &str) {
    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n{html}"
    );
    let _ = stream.write_all(resp.as_bytes()).await;
    let _ = stream.flush().await;
}

fn extract_param(path: &str, key: &str) -> Option<String> {
    let query = path.split('?').nth(1)?;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        if kv.next()? == key {
            return kv.next().map(|v| urlencoding::decode(v).unwrap_or_default().into_owned());
        }
    }
    None
}

async fn exchange_code(
    code: &str,
    client_id: &str,
    client_secret: &str,
    redirect_uri: &str,
    token_endpoint: &str,
) -> Result<OAuthTokens, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(token_endpoint)
        .form(&[
            ("code", code),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Erreur réseau (token exchange): {e}"))?;

    parse_token_response(resp).await
}

pub async fn refresh_access_token(
    refresh_token: &str,
    client_id: &str,
    client_secret: &str,
    token_endpoint: &str,
) -> Result<OAuthTokens, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(token_endpoint)
        .form(&[
            ("refresh_token", refresh_token),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| format!("Erreur réseau (refresh token): {e}"))?;

    parse_token_response(resp).await
}

async fn parse_token_response(resp: reqwest::Response) -> Result<OAuthTokens, String> {
    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Erreur parsing réponse token: {e}"))?;

    if let Some(err) = data.get("error").and_then(|v| v.as_str()) {
        let desc = data
            .get("error_description")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        return Err(format!("Erreur OAuth: {err} — {desc}"));
    }

    Ok(OAuthTokens {
        access_token: data["access_token"]
            .as_str()
            .ok_or("access_token manquant dans la réponse")?
            .to_string(),
        refresh_token: data["refresh_token"].as_str().map(|s| s.to_string()),
        token_type: data["token_type"]
            .as_str()
            .unwrap_or("Bearer")
            .to_string(),
        expires_at: data["expires_in"].as_i64().map(|secs| {
            (chrono::Utc::now() + chrono::Duration::seconds(secs)).to_rfc3339()
        }),
        scopes: data["scope"].as_str().unwrap_or("").to_string(),
    })
}

// ─── DB helpers ───

pub fn store_tokens(
    db: &Connection,
    integration_id: &str,
    tokens: &OAuthTokens,
    account_email: &str,
) -> Result<(), String> {
    db.execute(
        "INSERT OR REPLACE INTO oauth_tokens (integration_id, account_email, access_token, refresh_token, token_type, expires_at, scopes) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            integration_id,
            account_email,
            tokens.access_token,
            tokens.refresh_token,
            tokens.token_type,
            tokens.expires_at,
            tokens.scopes,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_tokens(db: &Connection, integration_id: &str) -> Result<OAuthTokens, String> {
    db.query_row(
        "SELECT access_token, refresh_token, token_type, expires_at, scopes FROM oauth_tokens WHERE integration_id = ?1",
        params![integration_id],
        |row| {
            Ok(OAuthTokens {
                access_token: row.get(0)?,
                refresh_token: row.get(1)?,
                token_type: row.get(2)?,
                expires_at: row.get(3)?,
                scopes: row.get(4)?,
            })
        },
    )
    .map_err(|_| format!("Aucun token OAuth trouvé pour l'intégration '{integration_id}'"))
}

pub fn delete_tokens(db: &Connection, integration_id: &str) -> Result<(), String> {
    db.execute(
        "DELETE FROM oauth_tokens WHERE integration_id = ?1",
        params![integration_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn store_credentials(
    db: &Connection,
    provider: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<(), String> {
    db.execute(
        "INSERT OR REPLACE INTO oauth_credentials (provider, client_id, client_secret) VALUES (?1, ?2, ?3)",
        params![provider, client_id, client_secret],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_credentials(db: &Connection, provider: &str) -> Result<(String, String), String> {
    db.query_row(
        "SELECT client_id, client_secret FROM oauth_credentials WHERE provider = ?1",
        params![provider],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|_| format!("Aucun identifiant OAuth configuré pour '{provider}'. Configure-les dans les intégrations."))
}

/// Returns a valid access token, refreshing it if expired.
pub async fn get_valid_access_token(
    db_tokens: OAuthTokens,
    provider: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<(String, Option<OAuthTokens>), String> {
    if let Some(ref expires_at) = db_tokens.expires_at {
        if let Ok(exp) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            let buffer = chrono::Utc::now() + chrono::Duration::minutes(5);
            if exp > buffer {
                return Ok((db_tokens.access_token.clone(), None));
            }
        }
    }

    let refresh_token = db_tokens
        .refresh_token
        .as_deref()
        .ok_or("Token expiré et pas de refresh_token disponible. Reconnecte l'intégration.")?;

    let token_endpoint = match provider {
        "google" => super::google::TOKEN_ENDPOINT,
        _ => return Err(format!("Provider inconnu pour refresh: {provider}")),
    };

    let mut new_tokens =
        refresh_access_token(refresh_token, client_id, client_secret, token_endpoint).await?;

    // Google doesn't always return a new refresh_token, keep the old one
    if new_tokens.refresh_token.is_none() {
        new_tokens.refresh_token = db_tokens.refresh_token.clone();
    }

    Ok((new_tokens.access_token.clone(), Some(new_tokens)))
}
