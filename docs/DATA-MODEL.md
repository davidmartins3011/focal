# Schéma de données (SQLite)

> Base SQLite locale stockée dans le dossier AppData de l'OS.
> Mode WAL activé, clés étrangères activées.

---

## Diagramme des relations

```
settings (clé-valeur)
user_profile (JSON blob)
notification_history

tasks ──┬── task_tags (1:N)
        └── micro_steps (1:N)

todos

chat_messages ── chat_message_steps (1:N)

strategy_reviews ──┬── strategy_pillars (1:N)
                   ├── strategy_reflections (1:N)
                   └── strategy_top3 (1:N)

integrations ── integration_rules (1:N)

oauth_credentials (provider → client_id, client_secret)
oauth_tokens (provider → access_token, refresh_token, expires_at)
```

---

## Tables

### tasks

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| name | TEXT | NOT NULL | Nom de la tâche |
| done | INTEGER | DEFAULT 0 | 0/1 (boolean) |
| view_context | TEXT | DEFAULT 'today' | Contexte d'affichage : today, week, calendar |
| estimated_minutes | INTEGER | nullable | Durée estimée |
| priority | TEXT | nullable | "main" ou "secondary" |
| ai_decomposed | INTEGER | DEFAULT 0 | La tâche a été décomposée par l'IA |
| position | INTEGER | DEFAULT 0 | Ordre d'affichage |
| scheduled_date | TEXT | nullable | Date planifiée (YYYY-MM-DD) |

### task_tags

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | — |
| task_id | TEXT | FK → tasks.id, CASCADE | — |
| label | TEXT | NOT NULL | Nom du tag |
| color | TEXT | NOT NULL | Couleur CSS (crm, data, roadmap, saas, urgent) |
| position | INTEGER | DEFAULT 0 | Ordre d'affichage |

### micro_steps

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| task_id | TEXT | FK → tasks.id, CASCADE | — |
| text | TEXT | NOT NULL | Description de la micro-étape |
| done | INTEGER | DEFAULT 0 | 0/1 (boolean) |
| estimated_minutes | INTEGER | nullable | Durée estimée |
| position | INTEGER | DEFAULT 0 | Ordre d'affichage |

### todos

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| text | TEXT | NOT NULL | Texte du todo |
| done | INTEGER | DEFAULT 0 | 0/1 (boolean) |
| urgency | INTEGER | nullable | Niveau d'urgence (1-5) |
| importance | INTEGER | nullable | Niveau d'importance (1-5) |
| source | TEXT | DEFAULT 'manual' | "manual" ou "ai" |
| created_at | TEXT | NOT NULL | ISO datetime de création |
| scheduled_date | TEXT | nullable | Date planifiée (YYYY-MM-DD) |

### chat_messages

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| role | TEXT | NOT NULL | "user" ou "ai" |
| content | TEXT | NOT NULL | Contenu du message |
| created_at | TEXT | NOT NULL | ISO datetime |

### chat_message_steps

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | — |
| message_id | TEXT | FK → chat_messages.id, CASCADE | — |
| text | TEXT | NOT NULL | Texte de l'étape |
| position | INTEGER | DEFAULT 0 | Ordre |

### strategy_reviews

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| month | INTEGER | NOT NULL | Mois (0-11) |
| year | INTEGER | NOT NULL | Année |
| created_at | TEXT | NOT NULL | ISO datetime |

### strategy_pillars

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| review_id | TEXT | FK → strategy_reviews.id, CASCADE | — |
| name | TEXT | NOT NULL | Nom du pilier |
| tag_color | TEXT | NOT NULL | Couleur du tag |
| goal | TEXT | NOT NULL | Objectif |
| progress | INTEGER | DEFAULT 0 | Progression (0-100) |
| insight | TEXT | DEFAULT '' | Insight / observation |

### strategy_reflections

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| review_id | TEXT | FK → strategy_reviews.id, CASCADE | — |
| prompt | TEXT | NOT NULL | Question de réflexion |
| answer | TEXT | DEFAULT '' | Réponse de l'utilisateur |

### strategy_top3

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | — |
| review_id | TEXT | FK → strategy_reviews.id, CASCADE | — |
| text | TEXT | NOT NULL | Priorité |
| position | INTEGER | DEFAULT 0 | Ordre |

### integrations

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | Identifiant unique (ex: "google-calendar") |
| name | TEXT | NOT NULL | Nom d'affichage |
| description | TEXT | DEFAULT '' | Description |
| icon | TEXT | DEFAULT '' | Identifiant d'icône |
| connected | INTEGER | DEFAULT 0 | 0/1 (boolean) |
| category | TEXT | DEFAULT 'other' | calendar, email, crm, messaging, storage, other |
| extra_context | TEXT | DEFAULT '' | Contexte additionnel libre |
| oauth_provider | TEXT | nullable | Provider OAuth associé ("google", "microsoft", null) |

### integration_rules

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | UUID v4 |
| integration_id | TEXT | FK → integrations.id, CASCADE | — |
| text | TEXT | NOT NULL | Texte de la règle |
| urgency | INTEGER | DEFAULT 3 | Niveau d'urgence (1-5) |
| importance | INTEGER | DEFAULT 3 | Niveau d'importance (1-5) |
| position | INTEGER | DEFAULT 0 | Ordre |

### notification_history

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | TEXT | PK | Identifiant unique (format: `{reminderId}-{date}-{time}`) |
| reminder_id | TEXT | NOT NULL | ID du rappel déclencheur |
| icon | TEXT | DEFAULT '' | Emoji/icône |
| label | TEXT | NOT NULL | Titre de la notification |
| description | TEXT | DEFAULT '' | Description |
| scheduled_time | TEXT | NOT NULL | Heure planifiée (HH:mm) |
| fired_at | TEXT | NOT NULL | ISO datetime du déclenchement |
| missed | INTEGER | DEFAULT 0 | Notification manquée (0/1) |
| read | INTEGER | DEFAULT 0 | Lue par l'utilisateur (0/1) |

### user_profile

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| id | INTEGER | PK | Toujours 1 (profil unique) |
| data | TEXT | NOT NULL | JSON blob contenant tout le profil |

### oauth_credentials

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| provider | TEXT | PK | "google", "microsoft", etc. |
| client_id | TEXT | NOT NULL | Client ID de l'app OAuth |
| client_secret | TEXT | NOT NULL | Client Secret de l'app OAuth |

### oauth_tokens

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| provider | TEXT | PK | "google", "microsoft", etc. |
| access_token | TEXT | NOT NULL | Token d'accès courant |
| refresh_token | TEXT | nullable | Token de rafraîchissement |
| token_type | TEXT | DEFAULT 'Bearer' | Type de token |
| expires_at | TEXT | nullable | ISO datetime d'expiration |
| scopes | TEXT | DEFAULT '' | Scopes autorisés |

### settings

| Colonne | Type | Contraintes | Description |
|---------|------|------------|-------------|
| key | TEXT | PK | Clé en kebab-case |
| value | TEXT | NOT NULL | Valeur (string ou JSON stringifié) |

---

## Conventions

- **IDs** : UUID v4 pour les entités principales, AUTOINCREMENT pour les tables de jointure simples
- **Booleans** : Stockés en INTEGER (0/1), convertis en `bool` par rusqlite
- **Dates** : Format ISO `YYYY-MM-DD` ou ISO datetime complet
- **JSON** : Certaines valeurs complexes sont stockées en JSON stringifié (profil, AI settings, notification settings)
- **Cascade** : Toutes les FK utilisent `ON DELETE CASCADE`
- **Position** : Champ `position` pour l'ordonnancement des éléments dans les listes
