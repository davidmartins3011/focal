use chrono::{Datelike, Local};
use rusqlite::{params, Connection};

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    estimated_minutes INTEGER,
    priority TEXT,
    ai_decomposed INTEGER NOT NULL DEFAULT 0,
    view_context TEXT NOT NULL DEFAULT 'today',
    scheduled_date TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_tags (
    task_id TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (task_id, label),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS micro_steps (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    estimated_minutes INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    cleared INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_message_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    text TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_reviews (
    id TEXT PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategy_pillars (
    id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    name TEXT NOT NULL,
    tag_color TEXT NOT NULL,
    goal TEXT NOT NULL DEFAULT '',
    progress INTEGER NOT NULL DEFAULT 0,
    insight TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, review_id),
    FOREIGN KEY (review_id) REFERENCES strategy_reviews(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_reflections (
    id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, review_id),
    FOREIGN KEY (review_id) REFERENCES strategy_reviews(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_top3 (
    review_id TEXT NOT NULL,
    item TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (review_id, position),
    FOREIGN KEY (review_id) REFERENCES strategy_reviews(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    deadline TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategy_strategies (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (goal_id) REFERENCES strategy_goals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_tactics (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (strategy_id) REFERENCES strategy_strategies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_actions (
    id TEXT PRIMARY KEY,
    tactic_id TEXT NOT NULL,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (tactic_id) REFERENCES strategy_tactics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_periods (
    id TEXT PRIMARY KEY,
    start_month INTEGER NOT NULL,
    start_year INTEGER NOT NULL,
    end_month INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    frequency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS period_reflections (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (period_id) REFERENCES strategy_periods(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal_strategy_links (
    goal_id TEXT NOT NULL,
    strategy_id TEXT NOT NULL,
    PRIMARY KEY(goal_id, strategy_id),
    FOREIGN KEY (goal_id) REFERENCES strategy_goals(id) ON DELETE CASCADE,
    FOREIGN KEY (strategy_id) REFERENCES strategy_strategies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    connected INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'other',
    extra_context TEXT NOT NULL DEFAULT '',
    oauth_provider TEXT,
    account_email TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
    integration_id TEXT PRIMARY KEY,
    account_email TEXT NOT NULL DEFAULT '',
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    expires_at TEXT,
    scopes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS oauth_credentials (
    provider TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_rules (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL,
    text TEXT NOT NULL,
    urgency INTEGER NOT NULL DEFAULT 3,
    importance INTEGER NOT NULL DEFAULT 3,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_history (
    id TEXT PRIMARY KEY,
    reminder_id TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    scheduled_time TEXT NOT NULL,
    fired_at TEXT NOT NULL,
    missed INTEGER NOT NULL DEFAULT 0,
    read_status INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_memory_insights (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    insight TEXT NOT NULL,
    source_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_memory_analysis_log (
    analysis_date TEXT PRIMARY KEY,
    analyzed_at TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id TEXT PRIMARY KEY,
    icon TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT NOT NULL,
    impact TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'organisation',
    confidence INTEGER NOT NULL DEFAULT 75,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    responded_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_suggestions_log (
    run_date TEXT PRIMARY KEY,
    ran_at TEXT NOT NULL,
    suggestion_count INTEGER NOT NULL DEFAULT 0
);
";

pub fn create_schema(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(SCHEMA)?;
    // Migration: add description to tasks for pre-existing DBs
    conn.execute("ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT ''", []).ok();
    // Migration: add urgency/importance to tasks for pre-existing DBs
    conn.execute("ALTER TABLE tasks ADD COLUMN urgency INTEGER DEFAULT 3", []).ok();
    conn.execute("ALTER TABLE tasks ADD COLUMN importance INTEGER DEFAULT 3", []).ok();
    // Backfill existing tasks that have NULL urgency/importance
    conn.execute("UPDATE tasks SET urgency = 3 WHERE urgency IS NULL", []).ok();
    conn.execute("UPDATE tasks SET importance = 3 WHERE importance IS NULL", []).ok();
    // Migration: add period_id to strategy_goals for pre-existing DBs
    conn.execute("ALTER TABLE strategy_goals ADD COLUMN period_id TEXT", []).ok();
    // Migration: populate goal_strategy_links from existing goal_id
    conn.execute(
        "INSERT OR IGNORE INTO goal_strategy_links (goal_id, strategy_id) SELECT goal_id, id FROM strategy_strategies WHERE goal_id IS NOT NULL",
        [],
    ).ok();
    // Migration: add oauth_provider column for pre-existing DBs
    conn.execute("ALTER TABLE integrations ADD COLUMN oauth_provider TEXT", []).ok();
    migrate_oauth_providers(conn);
    // Migration: add account_email column for pre-existing DBs
    conn.execute("ALTER TABLE integrations ADD COLUMN account_email TEXT NOT NULL DEFAULT ''", []).ok();
    // Migration: move oauth_tokens from provider-keyed to integration-keyed
    migrate_oauth_tokens_to_integration(conn);
    // Migration: add cleared flag for soft-delete on chat_messages
    conn.execute("ALTER TABLE chat_messages ADD COLUMN cleared INTEGER NOT NULL DEFAULT 0", []).ok();
    // Migration: add strategy_id to tasks for linking tasks to strategies
    conn.execute("ALTER TABLE tasks ADD COLUMN strategy_id TEXT", []).ok();
    purge_old_chat_messages(conn);
    Ok(())
}

fn purge_old_chat_messages(conn: &Connection) {
    conn.execute(
        "DELETE FROM chat_message_steps WHERE message_id IN \
         (SELECT id FROM chat_messages WHERE created_at < datetime('now', '-60 days'))",
        [],
    ).ok();
    conn.execute(
        "DELETE FROM chat_messages WHERE created_at < datetime('now', '-60 days')",
        [],
    ).ok();
}

fn migrate_oauth_tokens_to_integration(conn: &Connection) {
    // Check if old provider-keyed table still exists (has 'provider' column)
    let has_provider_col = conn
        .prepare("SELECT provider FROM oauth_tokens LIMIT 0")
        .is_ok();
    if !has_provider_col {
        return;
    }

    // Read existing tokens keyed by provider
    let existing: Vec<(String, String, Option<String>, String, Option<String>, String)> = conn
        .prepare("SELECT provider, access_token, refresh_token, token_type, expires_at, scopes FROM oauth_tokens")
        .and_then(|mut stmt| {
            let rows = stmt.query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
            })?;
            rows.collect()
        })
        .unwrap_or_default();

    if existing.is_empty() {
        // No data to migrate — just recreate the table with the new schema
        conn.execute("DROP TABLE IF EXISTS oauth_tokens", []).ok();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS oauth_tokens (
                integration_id TEXT PRIMARY KEY,
                account_email TEXT NOT NULL DEFAULT '',
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_type TEXT NOT NULL DEFAULT 'Bearer',
                expires_at TEXT,
                scopes TEXT NOT NULL DEFAULT ''
            )",
            [],
        ).ok();
        return;
    }

    // Find connected integrations per provider and duplicate tokens
    let mut to_insert: Vec<(String, String, Option<String>, String, Option<String>, String)> = Vec::new();
    for (provider, access_token, refresh_token, token_type, expires_at, scopes) in &existing {
        let integration_ids: Vec<String> = conn
            .prepare("SELECT id FROM integrations WHERE oauth_provider = ?1 AND connected = 1")
            .and_then(|mut stmt| {
                let rows = stmt.query_map(params![provider], |row| row.get(0))?;
                rows.collect()
            })
            .unwrap_or_default();

        for iid in integration_ids {
            to_insert.push((iid, access_token.clone(), refresh_token.clone(), token_type.clone(), expires_at.clone(), scopes.clone()));
        }
    }

    conn.execute("DROP TABLE oauth_tokens", []).ok();
    conn.execute(
        "CREATE TABLE oauth_tokens (
            integration_id TEXT PRIMARY KEY,
            account_email TEXT NOT NULL DEFAULT '',
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            token_type TEXT NOT NULL DEFAULT 'Bearer',
            expires_at TEXT,
            scopes TEXT NOT NULL DEFAULT ''
        )",
        [],
    ).ok();

    for (iid, access_token, refresh_token, token_type, expires_at, scopes) in to_insert {
        conn.execute(
            "INSERT OR IGNORE INTO oauth_tokens (integration_id, account_email, access_token, refresh_token, token_type, expires_at, scopes) VALUES (?1, '', ?2, ?3, ?4, ?5, ?6)",
            params![iid, access_token, refresh_token, token_type, expires_at, scopes],
        ).ok();
    }
}

fn migrate_oauth_providers(conn: &Connection) {
    let mapping: &[(&str, &str)] = &[
        ("google-calendar", "google"),
        ("gmail", "google"),
        ("google-drive", "google"),
        ("outlook-calendar", "microsoft"),
        ("outlook-mail", "microsoft"),
    ];
    for (id, provider) in mapping {
        conn.execute(
            "UPDATE integrations SET oauth_provider = ?1 WHERE id = ?2 AND oauth_provider IS NULL",
            params![provider, id],
        )
        .ok();
    }
}

pub fn seed_if_empty(conn: &mut Connection) -> Result<(), rusqlite::Error> {
    let settings_count: i64 = conn.query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))?;
    if settings_count == 0 {
        let tx = conn.transaction()?;
        seed_integrations(&tx)?;
        seed_settings(&tx)?;
        seed_profile(&tx)?;
        tx.commit()?;
        return Ok(());
    }
    // Migrate reviews→periods for existing databases
    let period_count: i64 = conn.query_row("SELECT COUNT(*) FROM strategy_periods", [], |row| row.get(0))?;
    if period_count == 0 {
        migrate_reviews_to_periods(conn)?;
    }
    // Link orphan goals to active period
    let active_id: Option<String> = conn.query_row(
        "SELECT id FROM strategy_periods WHERE status = 'active' LIMIT 1",
        [], |row| row.get(0),
    ).ok();
    if let Some(ref pid) = active_id {
        conn.execute("UPDATE strategy_goals SET period_id = ?1 WHERE period_id IS NULL", params![pid])?;
    }
    Ok(())
}

fn migrate_reviews_to_periods(conn: &Connection) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT id, month, year, created_at FROM strategy_reviews ORDER BY year, month")?;
    let reviews: Vec<(String, i32, i32, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?
        .filter_map(|r| r.ok())
        .collect();

    for (review_id, month, year, created_at) in &reviews {
        let period_id = review_id.replace("review-", "period-");
        conn.execute(
            "INSERT OR IGNORE INTO strategy_periods (id, start_month, start_year, end_month, end_year, frequency, status, closed_at, created_at) VALUES (?1,?2,?3,?4,?5,'monthly','closed',?6,?6)",
            params![period_id, month, year, month, year, created_at],
        )?;
        let mut rstmt = conn.prepare("SELECT id, prompt, answer, position FROM strategy_reflections WHERE review_id = ?1")?;
        let refls: Vec<(String, String, String, i32)> = rstmt
            .query_map(params![review_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?
            .filter_map(|r| r.ok())
            .collect();
        for (ref_id, prompt, answer, position) in refls {
            let new_id = format!("{}-{}", period_id, ref_id);
            conn.execute(
                "INSERT OR IGNORE INTO period_reflections (id, period_id, prompt, answer, position) VALUES (?1,?2,?3,?4,?5)",
                params![new_id, period_id, prompt, answer, position],
            )?;
        }
    }

    let now = Local::now();
    let month = now.month0() as i32;
    let year = now.year();
    let active_id = format!("period-{}-{:02}", year, month + 1);
    conn.execute(
        "INSERT OR IGNORE INTO strategy_periods (id, start_month, start_year, end_month, end_year, frequency, status) VALUES (?1,?2,?3,?4,?5,'monthly','active')",
        params![active_id, month, year, month, year],
    )?;
    for (suffix, prompt, pos) in [
        ("worked", "Ce qui a bien marché", 0i32),
        ("blocked", "Ce qui m'a bloqué", 1),
        ("stop", "Ce que je veux arrêter", 2),
        ("start", "Ce que je veux commencer", 3),
    ] {
        conn.execute(
            "INSERT OR IGNORE INTO period_reflections (id, period_id, prompt, answer, position) VALUES (?1,?2,?3,'',?4)",
            params![format!("{}-{}", active_id, suffix), active_id, prompt, pos],
        )?;
    }
    Ok(())
}

fn seed_integrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    let ins = |id: &str, name: &str, desc: &str, icon: &str, cat: &str, oauth: Option<&str>| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO integrations (id, name, description, icon, connected, category, extra_context, oauth_provider) VALUES (?1,?2,?3,?4,0,?5,'',?6)",
            params![id, name, desc, icon, cat, oauth],
        )?;
        Ok(())
    };
    ins("google-calendar", "Google Calendar", "Synchronise tes événements et bloque du temps pour tes tâches", "📅", "calendar", Some("google"))?;
    ins("outlook-calendar", "Outlook Calendar", "Connecte ton calendrier professionnel Microsoft", "📆", "calendar", Some("microsoft"))?;
    ins("gmail", "Gmail", "Transforme tes emails importants en tâches", "✉️", "email", Some("google"))?;
    ins("outlook-mail", "Outlook Mail", "Connecte ta messagerie professionnelle", "📧", "email", Some("microsoft"))?;
    ins("hubspot", "HubSpot", "Synchronise tes contacts et tes deals CRM", "🟠", "crm", None)?;
    ins("salesforce", "Salesforce", "Intègre ton CRM Salesforce", "☁️", "crm", None)?;
    ins("slack", "Slack", "Reçois et traite tes messages importants", "💬", "messaging", None)?;
    ins("notion", "Notion", "Synchronise tes pages et bases de données", "📓", "storage", None)?;
    ins("google-drive", "Google Drive", "Accède à tes fichiers et documents", "📁", "storage", Some("google"))?;
    ins("linear", "Linear", "Synchronise tes tickets et projets", "◆", "other", None)?;
    ins("lemlist", "Lemlist", "Automatise tes campagnes d'outreach et de prospection", "📨", "crm", None)?;
    Ok(())
}

fn seed_settings(conn: &Connection) -> Result<(), rusqlite::Error> {
    let ins = |key: &str, value: &str| -> Result<(), rusqlite::Error> {
        conn.execute("INSERT INTO settings (key, value) VALUES (?1,?2)", params![key, value])?;
        Ok(())
    };
    ins("theme", "default")?;
    ins("daily-priority-count", "3")?;
    ins("strategy-frequency", "monthly")?;
    ins("strategy-cycle-start", "1")?;
    ins("strategy-occurrence", "last")?;
    ins("strategy-day", "dim")?;
    ins("ai-settings", r#"{"providers":[{"id":"openai","enabled":false,"apiKey":""},{"id":"anthropic","enabled":false,"apiKey":""},{"id":"mistral","enabled":false,"apiKey":""}]}"#)?;
    ins("notification-settings", &serde_json::to_string(&serde_json::json!({
        "enabled": true,
        "reminders": [
            {"id":"morning-plan","label":"Planification du matin","description":"Prépare ta journée en définissant tes priorités","time":"09:00","enabled":true,"days":["lun","mar","mer","jeu","ven"],"icon":"🌅"},
            {"id":"focus-checkin","label":"Check-in focus","description":"Où en es-tu ? Recentre-toi si besoin","time":"11:00","enabled":true,"days":["lun","mar","mer","jeu","ven"],"icon":"🎯"},
            {"id":"lunch-break","label":"Pause déjeuner","description":"Fais une vraie pause, tu l'as mérité","time":"12:30","enabled":false,"days":["lun","mar","mer","jeu","ven","sam","dim"],"icon":"🍽"},
            {"id":"afternoon-boost","label":"Boost après-midi","description":"Relance ton énergie, choisis une tâche courte","time":"15:00","enabled":true,"days":["lun","mar","mer","jeu","ven"],"icon":"⚡"},
            {"id":"daily-review","label":"Revue du jour","description":"Fais le point sur ta journée et célèbre tes victoires","time":"18:00","enabled":true,"days":["lun","mar","mer","jeu","ven"],"icon":"📝"},
            {"id":"weekly-prep","label":"Préparation de la semaine","description":"Pose tes objectifs et répartis tes tâches pour la semaine","time":"09:00","enabled":true,"days":["lun"],"icon":"📋"},
            {"id":"weekly-review","label":"Revue hebdomadaire","description":"Bilan de la semaine et préparation de la suivante","time":"10:00","enabled":true,"days":["dim"],"icon":"📊"},
            {"id":"strategy-review","label":"Prise de recul","description":"Prends du recul sur tes piliers et ajuste tes priorités du mois","time":"10:00","enabled":true,"days":["dim"],"icon":"🧭","frequency":"monthly","frequencyOccurrence":"last","frequencyCycleStart":1}
        ]
    })).unwrap())?;
    Ok(())
}

fn seed_profile(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute("INSERT INTO user_profile (id, data) VALUES (1, '{}')", [])?;
    Ok(())
}
