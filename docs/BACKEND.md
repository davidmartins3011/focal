# Backend Rust (Tauri)

> Le backend est en Rust, utilisant Tauri 2 comme framework desktop.
> Il expose des commandes via IPC que le frontend appelle via `invoke()`.

---

## Point d'entrée

- `main.rs` : appelle `focal_lib::run()`
- `lib.rs` : initialise la base SQLite, enregistre toutes les commandes Tauri

### Initialisation (lib.rs)

```rust
tauri::Builder::default()
    .setup(|app| {
        let db_path = app.path().app_data_dir()?.join("focal.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        db::create_schema(&conn)?;
        db::seed_if_empty(&conn)?;
        app.manage(AppState { db: Mutex::new(conn) });
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![...36 commandes...])
```

Modules déclarés dans `lib.rs` :
- `commands` — Commandes Tauri (API backend)
- `db` — Schéma et initialisation SQLite
- `models` — Structures de données sérialisables
- `providers` — Connecteurs APIs externes (OAuth, Google)

La base est stockée dans le dossier `AppData` de l'OS (`~/Library/Application Support/com.focal.app/` sur macOS).

---

## Modèles de données (models.rs)

Tous les modèles utilisent `#[derive(Serialize, Deserialize)]` avec `#[serde(rename_all = "camelCase")]` pour s'aligner sur les conventions TypeScript.

### AppState

```rust
pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}
```

État global partagé via `tauri::State`. Le `Mutex` protège la connexion SQLite pour l'accès concurrent.

### Task

```rust
pub struct Task {
    pub id: String,
    pub name: String,
    pub done: bool,
    pub tags: Vec<Tag>,
    pub micro_steps: Option<Vec<MicroStep>>,
    pub ai_decomposed: Option<bool>,
    pub estimated_minutes: Option<i32>,
    pub priority: Option<String>,        // "main" | "secondary"
    pub scheduled_date: Option<String>,  // YYYY-MM-DD
}
```

- Les tâches sont catégorisées par `view_context` en base : `"today"`, `"week"`, `"calendar"`
- `position` en base détermine l'ordre d'affichage
- Tags et micro-étapes sont dans des tables séparées (relations 1:N)

### TodoItem

```rust
pub struct TodoItem {
    pub id: String,
    pub text: String,
    pub done: bool,
    pub urgency: Option<i32>,           // 1-5
    pub importance: Option<i32>,        // 1-5
    pub source: String,                 // "manual" | "ai"
    pub created_at: String,
    pub scheduled_date: Option<String>,
}
```

### MicroStep

```rust
pub struct MicroStep {
    pub id: String,
    pub text: String,
    pub done: bool,
    pub estimated_minutes: Option<i32>,
}
```

### ChatMessage / ChatMessageStep

```rust
pub struct ChatMessage {
    pub id: String,
    pub role: String,          // "user" | "ai"
    pub content: String,
    pub steps: Option<Vec<ChatMessageStep>>,
}

pub struct ChatMessageStep {
    pub text: String,
}
```

### StrategyReview

```rust
pub struct StrategyReview {
    pub id: String,
    pub month: i32,            // 0-11
    pub year: i32,
    pub created_at: String,
    pub pillars: Vec<StrategyPillar>,
    pub reflections: Vec<StrategyReflection>,
    pub top3: Vec<String>,
}
```

### UserProfile

```rust
pub struct UserProfile {
    // Stocké comme JSON blob dans la table user_profile
    pub first_name: Option<String>,
    pub main_context: Option<String>,
    pub job_activity: Option<String>,
    pub adhd_recognition: Option<String>,
    pub blockers: Option<Vec<String>>,
    pub reminders_preference: Option<String>,
    pub organization_horizon: Option<String>,
    pub main_expectation: Option<String>,
    pub extra_info: Option<String>,
    pub profile_research: Option<bool>,
    pub profile_research_sources: Option<Vec<ProfileResearchSource>>,
    // ... autres champs
}
```

### Integration

```rust
pub struct Integration {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub connected: bool,
    pub category: String,
    pub context: IntegrationContext,
    pub oauth_provider: Option<String>,  // "google", "microsoft", etc.
}

pub struct IntegrationContext {
    pub rules: Vec<IntegrationRule>,
    pub extra_context: String,
}
```

### DecompStep (AI)

```rust
pub struct DecompStep {
    pub text: String,
    pub estimated_minutes: Option<i32>,
}
```

---

## Commandes Tauri

Toutes les commandes reçoivent un `State<'_, AppState>` et retournent `Result<T, String>`.

### Tasks (commands/tasks.rs) — 10 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_tasks` | `context: String` | `Vec<Task>` | Récupère les tâches par contexte (today/week/calendar) |
| `get_tasks_by_date` | `date: String` | `Vec<Task>` | Tâches pour une date précise (YYYY-MM-DD) |
| `get_tasks_by_date_range` | `start_date, end_date` | `Vec<Task>` | Tâches sur une plage de dates |
| `create_task` | `name, context?, priority?, tags?, estimated_minutes?, scheduled_date?` | `Task` | Crée une tâche |
| `update_task` | `id, name?, done?, priority?, estimated_minutes?, ai_decomposed?` | `Task` | Met à jour une tâche |
| `toggle_task` | `id` | `Task` | Bascule l'état done |
| `delete_task` | `id` | `()` | Supprime (cascade tags + steps) |
| `reorder_tasks` | `ids: Vec<String>` | `()` | Réordonne (met à jour position) |
| `set_micro_steps` | `task_id, steps: Vec<MicroStep>` | `Task` | Remplace les micro-étapes |
| `toggle_micro_step` | `id` | `MicroStep` | Bascule done d'une micro-étape |

**Fonctions internes** :
- `load_tags(db, task_id)` : charge les tags d'une tâche
- `load_steps(db, task_id)` : charge les micro-étapes
- `load_task(db, task_id)` : charge une tâche complète avec tags et steps

### Todos (commands/todos.rs) — 5 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_todos` | — | `Vec<TodoItem>` | Tous les todos, triés par date de création |
| `create_todo` | `text, urgency?, importance?, source?, scheduled_date?` | `TodoItem` | Crée un todo |
| `update_todo` | `id, text?, done?, urgency?, importance?, scheduled_date?` | `TodoItem` | Met à jour un todo |
| `toggle_todo` | `id` | `TodoItem` | Bascule done |
| `delete_todo` | `id` | `()` | Supprime un todo |

### Settings (commands/settings.rs) — 3 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_setting` | `key` | `Option<String>` | Récupère un paramètre |
| `set_setting` | `key, value` | `()` | Définit un paramètre |
| `get_all_settings` | — | `HashMap<String, String>` | Tous les paramètres |

**Clés de settings utilisées** :
- `theme` — ID du thème actif
- `ai-settings` — JSON des providers IA (clés API, provider actif)
- `daily-priority-count` — Nombre de priorités quotidiennes (1-7)
- `strategy-frequency` — Fréquence des revues (monthly/bimonthly/quarterly/biannual)
- `strategy-cycle-start` — Mois de départ du cycle (1-12)
- `strategy-occurrence` — Occurrence dans le mois (1st/2nd/3rd/4th/last)
- `strategy-day` — Jour de la semaine (lun/mar/.../dim)
- `notification-settings` — JSON des paramètres de notifications
- `last-active` — ISO datetime de la dernière activité (pour détecter les notifications manquées)
- `daily-prep-YYYY-MM-DD` — "done" si la préparation du jour est faite
- `weekly-prep-YYYY-WNN` — "done" si la préparation hebdomadaire est faite

### Reviews (commands/reviews.rs) — 1 commande

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_strategy_reviews` | — | `Vec<StrategyReview>` | Toutes les revues avec piliers, réflexions, top3 |

### Chat (commands/chat.rs) — 2 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_chat_messages` | — | `Vec<ChatMessage>` | Historique complet du chat |
| `add_chat_message` | `role, content, steps?` | `ChatMessage` | Ajoute un message (sans appel IA) |

### AI (commands/ai.rs) — 2 commandes (async)

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `send_message` | `user_message` | `AiResponse` | Envoie au LLM, sauvegarde les deux messages |
| `decompose_task` | `task_name, context?` | `Vec<DecompStep>` | Décompose une tâche en micro-étapes via LLM |

> Voir [AI.md](./AI.md) pour le détail de l'intégration IA.

### Integrations (commands/integrations.rs) — 8 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_integrations` | — | `Vec<Integration>` | Toutes les intégrations avec règles et contexte |
| `update_integration_connection` | `id, connected` | `Integration` | Active/désactive une intégration |
| `update_integration_context` | `id, rules, extra_context` | `Integration` | Met à jour les directives d'une intégration |
| `get_oauth_credentials` | `provider` | `OAuthCredentialsInfo` | Vérifie si les credentials OAuth sont configurés |
| `set_oauth_credentials` | `provider, client_id, client_secret` | `()` | Enregistre les credentials OAuth d'un provider |
| `start_oauth` | `integration_id` | `()` | Lance le flux OAuth (ouvre le navigateur, attend le callback) |
| `disconnect_integration` | `integration_id` | `Integration` | Déconnecte et révoque les tokens si plus aucun sibling connecté |
| `fetch_calendar_events` | `integration_id, date_from, date_to` | `Vec<CalendarEvent>` | Récupère les événements du calendrier |
| `fetch_emails` | `integration_id, query?, max_results?` | `Vec<EmailMessage>` | Récupère les emails |

> Voir [INTEGRATIONS.md](./INTEGRATIONS.md) pour le détail du flux OAuth et des connecteurs.

### Profile (commands/profile.rs) — 2 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_profile` | — | `UserProfile` | Récupère le profil (stocké en JSON) |
| `update_profile` | `data: String` (JSON) | `UserProfile` | Remplace le profil |

### Notifications (commands/notifications.rs) — 4 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_notification_history` | — | `Vec<NotificationHistoryEntry>` | Historique des notifications |
| `add_notification_entry` | `reminder_id, icon, label, description, scheduled_time, fired_at, missed` | `NotificationHistoryEntry` | Ajoute une entrée |
| `mark_notification_read` | `id` | `()` | Marque comme lue |
| `mark_all_notifications_read` | — | `()` | Marque toutes comme lues |

---

## Base de données (db.rs)

### Initialisation

1. `create_schema(conn)` — Crée les tables (idempotent via `IF NOT EXISTS`)
2. `seed_if_empty(conn)` — Si la table `tasks` est vide, remplit avec des données de démo

### Données de seed

Les fonctions `seed_*` insèrent des données de démonstration :
- `seed_tasks()` — Tâches d'exemple pour today/week/calendar avec tags et micro-étapes
- `seed_todos()` — Quelques todos de démonstration
- `seed_reviews()` — 3 revues stratégiques historiques avec piliers et réflexions
- `seed_chat()` — Messages de bienvenue du chat
- `seed_integrations()` — 8 intégrations préconfigurées (Google Calendar, Gmail, HubSpot...)
- `seed_settings()` — Paramètres par défaut (thème, IA, notifications)
- `seed_profile()` — Profil utilisateur vide

> Voir [DATA-MODEL.md](./DATA-MODEL.md) pour le schéma complet des tables.

---

## Dépendances Rust (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["macros"] }
```

| Crate | Usage |
|-------|-------|
| `tauri` | Framework desktop, IPC, gestion de fenêtres |
| `serde` / `serde_json` | Sérialisation Rust ↔ JSON ↔ TypeScript |
| `rusqlite` | Accès SQLite (bundled = inclut la lib C) |
| `uuid` | Génération d'IDs uniques (v4) |
| `chrono` | Manipulation de dates/heures |
| `reqwest` | Requêtes HTTP vers les APIs LLM et APIs tierces (Google) |
| `tokio` | Runtime async (commandes AI, OAuth, data fetching) |
| `urlencoding` | Encodage URL pour les paramètres OAuth |
| `open` | Ouverture du navigateur pour le flux OAuth |
