# Focal — Architecture technique

> **Focal** est une application desktop d'aide à la productivité pour les personnes TDAH.
> Elle combine gestion de tâches, décomposition IA en micro-étapes, et coaching contextuel.

---

## Stack technique

| Couche       | Technologie                          | Version   |
|-------------|--------------------------------------|-----------|
| Frontend    | React + TypeScript                   | 18.3 / 5.6 |
| Bundler     | Vite                                 | 6.x       |
| Desktop     | Tauri                                | 2.x       |
| Backend     | Rust                                 | edition 2021 |
| Base de données | SQLite (rusqlite, mode WAL)      | 0.31      |
| IA          | Anthropic / OpenAI / Mistral (reqwest) | 0.12    |
| Drag & Drop | @dnd-kit                             | 6.x / 10.x |

---

## Arborescence

```
focal/
├── docs/                    # ← vous êtes ici
├── ideas/                   # Notes de conception et brainstorming
├── src/                     # Frontend React
│   ├── App.tsx              # Composant racine, état global, routing
│   ├── main.tsx             # Point d'entrée React
│   ├── components/          # 34 composants React (.tsx + .module.css)
│   ├── services/            # Couche d'accès aux commandes Tauri
│   ├── hooks/               # Hooks React réutilisables (useNotifications, useTaskActions, useStrategies)
│   ├── types/               # Interfaces TypeScript centralisées
│   ├── data/                # Constantes et données de configuration
│   ├── utils/               # Utilitaires (dateFormat, taskUtils)
│   └── styles/              # Variables CSS, thèmes
├── src-tauri/               # Backend Rust (Tauri)
│   ├── Cargo.toml           # Dépendances Rust
│   ├── tauri.conf.json      # Configuration Tauri
│   ├── build.rs             # Script de build
│   └── src/
│       ├── main.rs          # Point d'entrée Tauri
│       ├── lib.rs           # Initialisation, enregistrement des commandes
│       ├── db.rs            # Schéma SQLite, migrations, seed
│       ├── models.rs        # Structures de données sérialisables
│       ├── commands/        # Commandes Tauri (API backend)
│       │   ├── mod.rs
│       │   ├── tasks.rs     # Tâches (today/week/calendar/inbox)
│       │   ├── settings.rs  # Paramètres clé-valeur
│       │   ├── reviews.rs   # Périodes stratégiques, objectifs, stratégies, tactiques, actions
│       │   ├── chat.rs      # Historique du chat
│       │   ├── ai.rs        # Intégration LLM (chat, décomposition, préparations, onboarding)
│       │   ├── integrations.rs # Intégrations + OAuth + data fetching
│       │   ├── profile.rs   # Profil utilisateur
│       │   ├── notifications.rs # Notifications (historique, badge, envoi natif)
│       │   └── memory.rs    # Mémoire IA (analyse comportementale des conversations)
│       └── providers/       # Connecteurs APIs externes (OAuth, Google)
│           ├── mod.rs       # Types partagés, mapping intégrations ↔ providers, scopes
│           ├── oauth.rs     # Flux OAuth complet (auth code, tokens, refresh)
│           └── google.rs    # Google Calendar API + Gmail API
├── index.html               # HTML racine
├── package.json             # Dépendances npm
├── vite.config.ts           # Config Vite
├── tsconfig.json            # Config TypeScript
└── .gitignore
```

---

## Flux de données

```
┌─────────────────────────────────────────────────────┐
│                    Frontend React                    │
│                                                      │
│  Components ──► Services (invoke()) ──► Tauri IPC   │
│      ▲                                      │        │
│      │              réponse                 ▼        │
│      └─────────────────────────── Commands Rust     │
│                                      │               │
│                                      ▼               │
│                               SQLite (local)         │
│                                      │               │
│                                      ▼               │
│                              LLM APIs (réseau)       │
└─────────────────────────────────────────────────────┘
```

1. **Composants React** appellent les fonctions de `src/services/`
2. **Services** encapsulent `invoke()` de `@tauri-apps/api/core`
3. **Tauri IPC** route vers les fonctions `#[tauri::command]` en Rust
4. **Commandes Rust** accèdent à la **base SQLite** via `AppState` (Mutex)
5. Pour l'IA, les commandes font des **requêtes HTTP** (reqwest) vers les APIs LLM
6. Pour les intégrations, le module `providers/` gère **OAuth** et les appels aux APIs tierces (Google Calendar, Gmail)

---

## Documentation détaillée

| Document | Contenu |
|----------|---------|
| [BACKEND.md](./BACKEND.md) | Backend Rust : modèles, commandes, base de données |
| [FRONTEND.md](./FRONTEND.md) | Frontend React : composants, services, types, hooks |
| [AI.md](./AI.md) | Intégration IA : providers, system prompt, décomposition, préparations |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Intégrations externes : OAuth, Google Calendar, Gmail |
| [DATA-MODEL.md](./DATA-MODEL.md) | Schéma SQLite complet et relations entre tables |
| [RELEASES_ARCHITECTURE.md](./RELEASES_ARCHITECTURE.md) | Architecture des releases et mises à jour |

---

## Lancer le projet

```bash
# Prérequis : Node.js, Rust (rustup), Tauri CLI
npm install

# Lancer en développement (front + back ensemble)
npm run tauri dev

# Build de production
npm run tauri build
```

> `npm run tauri dev` lance automatiquement Vite (port 1420) puis compile et exécute le binaire Rust.
> L'app ne fonctionne que dans la **fenêtre native Tauri**, pas dans un navigateur web classique (les appels `invoke()` nécessitent le runtime Tauri).

---

## Conventions

- **Langue de l'UI** : Français
- **Nommage** : `camelCase` côté TypeScript, `snake_case` côté Rust. Serde `rename_all = "camelCase"` assure la conversion automatique.
- **CSS** : CSS Modules (`.module.css`) pour chaque composant. Variables globales dans `src/styles/theme.css`.
- **Thèmes** : 10 thèmes via attribut `data-theme` sur `<html>`, déclarés dans `theme.css`.
- **Settings** : Stockés en base dans une table `settings` (clé-valeur). Clés en `kebab-case` (ex: `daily-priority-count`).
- **Dates** : Format `YYYY-MM-DD` pour les clés et les champs de date.
- **IDs** : UUID v4 générés côté Rust.
