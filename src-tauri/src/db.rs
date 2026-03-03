use chrono::Local;
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

CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    urgency INTEGER,
    importance INTEGER,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    scheduled_date TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
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
";

pub fn create_schema(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(SCHEMA)?;
    // Migration: add oauth_provider column for pre-existing DBs
    conn.execute("ALTER TABLE integrations ADD COLUMN oauth_provider TEXT", []).ok();
    migrate_oauth_providers(conn);
    // Migration: add account_email column for pre-existing DBs
    conn.execute("ALTER TABLE integrations ADD COLUMN account_email TEXT NOT NULL DEFAULT ''", []).ok();
    // Migration: move oauth_tokens from provider-keyed to integration-keyed
    migrate_oauth_tokens_to_integration(conn);
    Ok(())
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
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let tx = conn.transaction()?;
    seed_tasks(&tx)?;
    seed_todos(&tx)?;
    seed_reviews(&tx)?;
    seed_chat(&tx)?;
    seed_integrations(&tx)?;
    seed_settings(&tx)?;
    seed_profile(&tx)?;
    tx.commit()
}

fn seed_tasks(conn: &Connection) -> Result<(), rusqlite::Error> {
    let insert_task = |id: &str, name: &str, done: bool, est: Option<i32>, pri: Option<&str>, ai: bool, ctx: &str, sched: Option<&str>, pos: i32| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO tasks (id, name, done, estimated_minutes, priority, ai_decomposed, view_context, scheduled_date, position) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![id, name, done, est, pri, ai, ctx, sched, pos],
        )?;
        Ok(())
    };
    let insert_tag = |task_id: &str, label: &str, color: &str, pos: i32| -> Result<(), rusqlite::Error> {
        conn.execute("INSERT INTO task_tags (task_id, label, color, position) VALUES (?1,?2,?3,?4)", params![task_id, label, color, pos])?;
        Ok(())
    };
    let insert_step = |id: &str, task_id: &str, text: &str, done: bool, est: Option<i32>, pos: i32| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO micro_steps (id, task_id, text, done, estimated_minutes, position) VALUES (?1,?2,?3,?4,?5,?6)",
            params![id, task_id, text, done, est, pos],
        )?;
        Ok(())
    };

    // --- Today tasks (main priorities first, then secondary) ---
    insert_task("4", "Préparer la revue de sprint vendredi", false, Some(45), Some("main"), true, "today", None, 0)?;
    insert_tag("4", "Roadmap", "roadmap", 0)?;
    insert_tag("4", "Prioritaire", "urgent", 1)?;
    insert_step("4a", "4", "Lister les tickets fermés depuis le dernier sprint", true, Some(10), 0)?;
    insert_step("4b", "4", "Identifier les 2-3 points de blocage à mentionner", false, Some(15), 1)?;
    insert_step("4c", "4", "Préparer les slides (5 slides max)", false, Some(20), 2)?;

    insert_task("5", "Investiguer le bug pipeline dbt — table orders", false, Some(25), Some("main"), false, "today", None, 1)?;
    insert_tag("5", "Data Platform", "data", 0)?;

    insert_task("6", "Brainstorm idées SaaS TDAH — 20 min", false, Some(20), Some("main"), false, "today", None, 2)?;
    insert_tag("6", "SaaS", "saas", 0)?;

    insert_task("1", "Sync équipe Data — stand-up", true, Some(15), Some("secondary"), false, "today", None, 3)?;
    insert_tag("1", "Roadmap", "roadmap", 0)?;

    insert_task("2", "Revoir les specs du connecteur Salesforce", true, Some(30), Some("secondary"), false, "today", None, 4)?;
    insert_tag("2", "CRM", "crm", 0)?;

    insert_task("3", "Répondre aux emails du matin", true, Some(10), Some("secondary"), false, "today", None, 5)?;

    insert_task("7", "Préparer questions pour entretien utilisateur TDAH", false, Some(30), Some("secondary"), false, "today", None, 6)?;
    insert_tag("7", "SaaS", "saas", 0)?;

    // --- Week priorities ---
    insert_task("w1", "Finaliser la roadmap Q1 avec l'équipe", true, None, None, false, "week", None, 0)?;
    insert_tag("w1", "Roadmap", "roadmap", 0)?;

    insert_task("w2", "Livrer la revue de sprint vendredi", false, None, None, false, "week", None, 1)?;
    insert_tag("w2", "Roadmap", "roadmap", 0)?;

    insert_task("w3", "Corriger le bug pipeline dbt en prod", false, None, None, false, "week", None, 2)?;
    insert_tag("w3", "Data Platform", "data", 0)?;

    insert_task("w4", "Valider le concept SaaS TDAH avec 3 personnes", false, None, None, false, "week", None, 3)?;
    insert_tag("w4", "SaaS", "saas", 0)?;

    // --- Calendar tasks (relative to today) ---
    let today = Local::now().date_naive();
    let fmt = |d: chrono::NaiveDate| d.format("%Y-%m-%d").to_string();

    let d = fmt(today);
    insert_task("c1", "Finaliser wireframes page pricing", false, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c1", "SaaS", "saas", 0)?;
    insert_task("c2", "Répondre au mail de Marc", true, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c2", "CRM", "crm", 0)?;
    insert_task("c3", "Préparer le standup", false, None, None, false, "calendar", Some(&d), 2)?;
    insert_tag("c3", "Roadmap", "roadmap", 0)?;

    let d = fmt(today - chrono::Duration::days(1));
    insert_task("c4", "Revue de code PR #42", true, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c4", "Data", "data", 0)?;
    insert_task("c5", "Rédiger spec notifications", true, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c5", "SaaS", "saas", 0)?;

    let d = fmt(today + chrono::Duration::days(1));
    insert_task("c6", "Call client Neovision — 14h", false, None, Some("main"), false, "calendar", Some(&d), 0)?;
    insert_tag("c6", "CRM", "crm", 0)?;
    insert_task("c6b", "Envoyer devis mise à jour", false, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c6b", "CRM", "crm", 0)?;

    let d = fmt(today + chrono::Duration::days(2));
    insert_task("c20", "Sprint planning Q2", false, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c20", "Roadmap", "roadmap", 0)?;
    insert_tag("c20", "Urgent", "urgent", 1)?;
    insert_task("c21", "Présentation équipe data", false, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c21", "Data", "data", 0)?;
    insert_task("c22", "Répondre brief marketing", false, None, None, false, "calendar", Some(&d), 2)?;
    insert_tag("c22", "SaaS", "saas", 0)?;
    insert_task("c23", "Review PR pipeline ETL", false, None, None, false, "calendar", Some(&d), 3)?;
    insert_tag("c23", "Data", "data", 0)?;
    insert_task("c24", "Sync with design team", false, None, None, false, "calendar", Some(&d), 4)?;
    insert_tag("c24", "Roadmap", "roadmap", 0)?;

    let d = fmt(today + chrono::Duration::days(3));
    insert_task("c7", "Livraison MVP dashboard", false, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c7", "Roadmap", "roadmap", 0)?;
    insert_tag("c7", "Urgent", "urgent", 1)?;
    insert_task("c8", "Tests E2E module facturation", false, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c8", "SaaS", "saas", 0)?;

    let d = fmt(today + chrono::Duration::days(5));
    insert_task("c9", "Webinaire produit — 10h30", false, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c9", "SaaS", "saas", 0)?;
    insert_task("c10", "Synchro data pipeline", false, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c10", "Data", "data", 0)?;
    insert_task("c11", "Déjeuner équipe", false, None, None, false, "calendar", Some(&d), 2)?;

    let d = fmt(today - chrono::Duration::days(2));
    insert_task("c15", "Rédiger brief onboarding", true, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c15", "SaaS", "saas", 0)?;
    insert_task("c16", "Call partenaire Stripe", true, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c16", "CRM", "crm", 0)?;
    insert_task("c17", "Corriger bug affichage mobile", true, None, None, false, "calendar", Some(&d), 2)?;
    insert_tag("c17", "SaaS", "saas", 0)?;

    let d = fmt(today - chrono::Duration::days(3));
    insert_task("c12", "Intégration API paiement", true, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c12", "SaaS", "saas", 0)?;

    let d = fmt(today - chrono::Duration::days(5));
    insert_task("c13", "Planifier sprint Q2", true, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c13", "Roadmap", "roadmap", 0)?;
    insert_task("c14", "Mise à jour documentation", true, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c14", "Data", "data", 0)?;

    let d = fmt(today - chrono::Duration::days(4));
    insert_task("c18", "Setup monitoring Datadog", true, None, None, false, "calendar", Some(&d), 0)?;
    insert_tag("c18", "Data", "data", 0)?;
    insert_task("c19", "Réunion kick-off projet CRM", true, None, None, false, "calendar", Some(&d), 1)?;
    insert_tag("c19", "CRM", "crm", 0)?;

    Ok(())
}

fn seed_todos(conn: &Connection) -> Result<(), rusqlite::Error> {
    let ins = |id: &str, text: &str, done: bool, urg: Option<i32>, imp: Option<i32>, src: &str, at: &str, sched: Option<&str>| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO todos (id, text, done, urgency, importance, source, created_at, scheduled_date) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![id, text, done, urg, imp, src, at, sched],
        )?;
        Ok(())
    };
    ins("t1", "Finaliser la maquette du dashboard client", false, Some(4), Some(5), "manual", "2026-02-27T08:30:00", Some("2026-02-27"))?;
    ins("t2", "Répondre au mail de Marie concernant le planning Q2", false, Some(3), Some(3), "manual", "2026-02-27T09:15:00", Some("2026-02-27"))?;
    ins("t3", "Penser à relancer le devis freelance (>48h sans réponse)", false, Some(2), Some(4), "ai", "2026-02-27T10:00:00", None)?;
    ins("t4", "Acheter du café et des post-it", false, None, None, "manual", "2026-02-26T14:00:00", None)?;
    ins("t5", "Prendre RDV dentiste", true, None, None, "manual", "2026-02-25T11:00:00", Some("2026-02-25"))?;
    ins("t6", "Tu n'as pas ouvert le doc « Stratégie Produit » depuis 5 jours — à revoir ?", false, None, Some(3), "ai", "2026-02-27T07:00:00", None)?;
    ins("t7", "Lire l'article sur les design tokens envoyé par Lucas", false, None, None, "manual", "2026-02-26T18:30:00", Some("2026-03-02"))?;
    ins("t8", "Mettre à jour le README du repo principal", false, Some(1), Some(2), "manual", "2026-02-24T16:00:00", None)?;
    Ok(())
}

fn seed_reviews(conn: &Connection) -> Result<(), rusqlite::Error> {
    let ins_review = |id: &str, month: i32, year: i32, at: &str| -> Result<(), rusqlite::Error> {
        conn.execute("INSERT INTO strategy_reviews (id, month, year, created_at) VALUES (?1,?2,?3,?4)", params![id, month, year, at])?;
        Ok(())
    };
    let ins_pillar = |pid: &str, rid: &str, name: &str, color: &str, goal: &str, progress: i32, insight: &str, pos: i32| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO strategy_pillars (id, review_id, name, tag_color, goal, progress, insight, position) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![pid, rid, name, color, goal, progress, insight, pos],
        )?;
        Ok(())
    };
    let ins_refl = |fid: &str, rid: &str, prompt: &str, answer: &str, pos: i32| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO strategy_reflections (id, review_id, prompt, answer, position) VALUES (?1,?2,?3,?4,?5)",
            params![fid, rid, prompt, answer, pos],
        )?;
        Ok(())
    };
    let ins_top3 = |rid: &str, item: &str, pos: i32| -> Result<(), rusqlite::Error> {
        conn.execute("INSERT INTO strategy_top3 (review_id, item, position) VALUES (?1,?2,?3)", params![rid, item, pos])?;
        Ok(())
    };

    // Review Feb 2026
    let rid = "review-2026-02";
    ins_review(rid, 1, 2026, "2026-02-01T10:00:00")?;
    ins_pillar("roadmap", rid, "Roadmap produit", "roadmap", "Piloter la roadmap Q1 et livrer le sprint", 80, "Sprint review bien cadré, bonne vélocité", 0)?;
    ins_pillar("data", rid, "Data Platform", "data", "Stabiliser les pipelines dbt en prod", 65, "2 bugs critiques résolus, 1 en cours", 1)?;
    ins_pillar("crm", rid, "Relations & CRM", "crm", "Structurer le suivi client et partenaires", 40, "Suivi encore trop informel, à cadrer", 2)?;
    ins_pillar("saas", rid, "SaaS TDAH (focal.)", "saas", "Valider le concept et construire le MVP", 25, "Mockup fait, concept à tester avec 3 personnes", 3)?;
    ins_refl("worked", rid, "Ce qui a bien marché", "Bonne discipline sur les standups. La décomposition de tâches m'aide vraiment — quand je l'utilise. Le focus par blocs de 45 min est efficace.", 0)?;
    ins_refl("blocked", rid, "Ce qui m'a bloqué", "Procrastination sur le projet SaaS : trop de tâches floues, pas assez décomposées. Le bug dbt a mangé 3 jours de focus.", 1)?;
    ins_refl("stop", rid, "Ce que je veux arrêter", "Checker Slack toutes les 10 min. Accepter des réunions sans agenda clair. Rester sur des tâches bloquées sans demander de l'aide.", 2)?;
    ins_refl("start", rid, "Ce que je veux commencer", "Bloquer 1h chaque matin pour le SaaS. Faire la revue du soir systématiquement. Utiliser « Je bloque » au lieu de tourner en rond.", 3)?;
    ins_top3(rid, "Livrer le MVP focal. (décomposition IA + vue jour)", 0)?;
    ins_top3(rid, "Clôturer le bug pipeline dbt et documenter la solution", 1)?;
    ins_top3(rid, "Mettre en place un suivi client structuré (1 check-in/semaine)", 2)?;

    // Review Jan 2026
    let rid = "review-2026-01";
    ins_review(rid, 0, 2026, "2026-01-03T09:00:00")?;
    ins_pillar("roadmap", rid, "Roadmap produit", "roadmap", "Préparer le planning Q1 et aligner l'équipe", 70, "Planning Q1 validé, 2 features priorisées", 0)?;
    ins_pillar("data", rid, "Data Platform", "data", "Migrer les jobs Airflow vers dbt", 50, "Migration à 50%, quelques edge cases non couverts", 1)?;
    ins_pillar("crm", rid, "Relations & CRM", "crm", "Reprendre contact avec 5 clients dormants", 60, "3 clients recontactés, 2 rdv pris", 2)?;
    ins_pillar("saas", rid, "SaaS TDAH (focal.)", "saas", "Poser les bases : concept, cible, positionnement", 15, "Brainstorm fait, besoin de valider avec des utilisateurs", 3)?;
    ins_refl("worked", rid, "Ce qui a bien marché", "Le morning routine est installé. Les blocs de focus marchent quand je coupe les notifs. L'alignement avec l'équipe s'est amélioré grâce aux standups quotidiens.", 0)?;
    ins_refl("blocked", rid, "Ce qui m'a bloqué", "Trop de contexte switching entre les projets. Difficulté à dire non aux urgences des autres. Le projet SaaS avance peu car toujours repoussé.", 1)?;
    ins_refl("stop", rid, "Ce que je veux arrêter", "Dire oui à toutes les réunions. Travailler le soir au lieu de couper. Repousser les décisions difficiles.", 2)?;
    ins_refl("start", rid, "Ce que je veux commencer", "Poser des limites claires sur les créneaux de deep work. Dédier le vendredi après-midi au SaaS. Prendre 5 min de revue en fin de journée.", 3)?;
    ins_top3(rid, "Livrer les 2 features Q1 prioritaires d'ici fin janvier", 0)?;
    ins_top3(rid, "Finir la migration dbt (100% des jobs critiques)", 1)?;
    ins_top3(rid, "Faire 3 interviews utilisateurs pour le SaaS TDAH", 2)?;

    // Review Dec 2025
    let rid = "review-2025-12";
    ins_review(rid, 11, 2025, "2025-12-02T11:30:00")?;
    ins_pillar("roadmap", rid, "Roadmap produit", "roadmap", "Closer le Q4 et préparer la rétrospective", 90, "Q4 livré à 90%, bonne rétrospective d'équipe", 0)?;
    ins_pillar("data", rid, "Data Platform", "data", "Stabiliser le pipeline de reporting", 75, "Pipeline stable, alerting en place", 1)?;
    ins_pillar("crm", rid, "Relations & CRM", "crm", "Bilan annuel avec les clients clés", 55, "4 bilans faits sur 7 prévus", 2)?;
    ins_pillar("saas", rid, "SaaS TDAH (focal.)", "saas", "Explorer l'idée : veille, benchmark, notes", 10, "Lecture de 3 articles, idée qui mûrit mais rien de concret", 3)?;
    ins_refl("worked", rid, "Ce qui a bien marché", "La rétrospective Q4 a été très productive. J'ai mieux géré mon énergie en respectant mes pauses.", 0)?;
    ins_refl("blocked", rid, "Ce qui m'a bloqué", "La fatigue de fin d'année. Beaucoup de distractions liées aux fêtes.", 1)?;
    ins_refl("stop", rid, "Ce que je veux arrêter", "Me surcharger en fin de mois pour \"rattraper\". Ignorer les signaux de fatigue.", 2)?;
    ins_refl("start", rid, "Ce que je veux commencer", "Planifier les semaines le dimanche soir. Mettre en place un vrai outil de suivi.", 3)?;
    ins_top3(rid, "Préparer le planning Q1 avec l'équipe", 0)?;
    ins_top3(rid, "Lancer la migration Airflow → dbt", 1)?;
    ins_top3(rid, "Faire un premier wireframe du SaaS TDAH", 2)?;

    // Review Nov 2025
    let rid = "review-2025-11";
    ins_review(rid, 10, 2025, "2025-11-04T08:45:00")?;
    ins_pillar("roadmap", rid, "Roadmap produit", "roadmap", "Livrer la feature phare du Q4", 60, "Feature en cours, besoin de plus de tests", 0)?;
    ins_pillar("data", rid, "Data Platform", "data", "Automatiser le reporting hebdo", 40, "Script en place, fiabilisation en cours", 1)?;
    ins_pillar("crm", rid, "Relations & CRM", "crm", "Relancer les clients inactifs depuis 2 mois", 30, "Seulement 2 relances envoyées, à accélérer", 2)?;
    ins_pillar("saas", rid, "SaaS TDAH (focal.)", "saas", "Première réflexion : noter les frustrations quotidiennes", 5, "Quelques notes, l'idée germe doucement", 3)?;
    ins_refl("worked", rid, "Ce qui a bien marché", "Le fait de commencer la journée sans réunion m'a donné un vrai boost de productivité.", 0)?;
    ins_refl("blocked", rid, "Ce qui m'a bloqué", "Trop de tâches en parallèle. Je perds du temps à redécouvrir le contexte quand je switch.", 1)?;
    ins_refl("stop", rid, "Ce que je veux arrêter", "Garder 10 onglets ouverts \"pour plus tard\". Essayer de tout faire en même temps.", 2)?;
    ins_refl("start", rid, "Ce que je veux commencer", "Utiliser un timer Pomodoro. Bloquer des créneaux \"pas de réunion\" dans le calendrier.", 3)?;
    ins_top3(rid, "Livrer la feature Q4 et la mettre en prod", 0)?;
    ins_top3(rid, "Automatiser le reporting : 0 action manuelle", 1)?;
    ins_top3(rid, "Faire les bilans annuels clients avant décembre", 2)?;

    Ok(())
}

fn seed_chat(conn: &Connection) -> Result<(), rusqlite::Error> {
    let ins = |id: &str, role: &str, content: &str| -> Result<(), rusqlite::Error> {
        conn.execute("INSERT INTO chat_messages (id, role, content) VALUES (?1,?2,?3)", params![id, role, content])?;
        Ok(())
    };
    ins("m1", "ai", "Salut ! Je suis ton assistant focal. Comment puis-je t'aider aujourd'hui ?")?;
    ins("m2", "user", "J'ai une grosse tâche à faire : préparer la revue de sprint")?;
    ins("m3", "ai", "Je vais t'aider à décomposer ça en micro-étapes. Voici ce que je propose :")?;
    conn.execute("INSERT INTO chat_message_steps (message_id, text, position) VALUES (?1,?2,?3)", params!["m3", "Collecter les métriques du sprint (10 min)", 0])?;
    conn.execute("INSERT INTO chat_message_steps (message_id, text, position) VALUES (?1,?2,?3)", params!["m3", "Résumer les 3 livrables majeurs (10 min)", 1])?;
    conn.execute("INSERT INTO chat_message_steps (message_id, text, position) VALUES (?1,?2,?3)", params!["m3", "Préparer 3 slides max (25 min)", 2])?;
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
