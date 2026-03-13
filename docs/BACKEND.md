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
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
        let db_path = app.path().app_data_dir()?.join("focal.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        db::create_schema(&conn)?;
        db::seed_if_empty(&conn)?;
        app.manage(AppState { db: Mutex::new(conn) });
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![...74 commandes...])
```

Modules déclarés dans `lib.rs` :
- `commands` — Commandes Tauri (API backend)
- `db` — Schéma et initialisation SQLite
- `models` — Structures de données sérialisables
- `providers` — Connecteurs APIs externes (OAuth, Google)

Plugins Tauri enregistrés :
- `tauri_plugin_shell` — Ouverture de liens externes
- `tauri_plugin_notification` — Notifications natives OS
- `tauri_plugin_updater` — Vérification et installation des mises à jour
- `tauri_plugin_process` — Redémarrage de l'app après mise à jour

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
    pub urgency: Option<i32>,            // 1-5
    pub importance: Option<i32>,         // 1-5
    pub description: Option<String>,
    pub created_at: Option<String>,
}
```

- Les tâches sont catégorisées par `view_context` en base : `"today"`, `"week"`, `"calendar"`, `"inbox"`
- `position` en base détermine l'ordre d'affichage
- Tags et micro-étapes sont dans des tables séparées (relations 1:N)

### Tag

```rust
pub struct Tag {
    pub label: String,
    pub color: String,
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

### StrategyReview (legacy)

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

### StrategyPeriod

```rust
pub struct StrategyPeriod {
    pub id: String,
    pub start_month: i32,
    pub start_year: i32,
    pub end_month: i32,
    pub end_year: i32,
    pub frequency: String,
    pub status: String,           // "active" | "closed" | "draft"
    pub closed_at: Option<String>,
    pub created_at: String,
    pub reflections: Vec<PeriodReflection>,
}
```

### StrategyGoal

```rust
pub struct StrategyGoal {
    pub id: String,
    pub title: String,
    pub target: String,
    pub deadline: Option<String>,
    pub strategies: Vec<StrategyStrategy>,
    pub created_at: String,
    pub updated_at: String,
    pub period_id: Option<String>,
}
```

### StrategyStrategy / StrategyTactic / StrategyAction

```rust
pub struct StrategyStrategy {
    pub id: String,
    pub title: String,
    pub description: String,
    pub tactics: Vec<StrategyTactic>,
}

pub struct StrategyTactic {
    pub id: String,
    pub title: String,
    pub description: String,
    pub actions: Vec<StrategyAction>,
}

pub struct StrategyAction {
    pub id: String,
    pub text: String,
    pub done: bool,
}
```

### GoalStrategyLink

```rust
pub struct GoalStrategyLink {
    pub goal_id: String,
    pub strategy_id: String,
}
```

### PeriodReflection

```rust
pub struct PeriodReflection {
    pub id: String,
    pub prompt: String,
    pub answer: String,
}
```

### PeriodSummary / TagDistribution / TaskHighlight

```rust
pub struct PeriodSummary {
    pub tasks_completed: i32,
    pub tasks_total: i32,
    pub focus_days: i32,
    pub total_days: i32,
    pub distribution: Vec<TagDistribution>,
    pub highlights: Vec<TaskHighlight>,
}

pub struct TagDistribution {
    pub tag: String,
    pub count: i32,
}

pub struct TaskHighlight {
    pub name: String,
    pub tag: Option<String>,
}
```

### UserProfile

```rust
pub struct UserProfile {
    pub first_name: Option<String>,
    pub main_context: Option<String>,
    pub main_context_other: Option<String>,
    pub job_activity: Option<String>,
    pub profile_research: Option<bool>,
    pub profile_research_identifier: Option<String>,
    pub profile_research_identifier_value: Option<String>,
    pub profile_research_sources: Option<Vec<ProfileResearchSource>>,
    pub adhd_recognition: Option<String>,
    pub blockers: Option<Vec<String>>,
    pub reminders_preference: Option<String>,
    pub organization_horizon: Option<String>,
    pub main_expectation: Option<String>,
    pub extra_info: Option<String>,
}
```

### ProfileResearchSource

```rust
pub struct ProfileResearchSource {
    pub source: String,
    pub source_url: Option<String>,
    pub scraped_at: Option<String>,
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
    pub oauth_provider: Option<String>,
    pub account_email: Option<String>,
}

pub struct IntegrationContext {
    pub rules: Vec<IntegrationRule>,
    pub extra_context: String,
}

pub struct IntegrationRule {
    pub id: String,
    pub text: String,
    pub urgency: i32,
    pub importance: i32,
}
```

### NotificationHistoryEntry

```rust
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

### Tasks (commands/tasks.rs) — 17 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_all_tasks` | — | `Vec<Task>` | Toutes les tâches, tous contextes confondus |
| `get_tasks` | `context: String` | `Vec<Task>` | Tâches par contexte (today/week/calendar/inbox) |
| `get_tasks_by_date` | `date: String` | `Vec<Task>` | Tâches pour une date précise (YYYY-MM-DD) |
| `get_tasks_by_date_range` | `start_date, end_date` | `Vec<Task>` | Tâches sur une plage de dates |
| `get_overdue_tasks` | — | `Vec<Task>` | Tâches en retard (date passée, non terminées) |
| `create_task` | `name, context?, priority?, tags?, estimated_minutes?, scheduled_date?, urgency?, importance?` | `Task` | Crée une tâche |
| `update_task` | `id, name?, done?, priority?, estimated_minutes?, ai_decomposed?, scheduled_date?, urgency?, importance?, view_context?, description?` | `Task` | Met à jour une tâche |
| `toggle_task` | `id` | `Task` | Bascule l'état done |
| `delete_task` | `id` | `()` | Supprime (cascade tags + steps) |
| `clear_all_tasks` | — | `usize` | Supprime toutes les tâches, retourne le nombre supprimé |
| `clear_today_tasks` | — | `usize` | Supprime les tâches today terminées |
| `reorder_tasks` | `ids: Vec<String>` | `()` | Réordonne (met à jour position) |
| `get_all_tags` | — | `Vec<Tag>` | Tous les tags distincts utilisés |
| `set_task_tags` | `task_id, tags: Vec<Tag>` | `Task` | Remplace les tags d'une tâche |
| `set_micro_steps` | `task_id, steps: Vec<MicroStep>` | `Task` | Remplace les micro-étapes |
| `toggle_micro_step` | `id` | `MicroStep` | Bascule done d'une micro-étape |
| `get_streak` | — | `i64` | Nombre de jours consécutifs avec des tâches complétées |

**Fonctions internes** :
- `load_tags(db, task_id)` : charge les tags d'une tâche
- `load_steps(db, task_id)` : charge les micro-étapes
- `load_task(db, task_id)` : charge une tâche complète avec tags et steps

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
- `strategy-enabled` — Activation de la vue Prise de recul
- `strategy-frequency` — Fréquence des revues (monthly/bimonthly/quarterly/biannual)
- `strategy-cycle-start` — Mois de départ du cycle (1-12)
- `strategy-occurrence` — Occurrence dans le mois (1st/2nd/3rd/4th/last)
- `strategy-day` — Jour de la semaine (lun/mar/.../dim)
- `working-days` — Jours ouvrés configurés
- `notification-settings` — JSON des paramètres de notifications
- `last-active` — ISO datetime de la dernière activité (pour détecter les notifications manquées)
- `daily-prep-YYYY-MM-DD` — "done" si la préparation du jour est faite
- `weekly-prep-YYYY-WNN` — "done" si la préparation hebdomadaire est faite
- `onboarding-completed` — Onboarding terminé (true/false)

### Reviews (commands/reviews.rs) — 21 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_strategy_reviews` | — | `Vec<StrategyReview>` | Toutes les revues legacy avec piliers, réflexions, top3 |
| `get_strategy_periods` | — | `Vec<StrategyPeriod>` | Toutes les périodes stratégiques avec réflexions |
| `create_strategy_period` | `id, start_month, start_year, end_month, end_year, frequency` | `StrategyPeriod` | Crée une période |
| `update_strategy_period` | `id, start_month, start_year, end_month, end_year, frequency` | `()` | Met à jour une période |
| `close_strategy_period` | `id` | `()` | Clôture une période |
| `reopen_strategy_period` | `id` | `()` | Réouvre une période clôturée |
| `upsert_period_reflection` | `id, period_id, prompt, answer, position` | `()` | Crée ou met à jour une réflexion de période |
| `carry_over_goals` | `source_period_id, target_period_id` | `()` | Reporte les objectifs d'une période à une autre |
| `get_strategy_goals` | `period_id?` | `Vec<StrategyGoal>` | Objectifs stratégiques (optionnellement filtrés par période) |
| `upsert_strategy_goal` | `id, title, target, deadline?, position, period_id?` | `()` | Crée ou met à jour un objectif |
| `delete_strategy_goal` | `id` | `()` | Supprime un objectif (cascade) |
| `upsert_strategy` | `id, goal_id, title, description, position` | `()` | Crée ou met à jour une stratégie |
| `delete_strategy` | `id` | `()` | Supprime une stratégie (cascade) |
| `get_goal_strategy_links` | `period_id?` | `Vec<GoalStrategyLink>` | Liens objectifs ↔ stratégies |
| `toggle_goal_strategy_link` | `goal_id, strategy_id` | `bool` | Toggle un lien objectif ↔ stratégie |
| `upsert_tactic` | `id, strategy_id, title, description, position` | `()` | Crée ou met à jour une tactique |
| `delete_tactic` | `id` | `()` | Supprime une tactique (cascade) |
| `upsert_action` | `id, tactic_id, text, done, position` | `()` | Crée ou met à jour une action |
| `delete_action` | `id` | `()` | Supprime une action |
| `toggle_action` | `id` | `bool` | Toggle l'état done d'une action |
| `get_period_summary` | `start_date, end_date` | `PeriodSummary` | Résumé statistique d'une période |

### Chat (commands/chat.rs) — 2 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_chat_messages` | — | `Vec<ChatMessage>` | Historique complet du chat |
| `clear_chat` | — | `()` | Supprime tout l'historique du chat |

### AI (commands/ai.rs) — 9 commandes (async)

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `validate_api_key` | `provider, api_key` | `bool` | Valide une clé API auprès du provider |
| `send_message` | `user_message` | `AiResponse` | Envoie au LLM, sauvegarde les deux messages |
| `decompose_task` | `task_name, context?` | `Vec<DecompStep>` | Décompose une tâche en micro-étapes via LLM |
| `generate_suggestions` | — | `Vec<Suggestion>` | Génère des suggestions de productivité via LLM |
| `send_daily_prep_message` | `user_message, history` | `DailyPrepResponse` | Prépare la journée via un échange conversationnel |
| `send_weekly_prep_message` | `user_message, history` | `DailyPrepResponse` | Prépare la semaine via un échange conversationnel |
| `send_period_prep_message` | `user_message, history, period_id` | `DailyPrepResponse` | Prépare une période stratégique |
| `send_onboarding_message` | `user_message, history, current_profile` | `OnboardingResponse` | Échange d'onboarding pour construire le profil |
| `analyze_profile_url` | `url` | `ProfileAnalysis` | Analyse une URL de profil public (LinkedIn, etc.) |

> Voir [AI.md](./AI.md) pour le détail de l'intégration IA.

### Integrations (commands/integrations.rs) — 9 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_integrations` | — | `Vec<Integration>` | Toutes les intégrations avec règles et contexte |
| `update_integration_connection` | `id, connected` | `Integration` | Active/désactive une intégration |
| `update_integration_context` | `id, rules, extra_context` | `Integration` | Met à jour les directives d'une intégration |
| `get_oauth_credentials` | `provider` | `OAuthCredentialsInfo` | Vérifie si les credentials OAuth sont configurés |
| `set_oauth_credentials` | `provider, client_id, client_secret` | `()` | Enregistre les credentials OAuth d'un provider |
| `start_oauth` | `integration_id` | `()` | Lance le flux OAuth (ouvre le navigateur, attend le callback) |
| `disconnect_integration` | `integration_id` | `Integration` | Déconnecte et supprime les tokens OAuth |
| `fetch_calendar_events` | `integration_id, date_from, date_to` | `Vec<CalendarEvent>` | Récupère les événements du calendrier |
| `fetch_emails` | `integration_id, query?, max_results?` | `Vec<EmailMessage>` | Récupère les emails |

> Voir [INTEGRATIONS.md](./INTEGRATIONS.md) pour le détail du flux OAuth et des connecteurs.

### Profile (commands/profile.rs) — 2 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_profile` | — | `UserProfile` | Récupère le profil (stocké en JSON) |
| `update_profile` | `data: String` (JSON) | `UserProfile` | Remplace le profil |

### Notifications (commands/notifications.rs) — 6 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_notification_history` | — | `Vec<NotificationHistoryEntry>` | Historique des notifications |
| `add_notification_entry` | `reminder_id, icon, label, description, scheduled_time, fired_at, missed` | `NotificationHistoryEntry` | Ajoute une entrée |
| `mark_notification_read` | `id` | `()` | Marque comme lue |
| `mark_all_notifications_read` | — | `()` | Marque toutes comme lues |
| `set_badge_count` | `count` | `()` | Met à jour le badge de l'icône dock (macOS) |
| `send_clickable_notification` | `title, body, action?` | `()` | Envoie une notification native OS |

### Memory (commands/memory.rs) — 4 commandes

| Commande | Paramètres | Retour | Description |
|----------|-----------|--------|-------------|
| `get_memory_insights` | — | `Vec<MemoryInsight>` | Tous les insights de mémoire IA |
| `delete_memory_insight` | `id` | `()` | Supprime un insight par ID |
| `check_and_run_analysis` | — | `bool` | Analyse les conversations récentes si pas encore fait aujourd'hui |
| `run_analysis_now` | — | `bool` | Lance l'analyse comportementale pour la date du jour |

La mémoire IA analyse les conversations via LLM pour construire un profil organisationnel cumulatif (priorités, rythmes, blocages, etc.) et stocker les insights dans la table `ai_memory_insights`.

---

## Base de données (db.rs)

### Initialisation

1. `create_schema(conn)` — Crée les tables (idempotent via `IF NOT EXISTS`)
2. Migrations — Ajout de colonnes et restructurations pour les bases existantes
3. `seed_if_empty(conn)` — Si la table `tasks` est vide, remplit avec des données de démo

### Données de seed

Les fonctions `seed_*` insèrent des données de démonstration :
- `seed_tasks()` — Tâches d'exemple pour today/week/calendar avec tags et micro-étapes
- `seed_reviews()` — 4 revues stratégiques historiques avec piliers et réflexions
- `seed_periods()` — 5 périodes stratégiques (4 clôturées + 1 active)
- `seed_goals()` — 2 objectifs avec stratégies, tactiques et actions
- `seed_chat()` — Messages de bienvenue du chat
- `seed_integrations()` — 11 intégrations préconfigurées (Google Calendar, Gmail, HubSpot, Slack, Linear, Lemlist...)
- `seed_settings()` — Paramètres par défaut (thème, IA, notifications)
- `seed_profile()` — Profil utilisateur vide

> Voir [DATA-MODEL.md](./DATA-MODEL.md) pour le schéma complet des tables.

---

## Dépendances Rust (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["image-png"] }
tauri-plugin-shell = "2"
tauri-plugin-notification = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["macros", "net", "io-util", "time", "rt"] }
urlencoding = "2"
open = "5"

[target.'cfg(target_os = "macos")'.dependencies]
mac-notification-sys = "0.6"
```

| Crate | Usage |
|-------|-------|
| `tauri` | Framework desktop, IPC, gestion de fenêtres |
| `tauri-plugin-shell` | Ouverture de liens dans le navigateur |
| `tauri-plugin-notification` | Notifications natives OS |
| `tauri-plugin-updater` | Mises à jour in-app |
| `tauri-plugin-process` | Redémarrage de l'app |
| `serde` / `serde_json` | Sérialisation Rust ↔ JSON ↔ TypeScript |
| `rusqlite` | Accès SQLite (bundled = inclut la lib C) |
| `uuid` | Génération d'IDs uniques (v4) |
| `chrono` | Manipulation de dates/heures |
| `reqwest` | Requêtes HTTP vers les APIs LLM et APIs tierces (Google) |
| `tokio` | Runtime async (commandes AI, OAuth, data fetching, serveur local) |
| `urlencoding` | Encodage URL pour les paramètres OAuth |
| `open` | Ouverture du navigateur pour le flux OAuth |
| `mac-notification-sys` | Notifications cliquables macOS (target macOS uniquement) |
