# Intégrations et OAuth

> Le système d'intégrations permet de connecter des services externes (Google Calendar, Gmail, etc.)
> via OAuth 2.0. Les tokens sont stockés localement en SQLite, par intégration.

---

## Architecture

```
src-tauri/src/
├── commands/integrations.rs   # Commandes Tauri (CRUD + OAuth + data fetching)
└── providers/
    ├── mod.rs                 # Types partagés, mapping intégrations ↔ providers, scopes
    ├── oauth.rs               # Flux OAuth générique (auth code flow)
    └── google.rs              # Connecteur Google (Calendar + Gmail)
```

---

## Providers supportés

| Provider | Intégrations associées | APIs utilisées |
|----------|----------------------|----------------|
| Google | `google-calendar`, `gmail`, `google-drive` | Google Calendar API v3, Gmail API v1 |
| Microsoft | `outlook-calendar`, `outlook-mail` | (mapping défini, connecteur non implémenté) |

### Mapping intégrations ↔ providers

Le module `providers/mod.rs` expose deux fonctions clés :

- `provider_for_integration(id)` — Retourne le provider OAuth associé à une intégration (ex: `"google-calendar"` → `"google"`)
- `scopes_for_integration(id)` — Retourne les scopes OAuth nécessaires pour une intégration spécifique

### Scopes par intégration

| Intégration | Scopes |
|-------------|--------|
| `google-calendar` | `calendar.readonly`, `userinfo.email` |
| `gmail` | `gmail.readonly`, `userinfo.email` |
| `google-drive` | `drive.readonly`, `userinfo.email` |

Chaque intégration demande ses propres scopes. Le scope `userinfo.email` est systématiquement ajouté pour récupérer l'email du compte connecté.

---

## Stockage des tokens OAuth

Les tokens sont stockés **par intégration** (pas par provider). Chaque intégration connectée possède sa propre entrée dans `oauth_tokens` avec `integration_id` comme clé primaire.

Quand une intégration est déconnectée via `disconnect_integration()`, ses tokens sont immédiatement supprimés.

---

## Flux OAuth (providers/oauth.rs)

### Authorization Code Flow

```
Utilisateur                     Focal (Rust)                    Navigateur / Provider
───────────                     ────────────                    ─────────────────────
                                                               
Clique "Connecter" ──────────►  start_oauth()                  
                                  │                            
                                  ├─ Vérifie les credentials OAuth en DB
                                  ├─ Si tokens existants → marque connecté, terminé
                                  ├─ Démarre un serveur TCP local (port aléatoire)
                                  ├─ Construit l'URL d'autorisation (avec les scopes de l'intégration)
                                  └─ Ouvre le navigateur ──────────────────────────►
                                                                │
                                                                ├─ L'utilisateur s'authentifie
                                                                ├─ L'utilisateur autorise l'app
                                                                └─ Redirige vers localhost:PORT/callback?code=xxx
                                  │                            
                                  ├─ Reçoit le callback (timeout 5 min)
                                  ├─ Extrait le paramètre `code`
                                  ├─ Échange le code contre des tokens ──────────►
                                  │                              │
                                  │ ◄──── access_token + refresh_token ──────────┘
                                  ├─ Stocke les tokens en DB (oauth_tokens, clé = integration_id)
                                  ├─ Récupère l'email du compte via userinfo
                                  ├─ Marque l'intégration comme connectée (+ account_email)
                                  └─ Affiche une page HTML de succès dans le navigateur
```

### Refresh automatique

`get_valid_access_token()` vérifie l'expiration du token (avec 5 min de marge) et le rafraîchit automatiquement si nécessaire. Le nouveau token est persisté en DB.

### Déconnexion

`disconnect_integration()` :
1. Marque l'intégration comme déconnectée
2. Supprime les tokens OAuth de la DB pour cette intégration

---

## Google (providers/google.rs)

### Endpoints

```
AUTH:  https://accounts.google.com/o/oauth2/v2/auth
TOKEN: https://oauth2.googleapis.com/token
```

### Google Calendar API

`fetch_calendar_events(access_token, time_min, time_max)` :
- Endpoint : `GET /calendar/v3/calendars/primary/events`
- Paramètres : `timeMin`, `timeMax`, `singleEvents=true`, `orderBy=startTime`, `maxResults=50`
- Retourne : `Vec<CalendarEvent>`

### Gmail API

`fetch_emails(access_token, query?, max_results)` :
- Étape 1 : `GET /gmail/v1/users/me/messages` → liste des IDs
- Étape 2 : Pour chaque ID, `GET /gmail/v1/users/me/messages/{id}?format=metadata` → détails
- Headers extraits : Subject, From, To, Date
- Retourne : `Vec<EmailMessage>`

---

## Types de données

### CalendarEvent

```rust
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start: String,          // ISO datetime ou date
    pub end: String,
    pub location: Option<String>,
    pub attendees: Vec<String>, // adresses email
    pub source: String,         // "google-calendar"
}
```

### EmailMessage

```rust
pub struct EmailMessage {
    pub id: String,
    pub subject: String,
    pub from: String,
    pub to: Vec<String>,
    pub snippet: String,
    pub date: String,
    pub is_read: bool,
    pub labels: Vec<String>,   // Gmail labels (INBOX, UNREAD, etc.)
    pub source: String,        // "gmail"
}
```

### OAuthTokens

```rust
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,       // "Bearer"
    pub expires_at: Option<String>, // ISO datetime (calculé depuis expires_in)
    pub scopes: String,
}
```

### OAuthCredentialsInfo

```rust
pub struct OAuthCredentialsInfo {
    pub provider: String,
    pub client_id: String,
    pub configured: bool,
}
```

---

## Stockage en base

### Table `oauth_credentials`

| Colonne | Type | Description |
|---------|------|-------------|
| provider | TEXT PK | "google", "microsoft", etc. |
| client_id | TEXT | Client ID de l'app OAuth |
| client_secret | TEXT | Client Secret de l'app OAuth |

### Table `oauth_tokens`

| Colonne | Type | Description |
|---------|------|-------------|
| integration_id | TEXT PK | ID de l'intégration (ex: "google-calendar") |
| account_email | TEXT | Email du compte connecté |
| access_token | TEXT | Token d'accès courant |
| refresh_token | TEXT | Token de rafraîchissement (nullable) |
| token_type | TEXT | "Bearer" |
| expires_at | TEXT | ISO datetime d'expiration |
| scopes | TEXT | Scopes autorisés |

### Colonne `oauth_provider` dans `integrations`

Chaque intégration peut avoir un champ `oauth_provider` (nullable) qui indique quel provider OAuth utiliser (ex: `"google"`). Les intégrations sans OAuth ont ce champ à `NULL`.

### Colonne `account_email` dans `integrations`

Stocke l'email du compte connecté pour affichage dans l'UI.

---

## Services frontend (src/services/integrations.ts)

| Fonction | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `getIntegrations` | — | `Integration[]` | Liste toutes les intégrations |
| `updateIntegrationConnection` | `id, connected` | `Integration` | Toggle connexion |
| `updateIntegrationContext` | `id, rules, extraContext` | `Integration` | Met à jour les directives |
| `getOAuthCredentials` | `provider` | `OAuthCredentialsInfo` | Vérifie la config OAuth |
| `setOAuthCredentials` | `provider, clientId, clientSecret` | `void` | Enregistre les credentials |
| `startOAuth` | `integrationId` | `void` | Lance le flux OAuth |
| `disconnectIntegration` | `integrationId` | `Integration` | Déconnecte |
| `fetchCalendarEvents` | `integrationId, dateFrom, dateTo` | `CalendarEvent[]` | Événements calendrier |
| `fetchEmails` | `integrationId, query?, maxResults?` | `EmailMessage[]` | Emails |

---

## Points d'attention pour l'IA qui code

1. **Tokens par intégration** : chaque intégration a ses propres tokens dans `oauth_tokens` (clé = `integration_id`)
2. **Credentials = config utilisateur** : Le `client_id` / `client_secret` est saisi par l'utilisateur dans l'UI (il doit créer son propre projet Google Cloud)
3. **Refresh automatique** : Chaque appel API vérifie l'expiration et rafraîchit si nécessaire (5 min de marge)
4. **Serveur local temporaire** : Le flux OAuth démarre un serveur TCP sur un port aléatoire, qui s'arrête après le callback
5. **Timeout 5 minutes** : Si l'utilisateur n'autorise pas dans les 5 minutes, le flux échoue
6. **Scopes par intégration** : chaque intégration demande ses propres scopes (incluant toujours `userinfo.email`)
7. **Microsoft non implémenté** : Le mapping existe (`outlook-calendar`, `outlook-mail`) mais le connecteur n'est pas encore codé
