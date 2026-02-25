# Assistant IA pour personnes TDAH — "focal."

**Date de capture :** 2026-02-25  
**Pilier :** Lancer un SaaS  
**Statut :** MVP défini — mockup UI créé  
**Fichier mockup :** `saas-tdah-mockup.html` (même dossier)

---

## Vision

Un assistant IA personnel conçu spécifiquement pour les personnes souffrant de TDAH.  
L'objectif : aider à décomposer, structurer et accomplir les tâches complexes — là où le cerveau TDAH bloque.

**Ce n'est pas une app générique avec un "mode TDAH"**. C'est un outil pensé de bout en bout pour des cerveaux qui fonctionnent différemment.

**Nom de code actuel :** `focal.`

---

## Le "Moment Magique" (insight clé)

> Transformer une tâche floue et écrasante en 3 micro-étapes actionnables en 10 secondes — sans que l'utilisateur ait à réfléchir à comment la décomposer.

C'est ce moment qui crée l'attachement. Toutes les décisions produit doivent servir ce moment.

---

## Périmètre produit

### Ce que c'est (vision complète)
Un outil en deux volets :
1. **Gestion de planning et tâches** — daily plan, weekly plan, task breakdown, reviews
2. **Suivi de meetings et relations** — contexte participants, comptes rendus, pages personnes, action items

Inspiré de la structure de Dex (le système de connaissance personnelle), adapté aux contraintes cognitives du TDAH.

### Fonctionnalités planning (comme Dex, mais TDAH-first)
- `/daily-plan` — Structurer la journée le matin (calendrier + tâches + priorités)
- `/daily-review` — Bilan du soir : ce qui a été fait, ce qui reste, top 3 demain
- `/week-plan` — Début de semaine : 3–5 priorités
- `/week-review` — Fin de semaine : synthèse et objectifs

### Fonctionnalités meetings et relations (post-MVP)
- `/meeting-prep` — Avant une réunion : contexte participants + sujets
- `/process-meetings` — Traiter les comptes rendus, mettre à jour les pages personnes, extraire les tâches
- `/triage` — Inbox pleine : ranger, extraire les tâches
- Pages personnes : clients, partenaires, collègues

---

## MVP — Périmètre défini

### Ce qu'on construit en V1

**Planning**
- Vue "Aujourd'hui" : bloc "Focus maintenant" (tâche prioritaire mise en avant), liste de tâches du jour, barre de progression
- Vue "Cette semaine" : grille des 5 jours avec dots de progression, priorités de la semaine
- Décomposition IA de tâches en micro-étapes (le cœur du produit)
- Revue de fin de journée guidée par l'IA

**Chat IA**
- Interface conversationnelle à droite de l'écran
- Sélecteur de modèle (Claude, GPT-4, etc.)
- Raccourcis rapides (pills) pour les actions fréquentes
- L'IA connaît le contexte : elle sait quelles tâches tu as, quelle est ta journée
- Bouton "Ajouter ces étapes à la tâche" directement depuis le chat

### Ce qu'on reporte (post-MVP)
- Marketplace de skills (communauté)
- Profil adaptatif appris dans le temps
- Extension browser
- Suivi de meetings / pages personnes
- Skills créés par les utilisateurs

---

## Système de Skills (différenciateur clé — post-MVP)

### Concept
Une bibliothèque de skills activables, comme des modules de comportement :
- Chaque skill peut être activé/désactivé selon le profil de l'utilisateur
- Skills créables par la communauté ou par l'utilisateur (comme les skills Dex/Claude)
- Chaque skill a un niveau de **proactivité configurable** (passif → proactif)

### Exemples de skills envisagés
| Skill | Description | Proactivité possible |
|---|---|---|
| Décomposer une tâche | Découpe automatiquement en micro-étapes | Sur demande ou auto au moment d'ajouter une tâche |
| Mode focus | Masque les distractions, timer Pomodoro adapté | Passif (user lance) ou proactif (propose selon l'heure) |
| Rappels doux | Notifications non-intrusives | Silencieux → relance active |
| Body double virtuel | Présence IA pendant le travail, sans interruption | Toujours actif en session |
| Gestion procrastination | Détecte les patterns de blocage, intervient | Proactif après X minutes d'inactivité |
| Revue du soir | Bilan guidé, top 3 demain | Rappel automatique à heure configurable |

### Proactivité modulable
- Chaque TDAH est différent dans ses besoins de "push"
- L'utilisateur choisit le niveau par skill, pas un réglage global
- Peut varier selon l'état du moment (journée chargée vs calme)

---

## Interface — Décisions prises

### Architecture visuelle
- **Split layout** : panneau gauche + panneau droit
  - **Gauche (58%)** : interface visuelle traditionnelle — planning, tâches, calendrier
  - **Droite (42%)** : chat IA conversationnel
- L'utilisateur peut interagir avec les deux en parallèle (ex : chat IA génère des étapes → bouton pour les ajouter directement dans la tâche à gauche)

### Design system
- Dark mode warm (fond brun-noir chaud, pas bleu-gris froid)
- Couleur accent : ambre/orange chaud `#e8943a`
- Tags colorés par pilier (vert CRM, bleu Data, orange Roadmap, violet SaaS)
- Animations légères (fade-up au chargement, pulse sur le statut IA)
- Typographie : `Outfit` (UI) + `Lora` (logo, headers)
- Principe TDAH : peu de friction, hiérarchie visuelle claire, "Focus maintenant" toujours visible

### Éléments UX clés
- Bloc **"Focus maintenant"** en haut de la vue jour — une seule tâche mise en avant
- **Barre de progression** du jour (X/Y tâches) — feedback de momentum
- **Streak** (🔥 5j de suite) — renforcement positif
- **Micro-étapes dépliables** sur chaque tâche — décomposition IA visible sans surcharger la vue
- **Badges IA** sur les tâches décomposées automatiquement
- **Pills de raccourcis** dans le chat (Décomposer une tâche / Plan du jour / Je suis bloqué / Revue du soir)

---

## Stack technique — Décisions prises

### Desktop app
- **Framework : Tauri** (choix vs Electron)
  - Electron : bundle Chromium (~150MB), plus lent, plus connu
  - Tauri : utilise le WebView natif du système, binaire léger (~5-10MB), plus performant, Rust backend
  - Conclusion : Tauri est le bon choix pour une app desktop performante et légère
- Frontend : HTML/CSS/JS ou React (à trancher)
- Backend IA : multi-model via API (Claude Anthropic, OpenAI GPT-4, etc.)

### Futur
- Extension browser (Chrome/Arc) — post-MVP, le blocage se passe souvent *pendant* le travail sur ordi

---

## Différenciateurs vs concurrents

| App | Ce qu'elle fait | Limite |
|---|---|---|
| Focusmate | Body double humain, créneaux fixes | Dépend des autres, pas IA, pas de planning |
| Goblin Tools | Décomposition de tâches IA | Pas de continuité, pas de planning, pas d'app |
| Tiimo | Planning visuel TDAH | Pas d'IA, pas de décomposition, pas de chat |
| Notion/Linear | Gestion de tâches | Pas pensé TDAH, surcharge cognitive |

**focal. se différencie par :**
- Continuité et mémoire (connaît ton contexte)
- IA conversationnelle intégrée au planning (pas un outil séparé)
- Système de skills modulaires (post-MVP)
- Proactivité configurable par skill
- Conçu *entièrement* pour le cerveau TDAH, pas en mode "bolt-on"

---

## Questions ouvertes

- **Monétisation** : freemium (skills de base gratuits, skills premium payants) ? Abonnement mensuel ? B2C ou aussi B2B (employeurs, thérapeutes) ?
- **Communauté skills** : qui crée les skills ? Comment les valider (sécurité, qualité) ?
- **Aspects cliniques** : partenariats avec professionnels de santé (psychologues, coaches TDAH) ? Disclaimer légal ?
- **Modèle IA** : API externe (Claude/GPT) ou modèle local pour la confidentialité ?
- **Onboarding** : comment calibrer le profil TDAH initial sans surcharger l'utilisateur dès le départ ?

---

## Prochaines étapes

- [ ] Créer un repo GitHub dédié (`focal-app`) et y déplacer le mockup HTML
- [ ] Explorer les apps TDAH existantes — lire les avis négatifs (frustrations = gaps produit)
- [ ] Identifier 3-5 personnes TDAH à interviewer (valider le "moment magique")
- [ ] Définir le premier skill MVP : décomposition de tâche seule, ou inclure un timer focus ?
- [ ] Trancher : React ou HTML/CSS/JS vanilla pour le frontend Tauri ?
- [ ] Valider le modèle "marketplace de skills" vs "skills curatés par l'équipe" au lancement

---

## Journal de l'idée

| Date | Étape |
|---|---|
| 2026-02-25 | Capture initiale de l'idée |
| 2026-02-25 | Expansion vers outil de planning complet (daily/weekly/review) |
| 2026-02-25 | Définition du MVP (planning + décomposition de tâches) |
| 2026-02-25 | Choix technique : desktop app Tauri, split layout |
| 2026-02-25 | Premier mockup UI créé (`saas-tdah-mockup.html`) |
