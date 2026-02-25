# Reprise — Projet focal. (Assistant IA TDAH)

> Ce fichier est destiné à Cursor / Claude sur un nouvel ordinateur.  
> Lis-le entièrement avant de répondre quoi que ce soit. Il contient tout le contexte nécessaire pour reprendre la réflexion exactement là où elle s'est arrêtée.

---

## Qui je suis

**David Martins** — Data Engineer & Architect / Head of Data (Freelance), actuellement en mission chez Groupe TF1, région parisienne. 10+ ans d'expérience. Certifications : Snowflake, dbt, AWS, Kubernetes.

Je travaille sur un side project SaaS en dehors de ma mission principale.

---

## Le projet : focal.

Un **assistant IA desktop** conçu spécifiquement pour les personnes souffrant de TDAH.

**Insight central :**  
> Transformer une tâche floue et écrasante en 3 micro-étapes actionnables en 10 secondes. C'est le "moment magique" qui crée l'attachement. Toutes les décisions produit doivent servir ce moment.

**Ce que c'est :**  
Un outil en deux volets — gestion de planning/tâches + suivi de meetings/relations — pensé de bout en bout pour le cerveau TDAH. Pas une app générique avec un mode TDAH.

**Référence complète :** voir `2026-02-25 - Assistant IA TDAH.md` dans ce même dossier.

---

## État exact au moment de la pause

### Ce qui est fait
- ✅ Vision produit définie et documentée en détail
- ✅ Périmètre MVP tranché (voir ci-dessous)
- ✅ Décisions techniques prises (Tauri, split layout)
- ✅ Premier mockup UI créé (`saas-tdah-mockup.html` — ouvrir dans un navigateur)
- ✅ Design system défini (dark mode warm, accent ambre `#e8943a`, Outfit + Lora)

### MVP — Ce qu'on construit en V1
1. **Vue Aujourd'hui** : Focus Now, liste de tâches, progression du jour
2. **Vue Cette semaine** : grille 5 jours, priorités de la semaine
3. **Décomposition IA** de tâches en micro-étapes (cœur du produit)
4. **Revue du soir** guidée par l'IA
5. **Chat IA** à droite (multi-model : Claude, GPT-4...)

### Post-MVP (ne pas faire maintenant)
- Marketplace de skills communautaire
- Profil adaptatif appris dans le temps
- Extension browser
- Suivi de meetings / pages personnes

---

## Décisions techniques actées

| Sujet | Décision | Raison |
|---|---|---|
| Framework desktop | **Tauri** | Léger (~5-10MB vs 150MB Electron), performant, Rust backend |
| Layout | **Split** gauche/droite | Gauche = visuel (tâches/planning), Droite = chat IA |
| Modèle IA | **Multi-model** via API | Claude Anthropic + OpenAI GPT-4 au choix de l'utilisateur |
| Design | **Dark mode warm** | Moins de surcharge visuelle, adapté aux longues sessions |
| Frontend | **À trancher** | React ou HTML/CSS/JS vanilla dans Tauri |

---

## Où on s'était arrêté — La prochaine étape logique

On venait de créer le mockup UI et de compléter la documentation. La conversation naturelle à reprendre :

**Option A — Initialiser le vrai projet**
> Créer le repo GitHub `focal-app`, mettre en place la structure Tauri + frontend, et commencer à coder le premier écran (vue Aujourd'hui).

**Option B — Approfondir le produit avant de coder**
> Trancher les questions ouvertes restantes (monétisation, onboarding, modèle IA local vs API) et valider le concept avec de vraies personnes TDAH avant de construire.

**Option C — Continuer le design UI**
> Affiner le mockup (layout, couleurs, interactions), créer la vue semaine en détail, designer l'onboarding.

Ma recommandation : commencer par **Option A** (initialiser le repo + structure Tauri) tout en gardant le design du mockup comme référence, puis revenir à Option B pour les interviews utilisateurs en parallèle.

---

## Questions ouvertes (non tranchées)

1. **Monétisation** : freemium (skills de base gratuits, skills premium) ? Abonnement mensuel ? B2C seul ou aussi B2B (employeurs, thérapeutes) ?
2. **Frontend dans Tauri** : React ou vanilla JS/HTML/CSS ?
3. **Timer focus** : inclure un Pomodoro adapté TDAH dans le MVP ou pas ?
4. **Modèle IA** : API externe uniquement ou prévoir un mode offline (modèle local) pour la confidentialité ?
5. **Onboarding** : comment calibrer le profil TDAH initial sans surcharger l'utilisateur dès le départ ?
6. **Skills communautaires** : validation, sécurité, curation — comment gérer ?

---

## Fichiers du projet (tous dans ce dossier)

| Fichier | Contenu |
|---|---|
| `2026-02-25 - Assistant IA TDAH.md` | Documentation complète : vision, MVP, features, stack, différenciateurs, roadmap |
| `saas-tdah-mockup.html` | Mockup UI interactif — ouvrir dans Chrome/Safari |
| `focal-reprise.md` | Ce fichier |

---

## Comment reprendre en une phrase

> "Je reprends le projet focal., un assistant IA desktop pour personnes TDAH. Le MVP est défini, le mockup UI est fait (saas-tdah-mockup.html). L'étape suivante est d'initialiser le repo Tauri et de commencer à coder. Aide-moi à continuer."

---

*Dernière mise à jour : 2026-02-25*
