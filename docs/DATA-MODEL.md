# Schéma de données (SQLite)

> Base SQLite locale stockée dans le dossier AppData de l'OS.
> Mode WAL activé, clés étrangères activées.

---

## Diagramme des relations

```
settings (clé-valeur)
user_profile (JSON blob)
notification_history

tasks ──┬── task_tags (1:N, composite PK)
        └── micro_steps (1:N)

chat_messages ── chat_message_steps (1:N)

strategy_reviews ──┬── strategy_pillars (1:N)       ← legacy
                   ├── strategy_reflections (1:N)
                   └── strategy_top3 (1:N)

strategy_periods ── period_reflections (1:N)

strategy_goals ── strategy_strategies (1:N)
                       └── strategy_tactics (1:N)
                              └── strategy_actions (1:N)

goal_strategy_links (N:N entre goals et strategies)

integrations ── integration_rules (1:N)

oauth_credentials (provider → client_id, client_secret)
oauth_tokens (integration_id → access_token, refresh_token, expires_at)

ai_memory_insights
ai_memory_analysis_log
```

---

## Tables

### tasks

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| name | TEXT | NOT NULL | Nom de la tâche |
| done | INTEGER | NOT NULL DEFAULT 0 | 0/1 (boolean) |
| view_context | TEXT | NOT NULL DEFAULT 'today' | Contexte d'affichage : today, week, calendar, inbox |
| estimated_minutes | INTEGER | nullable | Durée estimée |
| priority | TEXT | nullable | "main" ou "secondary" |
| ai_decomposed | INTEGER | NOT NULL DEFAULT 0 | La tâche a été décomposée par l'IA |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre d'affichage |
| scheduled_date | TEXT | nullable | Date planifiée (YYYY-MM-DD) |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | Date de création |
| description | TEXT | NOT NULL DEFAULT '' | Description libre (ajoutée par migration) |
| urgency | INTEGER | DEFAULT 3 | Niveau d'urgence (1-5, ajouté par migration) |
| importance | INTEGER | DEFAULT 3 | Niveau d'importance (1-5, ajouté par migration) |

### task_tags

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| task_id | TEXT | NOT NULL, FK → tasks.id CASCADE | — |
| label | TEXT | NOT NULL | Nom du tag |
| color | TEXT | NOT NULL | Couleur CSS (crm, data, roadmap, saas, urgent) |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre d'affichage |

**Clé primaire** : `(task_id, label)` — clé composite, pas d'AUTOINCREMENT.

### micro_steps

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| task_id | TEXT | NOT NULL, FK → tasks.id CASCADE | — |
| text | TEXT | NOT NULL | Description de la micro-étape |
| done | INTEGER | NOT NULL DEFAULT 0 | 0/1 (boolean) |
| estimated_minutes | INTEGER | nullable | Durée estimée |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre d'affichage |

### chat_messages

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| role | TEXT | NOT NULL | "user" ou "ai" |
| content | TEXT | NOT NULL | Contenu du message |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | ISO datetime |

### chat_message_steps

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | — |
| message_id | TEXT | NOT NULL, FK → chat_messages.id CASCADE | — |
| text | TEXT | NOT NULL | Texte de l'étape |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre |

### strategy_reviews (legacy)

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| month | INTEGER | NOT NULL | Mois (0-11) |
| year | INTEGER | NOT NULL | Année |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | ISO datetime |

### strategy_pillars (legacy)

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | NOT NULL | UUID v4 |
| review_id | TEXT | NOT NULL, FK → strategy_reviews.id CASCADE | — |
| name | TEXT | NOT NULL | Nom du pilier |
| tag_color | TEXT | NOT NULL | Couleur du tag |
| goal | TEXT | NOT NULL DEFAULT '' | Objectif |
| progress | INTEGER | NOT NULL DEFAULT 0 | Progression (0-100) |
| insight | TEXT | NOT NULL DEFAULT '' | Insight / observation |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre d'affichage |

**Clé primaire** : `(id, review_id)` — clé composite.

### strategy_reflections (legacy)

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | NOT NULL | UUID v4 |
| review_id | TEXT | NOT NULL, FK → strategy_reviews.id CASCADE | — |
| prompt | TEXT | NOT NULL | Question de réflexion |
| answer | TEXT | NOT NULL DEFAULT '' | Réponse de l'utilisateur |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre |

**Clé primaire** : `(id, review_id)` — clé composite.

### strategy_top3 (legacy)

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| review_id | TEXT | NOT NULL, FK → strategy_reviews.id CASCADE | — |
| item | TEXT | NOT NULL | Priorité |
| position | INTEGER | NOT NULL | Ordre |

**Clé primaire** : `(review_id, position)` — clé composite.

### strategy_periods

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | Ex : "period-2026-03" |
| start_month | INTEGER | NOT NULL | Mois de début (0-11) |
| start_year | INTEGER | NOT NULL | Année de début |
| end_month | INTEGER | NOT NULL | Mois de fin |
| end_year | INTEGER | NOT NULL | Année de fin |
| frequency | TEXT | NOT NULL | monthly, bimonthly, quarterly, biannual |
| status | TEXT | NOT NULL DEFAULT 'active' | active, closed, draft |
| closed_at | TEXT | nullable | ISO datetime de clôture |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | ISO datetime |

### period_reflections

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | Ex : "period-2026-03-worked" |
| period_id | TEXT | NOT NULL, FK → strategy_periods.id CASCADE | — |
| prompt | TEXT | NOT NULL | Question de réflexion |
| answer | TEXT | NOT NULL DEFAULT '' | Réponse |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre |

### strategy_goals

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| title | TEXT | NOT NULL | Titre de l'objectif |
| target | TEXT | NOT NULL DEFAULT '' | Cible mesurable |
| deadline | TEXT | nullable | Date limite |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | Date de création |
| updated_at | TEXT | NOT NULL DEFAULT datetime('now') | Date de mise à jour |
| period_id | TEXT | nullable | FK vers strategy_periods (ajouté par migration) |

### strategy_strategies

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| goal_id | TEXT | NOT NULL, FK → strategy_goals.id CASCADE | — |
| title | TEXT | NOT NULL | Titre de la stratégie |
| description | TEXT | NOT NULL DEFAULT '' | Description |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre |

### strategy_tactics

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| strategy_id | TEXT | NOT NULL, FK → strategy_strategies.id CASCADE | — |
| title | TEXT | NOT NULL | Titre de la tactique |
| description | TEXT | NOT NULL DEFAULT '' | Description |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre |

### strategy_actions

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| tactic_id | TEXT | NOT NULL, FK → strategy_tactics.id CASCADE | — |
| text | TEXT | NOT NULL | Texte de l'action |
| done | INTEGER | NOT NULL DEFAULT 0 | 0/1 (boolean) |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre |

### goal_strategy_links

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| goal_id | TEXT | NOT NULL, FK → strategy_goals.id CASCADE | — |
| strategy_id | TEXT | NOT NULL, FK → strategy_strategies.id CASCADE | — |

**Clé primaire** : `(goal_id, strategy_id)` — relation N:N.

### integrations

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | Identifiant unique (ex: "google-calendar") |
| name | TEXT | NOT NULL | Nom d'affichage |
| description | TEXT | NOT NULL DEFAULT '' | Description |
| icon | TEXT | NOT NULL DEFAULT '' | Identifiant d'icône |
| connected | INTEGER | NOT NULL DEFAULT 0 | 0/1 (boolean) |
| category | TEXT | NOT NULL DEFAULT 'other' | calendar, email, crm, messaging, storage, other |
| extra_context | TEXT | NOT NULL DEFAULT '' | Contexte additionnel libre |
| oauth_provider | TEXT | nullable | Provider OAuth associé ("google", "microsoft", null) |
| account_email | TEXT | NOT NULL DEFAULT '' | Email du compte connecté |

### integration_rules

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| integration_id | TEXT | NOT NULL, FK → integrations.id CASCADE | — |
| text | TEXT | NOT NULL | Texte de la règle |
| urgency | INTEGER | NOT NULL DEFAULT 3 | Niveau d'urgence (1-5) |
| importance | INTEGER | NOT NULL DEFAULT 3 | Niveau d'importance (1-5) |
| position | INTEGER | NOT NULL DEFAULT 0 | Ordre |

### notification_history

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | Identifiant unique (format: `{reminderId}-{date}-{time}`) |
| reminder_id | TEXT | NOT NULL | ID du rappel déclencheur |
| icon | TEXT | NOT NULL DEFAULT '' | Emoji/icône |
| label | TEXT | NOT NULL | Titre de la notification |
| description | TEXT | NOT NULL DEFAULT '' | Description |
| scheduled_time | TEXT | NOT NULL | Heure planifiée (HH:mm) |
| fired_at | TEXT | NOT NULL | ISO datetime du déclenchement |
| missed | INTEGER | NOT NULL DEFAULT 0 | Notification manquée (0/1) |
| read_status | INTEGER | NOT NULL DEFAULT 0 | Lue par l'utilisateur (0/1) |

### user_profile

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | INTEGER | PK CHECK (id = 1) | Toujours 1 (profil unique) |
| data | TEXT | NOT NULL DEFAULT '{}' | JSON blob contenant tout le profil |

### oauth_credentials

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| provider | TEXT | PK | "google", "microsoft", etc. |
| client_id | TEXT | NOT NULL | Client ID de l'app OAuth |
| client_secret | TEXT | NOT NULL | Client Secret de l'app OAuth |

### oauth_tokens

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| integration_id | TEXT | PK | ID de l'intégration (ex: "google-calendar") |
| account_email | TEXT | NOT NULL DEFAULT '' | Email du compte connecté |
| access_token | TEXT | NOT NULL | Token d'accès courant |
| refresh_token | TEXT | nullable | Token de rafraîchissement |
| token_type | TEXT | NOT NULL DEFAULT 'Bearer' | Type de token |
| expires_at | TEXT | nullable | ISO datetime d'expiration |
| scopes | TEXT | NOT NULL DEFAULT '' | Scopes autorisés |

> **Note** : les tokens sont stockés par intégration (pas par provider). Chaque intégration a ses propres tokens.

### settings

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| key | TEXT | PK | Clé en kebab-case |
| value | TEXT | NOT NULL | Valeur (string ou JSON stringifié) |

### ai_memory_insights

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| category | TEXT | NOT NULL | Catégorie de l'insight (priorisation, rythme, etc.) |
| insight | TEXT | NOT NULL | Contenu de l'insight |
| source_date | TEXT | NOT NULL | Date source de l'analyse |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | Date de création |
| updated_at | TEXT | NOT NULL DEFAULT datetime('now') | Date de mise à jour |

### ai_memory_analysis_log

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| analysis_date | TEXT | PK | Date de l'analyse (YYYY-MM-DD) |
| analyzed_at | TEXT | NOT NULL | ISO datetime de l'exécution |
| message_count | INTEGER | NOT NULL DEFAULT 0 | Nombre de messages analysés |

---

## Conventions

- **IDs** : UUID v4 pour les entités principales, clés composites ou AUTOINCREMENT pour les tables de jointure
- **Booleans** : Stockés en INTEGER (0/1), convertis en `bool` par rusqlite
- **Dates** : Format ISO `YYYY-MM-DD` ou ISO datetime complet
- **JSON** : Certaines valeurs complexes sont stockées en JSON stringifié (profil, AI settings, notification settings)
- **Cascade** : Toutes les FK utilisent `ON DELETE CASCADE`
- **Position** : Champ `position` pour l'ordonnancement des éléments dans les listes
- **Migrations** : Ajouts de colonnes (`ALTER TABLE ... ADD COLUMN`) avec `.ok()` pour ignorer les erreurs si la colonne existe déjà
