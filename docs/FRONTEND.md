# Frontend React

> Interface React 18 + TypeScript, bundlée par Vite, affichée dans une fenêtre native Tauri.

---

## Point d'entrée

- `main.tsx` : Monte `<App />` dans le DOM
- `App.tsx` : Composant racine qui gère l'état global, le routing et les paramètres

---

## Architecture des composants

### App.tsx — Orchestrateur

Gère l'état global de l'application :
- **Navigation** : `activePage` (sidebar) et `activeTab` (today/week/strategy)
- **Paramètres** : thème, AI settings, priorités, fréquence stratégique
- **Notifications** : via le hook `useNotifications`

Au démarrage, charge tous les paramètres depuis le backend (`getAllSettings()`), puis synchronise chaque changement via `setSetting()`. Un `loaded` ref empêche les écritures parasites avant l'hydratation initiale.

### Layout

```
┌──────────────────────────────────────────────┐
│  Sidebar  │    Page active      │  ChatPanel │
│  (icônes) │  (MainPanel ou     │  (IA)      │
│           │   vue dédiée)      │            │
└──────────────────────────────────────────────┘
```

- `Sidebar.tsx` : Navigation latérale (icônes), badge notifications
- `MainPanel.tsx` : Conteneur à onglets (Aujourd'hui / Cette semaine / Prise de recul)
- `ChatPanel.tsx` : Panneau de chat IA (toujours visible à droite)

---

## Composants — Vues principales

### TodayView.tsx
- Affiche les priorités du jour (nombre configurable)
- Bannière de préparation quotidienne (`PrepBanner`)
- Décomposition IA des tâches en micro-étapes (appel LLM réel)
- Re-décomposition et décomposition de sous-étapes
- Barre de progression et streak

### WeekView.tsx
- Vue hebdomadaire avec jour par jour
- Bannière de préparation hebdomadaire
- Barre de progression globale de la semaine

### StrategyView.tsx
- Vue "Prise de recul" avec fréquence configurable (mensuel à semestriel)
- Affichage des piliers avec jauge de progression
- Section réflexions (questions guidées)
- Accès aux revues passées (`ReviewView`)

### TodoView.tsx
- Capture rapide de todos (inbox)
- Filtres : Tous, Non planifiés, Avec priorité, Via IA, Terminés
- Drag & drop pour réordonner (@dnd-kit)
- Matrice urgence/importance par todo

### CalendarView.tsx
- Vue calendrier mensuel avec navigation
- Affichage des tâches planifiées par date (`scheduledDate`)
- Données chargées via `fetchTasks("calendar")`

### ProfileView.tsx
- Formulaire de profil utilisateur
- Champs : prénom, contexte, activité, reconnaissance TDAH, blocages, etc.
- Sauvegarde vers le backend via `updateProfile()`

### IntegrationsView.tsx
- Liste des intégrations par catégorie
- Connexion OAuth (Google Calendar, Gmail, etc.) avec configuration des credentials
- Toggle connexion/déconnexion avec gestion des tokens partagés entre siblings
- Panel contextuel (`ContextPanel`) pour configurer les règles
- Récupération de données (événements calendrier, emails)

### SettingsView.tsx
- Sélection de thème (10 thèmes)
- Configuration IA (providers, clés API)
- Paramètres de priorités quotidiennes
- Paramètres de "Prise de recul" (fréquence, occurrence, jour)
- Gestion des notifications/rappels

### SuggestionsView.tsx
- Vue de suggestions (placeholder pour les futures fonctionnalités)

### ReviewView.tsx
- Vue détaillée d'une revue stratégique passée

---

## Composants — UI réutilisables

| Composant | Description |
|-----------|-------------|
| `TaskItem.tsx` | Item de tâche avec micro-étapes dépliables, drag & drop, estimation, tags |
| `TodoItemRow.tsx` | Ligne de todo avec urgence/importance, date, suppression |
| `PrepBanner.tsx` | Bannière CTA de préparation (jour/semaine) |
| `ProgressBar.tsx` | Barre de progression animée |
| `FocusTimer.tsx` | Timer Pomodoro/focus |
| `FocusNow.tsx` | Composant de focus immédiat |
| `EditableEstimate.tsx` | Estimation de durée éditable inline |
| `ScoreSelector.tsx` | Sélecteur de score (1-5) pour urgence/importance |
| `ProfileEditForm.tsx` | Formulaire d'édition de profil (sous-composant) |
| `ProfileField.tsx` | Champ de profil avec label et valeur |
| `ContextPanel.tsx` | Panel de configuration contextuelle (intégrations) |
| `NotificationToast.tsx` | Toast de notification flottant |
| `NotificationCenter.tsx` | Centre de notifications (historique) |

---

## Services (src/services/)

Couche d'abstraction entre les composants React et les commandes Tauri. Chaque service est un wrapper fin autour de `invoke()`.

```typescript
// Exemple type
import { invoke } from "@tauri-apps/api/core";

export function getTasks(context: string): Promise<Task[]> {
  return invoke<Task[]>("get_tasks", { context });
}
```

### Liste des services

| Fichier | Fonctions exportées | Backend correspondant |
|---------|--------------------|-----------------------|
| `tasks.ts` | `getTasks`, `getTasksByDate`, `getTasksByDateRange`, `createTask`, `updateTask`, `toggleTask`, `deleteTask`, `reorderTasks`, `setMicroSteps`, `toggleMicroStep` | commands/tasks.rs |
| `todos.ts` | `getTodos`, `createTodo`, `updateTodo`, `toggleTodo`, `deleteTodo` | commands/todos.rs |
| `settings.ts` | `getSetting`, `setSetting`, `getAllSettings` | commands/settings.rs |
| `reviews.ts` | `getStrategyReviews` | commands/reviews.rs |
| `chat.ts` | `getChatMessages`, `addChatMessage`, `sendMessage`, `decomposeTask` | commands/chat.rs + commands/ai.rs |
| `integrations.ts` | `getIntegrations`, `updateIntegrationConnection`, `updateIntegrationContext`, `getOAuthCredentials`, `setOAuthCredentials`, `startOAuth`, `disconnectIntegration`, `fetchCalendarEvents`, `fetchEmails` | commands/integrations.rs |
| `profile.ts` | `getProfile`, `updateProfile` | commands/profile.rs |
| `notifications.ts` | `getNotificationHistory`, `addNotificationEntry`, `markNotificationRead`, `markAllNotificationsRead` | commands/notifications.rs |

> `index.ts` réexporte tous les services via `export * from "./xxx"`.

---

## Types TypeScript (src/types/index.ts)

Interfaces centralisées, alignées 1:1 avec les modèles Rust (grâce à serde `rename_all = "camelCase"`).

### Types principaux

| Type | Champs clés | Usage |
|------|-------------|-------|
| `Task` | id, name, done, tags, microSteps?, priority?, scheduledDate? | Tâches prioritaires |
| `MicroStep` | id, text, done, estimatedMinutes? | Sous-étapes d'une tâche |
| `Tag` | label, color | Tags de tâche |
| `TodoItem` | id, text, done, urgency?, importance?, source, scheduledDate? | Capture rapide |
| `ChatMessage` | id, role, content, steps? | Messages du chat |
| `UserProfile` | firstName?, mainContext?, blockers?, ... | Profil utilisateur |
| `AISettings` | providers, selectedModel? | Configuration IA |
| `NotificationSettings` | enabled, reminders | Paramètres de notifications |
| `NotificationReminder` | id, label, time, enabled, days, frequency? | Un rappel configurable |
| `StrategyReview` | id, month, year, pillars, reflections, top3 | Revue stratégique |
| `Integration` | id, name, connected, category, context, oauthProvider? | Intégration externe |
| `CalendarEvent` | id, title, start, end, attendees, source | Événement calendrier |
| `EmailMessage` | id, subject, from, to, snippet, date, isRead, source | Email |
| `OAuthCredentialsInfo` | provider, clientId, configured | Info credentials OAuth |

### Types de navigation

| Type | Valeurs | Usage |
|------|---------|-------|
| `ViewTab` | "today", "week", "strategy" | Onglets du MainPanel |
| `SidebarPage` | "main", "calendar", "suggestions", "todos", "integrations", "settings", "profile" | Pages de la sidebar |
| `ThemeId` | 10 valeurs (default, clair, sombre, zen, hyperfocus, aurore, ocean, sakura, nord, solaire) | Thèmes visuels |

---

## Hooks (src/hooks/)

### useNotifications

Hook complexe gérant le système de notifications :
- Charge les paramètres et l'historique depuis le backend au démarrage
- Détecte les notifications manquées (entre la dernière activité et maintenant)
- Vérifie les rappels toutes les 30 secondes
- Déclenche des toasts in-app quand un rappel est dû
- Persiste l'historique via le backend
- Sauvegarde `last-active` toutes les 60 secondes

**Retourne** : `notifSettings`, `setNotifSettings`, `notifHistory`, `toasts`, `notifCenterOpen`, `dismissToast`, `handleTestNotification`, `handleDismissNotif`, `handleDismissAll`, `hasUnreadNotifs`

---

## Données et constantes (src/data/)

Ces fichiers contiennent des constantes d'affichage et de configuration (pas de mock data pour les entités).

| Fichier | Exports | Description |
|---------|---------|-------------|
| `mockSettings.ts` | `themes`, `defaultReminders`, `providers` | Thèmes visuels, rappels par défaut, métadonnées des providers IA |
| `mockChat.ts` | `chatHints` | Suggestions de prompts pour le chat |
| `mockIntegrations.ts` | `categoryLabels`, `categoryOrder` | Labels et ordre des catégories d'intégrations |
| `mockStrategyReviews.ts` | `MONTH_NAMES` | Noms des mois en français |
| `settingsConstants.ts` | `DAY_LABELS`, `FREQUENCY_OPTIONS`, `getOccurrenceOptions`, cycles, `getActiveMonths`, `strategyPeriodLabel`, etc. | Constantes et utilitaires pour les settings |
| `profileLabels.ts` | `LABELS`, `SOURCE_LABELS`, constantes de clés | Labels d'affichage pour le profil |

---

## Utilitaires (src/utils/)

### dateFormat.ts

Fonctions de formatage de dates en français :
- Formatage de la date du jour
- Calcul du numéro de semaine
- Formatage des noms de jours et mois

---

## Styles

### CSS Modules

Chaque composant a son fichier `.module.css` associé. Les classes sont scopées automatiquement.

### Thèmes (src/styles/theme.css)

Fichier de variables CSS avec 10 thèmes déclarés via `[data-theme="xxx"]`. Variables principales :

```css
--bg-primary      /* Fond principal */
--bg-secondary    /* Fond secondaire (cartes) */
--bg-tertiary     /* Fond tertiaire (survol) */
--text-primary    /* Texte principal */
--text-secondary  /* Texte secondaire */
--text-muted      /* Texte atténué */
--accent          /* Couleur d'accent principale */
--accent-hover    /* Accent au survol */
--accent-text     /* Texte sur fond accent */
--border          /* Bordures */
--success         /* Succès (vert) */
--warning         /* Avertissement (jaune) */
--danger          /* Danger (rouge) */
```

Le thème est appliqué via `document.documentElement.setAttribute("data-theme", theme)` dans `App.tsx`.
