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
- **Navigation** : `activePage` (sidebar) et `activeTab` (today/tomorrow/week/next-week/strategy)
- **Paramètres** : thème, AI settings, priorités, fréquence stratégique, jours ouvrés, onboarding
- **Notifications** : via le hook `useNotifications`
- **Mémoire IA** : appelle `checkAndRunAnalysis()` au démarrage et périodiquement (toutes les 24h)
- **Onboarding** : affiche `OnboardingView` tant que l'onboarding n'est pas terminé

Au démarrage, charge tous les paramètres depuis le backend (`getAllSettings()`), incluant :
- `theme`, `ai-settings`, `daily-priority-count`
- `strategy-enabled`, `strategy-frequency`, `strategy-cycle-start`, `strategy-occurrence`, `strategy-day`
- `working-days`, `onboarding-completed`

Un `loaded` ref empêche les écritures parasites avant l'hydratation initiale.

### Layout

```
┌──────────────────────────────────────────────┐
│  Sidebar  │    Page active      │  ChatPanel │
│  (icônes) │  (MainPanel ou     │  (IA)      │
│           │   vue dédiée)      │            │
└──────────────────────────────────────────────┘
```

- `Sidebar.tsx` : Navigation latérale (icônes), badge notifications
- `MainPanel.tsx` : Conteneur à onglets (Aujourd'hui / [Demain] / Cette semaine / [Semaine prochaine] / Prise de recul). Gère les états `dayClosed` / `weekClosed` et affiche conditionnellement les onglets "Demain" et "Semaine prochaine" quand le jour/semaine est marqué terminé.
- `ChatPanel.tsx` : Panneau de chat IA (toujours visible à droite). Commandes slash : `/help`, `/start-onboarding`, `/reset-day`, `/reset-week`, `/clear`, `/clear-db-tasks`

---

## Composants — Vues principales

### OnboardingView.tsx
- Vue d'onboarding affichée quand `onboarding-completed` n'est pas `true`
- Échange conversationnel avec l'IA pour construire le profil utilisateur
- Analyse de profil public (LinkedIn, site web) via `analyzeProfileUrl()`
- Une fois terminé, bascule vers l'app principale

### TodayView.tsx
- Affiche les priorités du jour (nombre configurable) et les tâches secondaires
- Bannière de préparation quotidienne (`PrepBanner`) avec échange IA
- Décomposition IA des tâches en micro-étapes (appel LLM réel)
- Re-décomposition et décomposition de sous-étapes
- Barre de progression et streak
- Section "Reliquat des jours précédents" (tâches en retard non terminées)
- Revue du soir et bouton "Marquer comme terminée"
- Bandeau "Journée terminée" avec bouton "Réouvrir"
- Mode planning (`isPlanning`) : utilisé pour la vue "Demain", sans actions de clôture/revue mais avec les reliquats
- Rattachement des tâches aux stratégies (badge stratégie)

### WeekView.tsx
- Vue hebdomadaire avec jour par jour (jours ouvrés configurables)
- Bannière de préparation hebdomadaire
- Double mode : vue semaine globale (priorités de la semaine) ou vue jour détaillée (clic sur un jour)
- Section "Reliquat de la semaine passée" (tâches en retard non terminées)
- Revue de la semaine et bouton "Marquer comme terminée"
- Bandeau "Semaine terminée" avec bouton "Réouvrir"
- Mode planning (`isPlanning`) : utilisé pour la vue "Semaine prochaine", sans actions de clôture/revue mais avec les reliquats
- Drag & drop inter-jours (déplacer une tâche sur une carte jour)

### StrategyView.tsx
- Vue "Prise de recul" avec périodes stratégiques configurables
- Gestion des objectifs, stratégies, tactiques et actions
- Section réflexions (questions guidées par période)
- Résumé statistique de la période (PeriodSummary)
- Accès aux périodes passées

### TodoView.tsx
- Capture rapide de tâches (inbox)
- Filtres : Tous, Non planifiés, Avec priorité, Via IA, Terminés
- Drag & drop pour réordonner (@dnd-kit)
- Matrice urgence/importance par tâche
- Vue calendrier intégrée (`CalendarView`)

### CalendarView.tsx
- Vue calendrier mensuel avec navigation
- Affichage des tâches planifiées par date (`scheduledDate`)
- Intégré dans `TodoView` (pas une page sidebar distincte)

### ToolboxView.tsx
- Page "Boîte à outils" accessible depuis la sidebar
- Accès aux outils complémentaires (suggestions, focus, etc.)

### ProfileView.tsx
- Formulaire de profil utilisateur
- Champs : prénom, contexte, activité, reconnaissance TDAH, blocages, etc.
- Sauvegarde vers le backend via `updateProfile()`

### IntegrationsView.tsx
- Liste des intégrations par catégorie
- Connexion OAuth (Google Calendar, Gmail, etc.) avec configuration des credentials
- Toggle connexion/déconnexion
- Panel contextuel (`ContextPanel`) pour configurer les règles
- Récupération de données (événements calendrier, emails)

### SettingsView.tsx
- Sélection de thème (10 thèmes)
- Configuration IA (providers, clés API, validation)
- Paramètres de priorités quotidiennes
- Paramètres de "Prise de recul" (fréquence, occurrence, jour)
- Gestion des notifications/rappels

### SuggestionsView.tsx
- Vue de suggestions générées par l'IA

### ReviewView.tsx
- Vue détaillée d'une revue stratégique passée (legacy)

---

## Composants — UI réutilisables

| Composant | Description |
|-----------|-------------|
| `TaskItem.tsx` | Item de tâche avec micro-étapes dépliables, drag & drop, estimation, tags |
| `SortableTaskItem.tsx` | Wrapper de `TaskItem` pour le drag & drop (@dnd-kit) |
| `TodoItemRow.tsx` | Ligne de tâche inbox avec urgence/importance, date, suppression |
| `TaskDetailModal.tsx` | Modal de détail/édition d'une tâche (description, tags, dates) |
| `PrepBanner.tsx` | Bannière CTA de préparation (jour/semaine/période) |
| `ProgressBar.tsx` | Barre de progression animée |
| `FocusTimer.tsx` | Timer Pomodoro/focus |
| `FocusNow.tsx` | Composant de focus immédiat |
| `EditableEstimate.tsx` | Estimation de durée éditable inline |
| `ScoreSelector.tsx` | Sélecteur de score (1-5) pour urgence/importance |
| `PriorityBadge.tsx` | Badge d'urgence/importance |
| `ProfileEditForm.tsx` | Formulaire d'édition de profil (sous-composant) |
| `ProfileField.tsx` | Champ de profil avec label et valeur |
| `ContextPanel.tsx` | Panel de configuration contextuelle (intégrations) |
| `DroppableEmptyZone.tsx` | Zone de drop vide (DnD) avec label et survol stylé |
| `NotificationToast.tsx` | Toast de notification flottant |
| `NotificationCenter.tsx` | Centre de notifications (historique) |
| `UpdateNotification.tsx` | Popup de mise à jour de l'application |

---

## Services (src/services/)

Couche d'abstraction entre les composants React et les commandes Tauri. Chaque service est un wrapper fin autour de `invoke()`.

```typescript
import { invoke } from "@tauri-apps/api/core";

export function getTasks(context: string): Promise<Task[]> {
  return invoke<Task[]>("get_tasks", { context });
}
```

### Liste des services

| Fichier | Fonctions exportées | Backend correspondant |
|---------|--------------------|-----------------------|
| `tasks.ts` | `getAllTasks`, `getTasks`, `getTasksByDate`, `getOverdueTasks`, `getOverdueTasksForDate`, `getTasksByDateRange`, `createTask`, `updateTask`, `toggleTask`, `deleteTask`, `clearAllTasks`, `clearTodayTasks`, `reorderTasks`, `getAllTags`, `setTaskTags`, `setMicroSteps`, `toggleMicroStep`, `getStreak` | commands/tasks.rs |
| `settings.ts` | `getSetting`, `setSetting`, `getAllSettings` | commands/settings.rs |
| `reviews.ts` | `getStrategyPeriods`, `createStrategyPeriod`, `updateStrategyPeriod`, `closeStrategyPeriod`, `reopenStrategyPeriod`, `upsertPeriodReflection`, `carryOverGoals`, `getStrategyGoals`, `upsertStrategyGoal`, `deleteStrategyGoal`, `upsertStrategy`, `deleteStrategy`, `getGoalStrategyLinks`, `toggleGoalStrategyLink`, `upsertTactic`, `deleteTactic`, `upsertAction`, `deleteAction`, `toggleAction`, `getPeriodSummary`, `getStrategyProgress` | commands/reviews.rs |
| `chat.ts` | `getChatMessages`, `clearChat`, `sendMessage`, `decomposeTask`, `generateSuggestions`, `sendDailyPrepMessage`, `sendWeeklyPrepMessage`, `sendPeriodPrepMessage`, `sendOnboardingMessage`, `analyzeProfileUrl` | commands/chat.rs + commands/ai.rs |
| `integrations.ts` | `getIntegrations`, `updateIntegrationConnection`, `updateIntegrationContext`, `getOAuthCredentials`, `setOAuthCredentials`, `startOAuth`, `disconnectIntegration`, `fetchCalendarEvents`, `fetchEmails` | commands/integrations.rs |
| `profile.ts` | `getProfile`, `updateProfile` | commands/profile.rs |
| `notifications.ts` | `getNotificationHistory`, `addNotificationEntry`, `markNotificationRead`, `markAllNotificationsRead`, `updateBadgeCount` | commands/notifications.rs |
| `memory.ts` | `getMemoryInsights`, `deleteMemoryInsight`, `checkAndRunAnalysis`, `runAnalysisNow` | commands/memory.rs |

> `index.ts` réexporte tous les services via `export * from "./xxx"` (sauf `memory.ts` qui est importé directement).

### Types définis dans chat.ts

Le service chat définit aussi des interfaces spécifiques :

```typescript
interface AiResponse {
  content: string;
  steps?: string[];
  tasksToAdd?: DailyPrepTask[];
  tasksToRemove?: string[];
  tasksToUpdate?: ChatTaskUpdate[];
  tasksToToggle?: string[];
  tasksToReorder?: string[];
  tagsToSet?: TagAction[];
  stepsToSet?: StepsAction[];
}

interface DailyPrepResponse {
  content: string;
  tasksToAdd: DailyPrepTask[];
  tasksToRemove: string[];
  tasksToUpdate: ChatTaskUpdate[];
  tasksToToggle?: string[];
  tasksToReorder?: string[];
  tagsToSet?: TagAction[];
  stepsToSet?: StepsAction[];
  prepComplete: boolean;
}

interface OnboardingResponse {
  content: string;
  profileUpdates: Partial<UserProfile>;
  onboardingComplete: boolean;
}
```

---

## Types TypeScript (src/types/index.ts)

Interfaces centralisées, alignées 1:1 avec les modèles Rust (grâce à serde `rename_all = "camelCase"`).

### Types principaux

| Type | Champs clés | Usage |
|------|-------------|-------|
| `Task` | id, name, done, tags, microSteps?, aiDecomposed?, estimatedMinutes?, priority?, scheduledDate?, urgency?, importance?, description?, createdAt?, strategyId? | Tâches (tous contextes) |
| `MicroStep` | id, text, done, estimatedMinutes? | Sous-étapes d'une tâche |
| `Tag` | label, color | Tags de tâche |
| `ChatMessage` | id, role, content, steps? | Messages du chat |
| `UserProfile` | firstName?, mainContext?, mainContextOther?, jobActivity?, profileResearch?, profileResearchSources?, adhdRecognition?, blockers?, remindersPreference?, organizationHorizon?, mainExpectation?, extraInfo?, publicProfileSummary? | Profil utilisateur |
| `ProfileResearchSource` | source, sourceUrl?, scrapedAt? | Source de recherche de profil |
| `MemoryInsight` | id, category, insight, sourceDate, createdAt, updatedAt | Insight de mémoire IA |
| `AISettings` | providers, selectedModel? | Configuration IA |
| `AIProviderConfig` | id, enabled, apiKey, keyStatus? | Configuration d'un provider IA |
| `NotificationSettings` | enabled, reminders | Paramètres de notifications |
| `NotificationReminder` | id, label, description, time, enabled, days, icon, frequency?, frequencyOccurrence?, frequencyCycleStart? | Un rappel configurable |
| `NotificationHistoryEntry` | id, reminderId, icon, label, description, scheduledTime, firedAt, missed, read | Entrée d'historique |
| `StrategyPeriod` | id, startMonth, startYear, endMonth, endYear, frequency, status, closedAt?, createdAt, reflections | Période stratégique |
| `PeriodReflection` | id, prompt, answer | Réflexion de période |
| `StrategyGoal` | id, title, target, deadline?, strategies, createdAt, updatedAt, periodId? | Objectif stratégique |
| `StrategyStrategy` | id, title, description, tactics | Stratégie d'un objectif |
| `StrategyTactic` | id, title, description, actions | Tactique d'une stratégie |
| `StrategyAction` | id, text, done | Action d'une tactique |
| `GoalStrategyLink` | goalId, strategyId | Lien objectif ↔ stratégie |
| `PeriodSummary` | tasksCompleted, tasksTotal, focusDays, totalDays, distribution, highlights | Résumé de période |
| `StrategyReview` | id, month, year, pillars, reflections, top3 | Revue legacy |
| `Integration` | id, name, description, icon, connected, category, context, oauthProvider?, accountEmail? | Intégration externe |
| `IntegrationContext` | rules, extraContext | Contexte d'intégration |
| `IntegrationRule` | id, text, urgency, importance | Règle d'intégration |
| `CalendarEvent` | id, title, description?, start, end, location?, attendees, source | Événement calendrier |
| `EmailMessage` | id, subject, from, to, snippet, date, isRead, labels, source | Email |
| `OAuthCredentialsInfo` | provider, clientId, configured | Info credentials OAuth |
| `Suggestion` | id, icon, title, description, source, impact, category, confidence | Suggestion IA |
| `StrategyProgressItem` | strategyId, total, completed | Progression par stratégie sur une période |

### Types de navigation

| Type | Valeurs | Usage |
|------|---------|-------|
| `ViewTab` | "today", "tomorrow", "week", "next-week", "strategy" | Onglets du MainPanel |
| `SidebarPage` | "main", "suggestions", "todos", "toolbox", "integrations", "settings", "profile" | Pages de la sidebar |
| `ThemeId` | 10 valeurs (default, clair, sombre, zen, hyperfocus, aurore, ocean, sakura, nord, solaire) | Thèmes visuels |

---

## Hooks (src/hooks/)

### useNotifications

Hook complexe gérant le système de notifications :
- Charge les paramètres et l'historique depuis le backend au démarrage
- Détecte les notifications manquées (entre la dernière activité et maintenant)
- Vérifie les rappels toutes les 30 secondes
- Déclenche des toasts in-app et des notifications natives quand un rappel est dû
- Persiste l'historique via le backend
- Met à jour le badge dock (macOS) via `updateBadgeCount`
- Sauvegarde `last-active` périodiquement

**Retourne** : `notifSettings`, `setNotifSettings`, `notifHistory`, `notifCenterOpen`, `setNotifCenterOpen`, `handleTestNotification`, `handleDismissNotif`, `handleDismissAll`, `hasUnreadNotifs`, `unreadCount`, `pendingNavigation`, `clearPendingNavigation`

### useTaskActions

Hook centralisant toutes les opérations CRUD sur les tâches, partagé entre `TodayView` et `WeekView` :
- Toggle tâche/micro-étape (avec persistance backend)
- Suppression, renommage, changement de priorité, tags
- Mise à jour des estimations (tâche et sous-étapes)
- Décomposition et re-décomposition IA (appel `decomposeTask`)
- Décomposition de sous-étapes individuelles
- Gestion de l'état `decomposingId` / `decomposingStepKey` / `isBusy`
- Callback `onStuck` pour signaler un blocage

**Paramètres** : `tasks`, `overdueTasks`, `setTasks`, `setOverdueTasks`, `onStuck?`, `tag?`

**Retourne** : `decomposingId`, `isBusy`, `updateTaskState`, `findTask`, `getDecomposingStepId`, `taskCallbacks` (objet regroupant tous les handlers)

### useStrategies

Hook centralisant le chargement et la résolution des objectifs/stratégies :
- Charge les objectifs de la période active et tous les objectifs (cache en mémoire)
- Construit un `pickerObjectives` pour le sélecteur de stratégie
- Construit un `strategyMap` pour résoudre un `strategyId` en titre d'objectif/stratégie

**Retourne** : `pickerObjectives`, `getStrategyInfo(strategyId)`, `reload()`

---

## Données et constantes (src/data/)

Ces fichiers contiennent des constantes d'affichage et de configuration.

| Fichier | Exports | Description |
|---------|---------|-------------|
| `settingsData.ts` | `themes`, `defaultReminders`, `providers` | Thèmes visuels, rappels par défaut, métadonnées des providers IA |
| `chatConstants.ts` | `chatHints`, `slashCommands` | Suggestions de prompts et commandes slash (`/help`, `/start-onboarding`, `/reset-day`, `/reset-week`, `/clear`, `/clear-db-tasks`) |
| `tagConstants.ts` | `TAG_COLORS` | Palette de couleurs pour les tags de tâches |
| `integrationConstants.ts` | `categoryLabels`, `categoryOrder` | Labels et ordre des catégories d'intégrations |
| `strategyConstants.ts` | `MONTH_NAMES` | Noms des mois en français |
| `settingsConstants.ts` | `DAY_LABELS`, `FREQUENCY_OPTIONS`, `getOccurrenceOptions`, cycles, `getActiveMonths`, `strategyPeriodLabel`, etc. | Constantes et utilitaires pour les settings |
| `profileLabels.ts` | `LABELS`, `SOURCE_LABELS`, constantes de clés | Labels d'affichage pour le profil |

---

## Utilitaires (src/utils/)

### dateFormat.ts

Fonctions de formatage et manipulation de dates :
- `toISODate(d)` — Convertit un `Date` en `YYYY-MM-DD` local (évite le bug timezone de `toISOString().slice(0,10)`)
- `getISOWeekNumber(d)` — Numéro de semaine ISO
- `formatScheduledDate(dateStr)` — Affichage relatif ("Aujourd'hui", "Demain", "lun. dernier", etc.)
- `formatDate(iso)` — Affichage relatif temporel ("il y a 5min", "hier", etc.)
- `getMondayDate(d)` / `getMondayISO(d)` — Lundi de la semaine (Date ou ISO string)
- `getNextDay(isoDate)` / `getNextMonday(mondayIso)` — Calcul du jour/lundi suivant
- `dayPrepKey(date)` / `weekPrepKey(mondayIso)` — Clés de settings pour la préparation
- `dayClosedKey(date)` / `weekClosedKey(mondayIso)` — Clés de settings pour la clôture jour/semaine
- `getQuickDates()` — Raccourcis de dates (aujourd'hui, demain, lundi prochain, etc.)

### taskUtils.ts

Fonctions utilitaires partagées pour les tâches :
- `sortOverdueTasks(tasks)` — Tri des tâches en retard (priorités main d'abord, puis score urgence/importance)
- `parseDecomposingStepId(key, taskId)` — Parse la clé de décomposition pour identifier la sous-étape en cours

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
