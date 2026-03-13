# Intégration IA

> L'IA est au cœur de Focal. Elle intervient dans le chat, la décomposition de tâches, les préparations (jour/semaine/période), l'onboarding, les suggestions et la mémoire comportementale.
> Toutes les requêtes IA passent par le backend Rust pour sécuriser les clés API.

---

## Providers supportés

| Provider | Modèles disponibles | Modèle par défaut | Endpoint | Header d'auth |
|----------|--------------------|--------------------|----------|----------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini` | `gpt-4o` | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer {key}` |
| Anthropic | `claude-4-opus`, `claude-4-sonnet` | `claude-sonnet-4-20250514` | `https://api.anthropic.com/v1/messages` | `x-api-key: {key}` + `anthropic-version: 2023-06-01` |
| Mistral | `mistral-large`, `mistral-medium`, `codestral` | `mistral-large-latest` | `https://api.mistral.ai/v1/chat/completions` | `Authorization: Bearer {key}` |

L'utilisateur choisit un modèle spécifique dans le dropdown du ChatPanel. `resolve_api_model()` convertit l'ID frontend en ID d'API (ex : `claude-4-sonnet` → `claude-sonnet-4-20250514`).

OpenAI et Mistral utilisent le même format d'API (OpenAI-compatible), gérés par `call_openai_compatible()`.
Anthropic a son propre format, géré par `call_anthropic()`.

---

## Sélection du provider et du modèle

La logique est dans `get_active_provider()` qui retourne `(ProviderConfig, String)` (provider + model ID résolu) :

1. Lit le setting `ai-settings` (JSON)
2. Filtre les providers `enabled` avec une `apiKey` non vide
3. Si un `selectedModel` est spécifié, déduit le provider correspondant et résout l'ID API via `resolve_api_model()`
4. Sinon, prend le premier provider disponible avec son modèle par défaut
5. Si aucun n'est configuré, retourne une erreur explicite

### Configuration côté frontend

- **SettingsView** : active/désactive les providers, saisit les clés API, valide les clés via `validate_api_key()`
- **ChatPanel** : dropdown de sélection du modèle parmi ceux des providers activés
- Les clés API sont conservées même quand le provider est désactivé
- Le setting `ai-settings` est un JSON :

```json
{
  "providers": [
    { "id": "openai", "enabled": true, "apiKey": "sk-proj-..." },
    { "id": "anthropic", "enabled": false, "apiKey": "sk-ant-..." },
    { "id": "mistral", "enabled": false, "apiKey": "" }
  ],
  "selectedModel": "gpt-4o"
}
```

---

## System prompt

Le system prompt est construit dynamiquement par `build_system_prompt()` et inclut :

1. **Identité** : "Tu es l'assistant IA de focal., une application d'aide à la productivité pour les personnes TDAH."
2. **Personnalité** : Bienveillant, concret, orienté action, tutoiement, pas de morale
3. **Profil utilisateur** (si renseigné) : prénom, activité, TDAH, blocages
4. **Mémoire IA** : insights comportementaux issus de `ai_memory_insights` (priorisation, rythme de travail, organisation, blocages, etc.)
5. **Tâches du jour** : liste des tâches today avec leur état (✓/○), priorité, et ID court
6. **Tâches de la semaine** : liste des tâches week
7. **Boîte de réception** : liste des tâches inbox
8. **Actions disponibles** : l'IA peut proposer des modifications de tâches via des champs JSON structurés
9. **Périmètre strict** : règles détaillées sur ce que l'IA fait et ne fait pas

### Format de réponse JSON

```json
{
  "content": "ton message texte",
  "steps": ["étape 1", "étape 2"],
  "tasksToAdd": [{"name": "...", "estimatedMinutes": 15, "priority": "main"}],
  "tasksToRemove": ["id-court"],
  "tasksToUpdate": [{"id": "id-court", "name": "...", "priority": "secondary"}],
  "tasksToToggle": ["id-court"],
  "tasksToReorder": ["id1", "id2", "id3"],
  "tagsToSet": [{"taskId": "id-court", "tags": [{"label": "...", "color": "..."}]}],
  "stepsToSet": [{"taskId": "id-court", "steps": ["étape 1", "étape 2"]}]
}
```

Tous les champs sauf `content` sont optionnels. Les IDs courts utilisés dans le prompt sont résolus en vrais UUIDs par `id_map` côté backend.

---

## Commande `send_message`

Flux complet du chat :

```
Frontend                    Backend (Rust)                   LLM API
────────                    ──────────────                   ───────
ChatPanel.tsx
  │
  ├─ sendMessage(text) ───► ai.rs::send_message()
  │                            │
  │                            ├─ Sauvegarde le message user en DB
  │                            ├─ get_active_provider()
  │                            ├─ build_system_prompt()
  │                            ├─ Charge tous les messages du chat
  │                            ├─ call_llm() ──────────────► API call
  │                            │                              │
  │                            │ ◄──────────── réponse JSON ──┘
  │                            ├─ parse_ai_text() → AiResponse
  │                            ├─ Exécute les actions (add/remove/update/toggle/reorder tasks)
  │                            ├─ Sauvegarde le message AI en DB (+ steps)
  │                            │
  │ ◄── AiResponse ───────────┘
  │
  ├─ Affiche content
  ├─ Si steps, affichage progressif + bouton "Ajouter à une tâche"
  └─ Si actions (tasksToAdd, etc.), rafraîchit les vues
```

### AiResponse

```rust
struct AiResponse {
    content: String,
    steps: Option<Vec<String>>,
    tasks_to_add: Option<Vec<TaskToAdd>>,
    tasks_to_remove: Option<Vec<String>>,
    tasks_to_update: Option<Vec<TaskUpdate>>,
    tasks_to_toggle: Option<Vec<String>>,
    tasks_to_reorder: Option<Vec<String>>,
    tags_to_set: Option<Vec<TagAction>>,
    steps_to_set: Option<Vec<StepsAction>>,
}
```

---

## Commande `decompose_task`

Décomposition d'une tâche en micro-étapes :

```
Frontend                       Backend (Rust)                   LLM API
────────                       ──────────────                   ───────
TodayView.tsx
  │
  ├─ decomposeTask(name) ───► ai.rs::decompose_task()
  │                              │
  │                              ├─ get_active_provider()
  │                              ├─ Construit un system prompt spécifique :
  │                              │    "Décompose en 3-5 micro-étapes"
  │                              │    "Format JSON : [{text, estimatedMinutes}]"
  │                              ├─ call_llm() ──────────────────► API call
  │                              │                                  │
  │                              │ ◄──────────────── JSON array ───┘
  │                              ├─ Parse en Vec<DecompStep>
  │                              │
  │ ◄── Vec<DecompStep> ────────┘
  │
  ├─ Convertit en MicroStep[]
  ├─ Met à jour l'état local
  └─ setMicroSteps(taskId, steps) ──► Persiste en DB
```

### System prompt de décomposition

```
Tu es un assistant spécialisé dans la décomposition de tâches pour les personnes TDAH.
Ton rôle est de découper une tâche en 3 à 5 micro-étapes concrètes et actionnables.
Chaque étape doit être suffisamment petite pour être commencée immédiatement.

Réponds en JSON valide avec cette structure exacte :
[{"text": "description de l'étape", "estimatedMinutes": 5}, ...]

Le champ estimatedMinutes est optionnel mais recommandé.
```

Si un `context` est fourni (ex: pour décomposer une sous-étape), il est ajouté au prompt.

### DecompStep

```rust
struct DecompStep {
    text: String,
    estimated_minutes: Option<i32>,
}
```

---

## Commandes de préparation

### `send_daily_prep_message`

Échange conversationnel pour préparer la journée. L'IA reçoit les tâches actuelles et peut proposer des ajouts/modifications/suppressions.

### `send_weekly_prep_message`

Même logique pour la préparation de la semaine.

### `send_period_prep_message`

Préparation d'une période stratégique. Reçoit en plus le `period_id` pour contextualiser.

Toutes ces commandes retournent un `DailyPrepResponse` qui contient `content` + actions sur les tâches + `prepComplete` (booléen pour savoir si la préparation est terminée).

---

## Onboarding IA

### `send_onboarding_message`

Échange conversationnel pour construire le profil utilisateur. Reçoit le `currentProfile` et retourne un `OnboardingResponse` contenant :
- `content` : message affiché à l'utilisateur
- `profileUpdates` : champs de profil à mettre à jour
- `onboardingComplete` : `true` quand l'onboarding est terminé

### `analyze_profile_url`

Analyse une URL de profil public (LinkedIn, site web) pour enrichir le profil. Retourne un résumé textuel.

---

## Validation des clés API

### `validate_api_key`

Teste une clé API en envoyant une requête minimale au provider. Retourne `true` si la clé est valide.

---

## Suggestions IA

### `generate_suggestions`

Génère des suggestions de productivité basées sur le profil, les tâches et la mémoire IA. Retourne `Vec<Suggestion>` avec impact, catégorie et confiance.

---

## Mémoire IA

La mémoire IA analyse les conversations via LLM pour construire un profil organisationnel cumulatif. Les insights sont stockés dans `ai_memory_insights` et injectés dans le system prompt.

Catégories d'insights : priorisation, rythme de travail, organisation, blocages, communication, énergie, etc.

`check_and_run_analysis()` est appelé au démarrage de l'app et analyse les conversations des derniers jours si aucune analyse n'a été faite récemment.

---

## Parsing des réponses

`parse_ai_text(raw)` gère deux cas :

1. **JSON valide** : extrait `content`, `steps`, et toutes les actions sur les tâches (`tasks_to_add`, `tasks_to_remove`, `tasks_to_update`, `tasks_to_toggle`, `tasks_to_reorder`, `tags_to_set`, `steps_to_set`)
2. **Texte brut** : utilise le texte tel quel comme `content`, pas de `steps` ni d'actions

Cette tolérance évite les crashs si le LLM ne respecte pas le format demandé.

Un `id_map` (construit à partir du system prompt) résout les IDs courts (ex: `T1`, `T2`) en vrais UUIDs pour les actions.

---

## Gestion des erreurs

- Si aucun provider n'est configuré : message d'erreur explicite en français
- Si l'API retourne une erreur : le message est affiché dans un `errorBanner` dans le chat
- Les erreurs réseau (timeout, DNS) sont aussi capturées et affichées

---

## Points d'attention pour l'IA qui code

1. **Clés API en backend uniquement** : jamais exposées côté frontend
2. **Un seul modèle utilisé par requête** : déterminé par `selectedModel` dans les settings
3. **Le system prompt est dynamique** : il change selon le profil, les tâches du jour/semaine/inbox et la mémoire IA
4. **Les messages sont persistés** : l'historique est stocké en SQLite
5. **La décomposition est séparée du chat** : `decompose_task` a son propre prompt optimisé
6. **Les micro-étapes sont persistées** : après décomposition, elles sont sauvées via `set_micro_steps`
7. **Pas de streaming** : les réponses sont reçues en bloc (pas de SSE)
8. **L'IA peut agir sur les tâches** : le chat peut ajouter, supprimer, modifier, cocher et réordonner des tâches
9. **Les préparations sont conversationnelles** : jour/semaine/période utilisent un historique d'échange dédié
10. **La mémoire est cumulative** : les insights sont enrichis à chaque analyse
