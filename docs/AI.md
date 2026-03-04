# Intégration IA

> L'IA est au cœur de Focal. Elle intervient dans le chat et dans la décomposition de tâches.
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

- **SettingsView** : active/désactive les providers et saisit les clés API
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
3. **Format de réponse** : JSON obligatoire

```json
{
  "content": "ton message texte",
  "steps": ["étape 1", "étape 2"]  // optionnel
}
```

4. **Profil utilisateur** (si renseigné) : prénom, activité, TDAH, blocages
5. **Tâches du jour** : liste des tâches today avec leur état (✓/○) et priorité

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
  │                            ├─ Charge les 20 derniers messages du chat
  │                            ├─ call_llm() ──────────────► API call
  │                            │                              │
  │                            │ ◄──────────── réponse JSON ──┘
  │                            ├─ parse_ai_text() → AiResponse
  │                            ├─ Sauvegarde le message AI en DB (+ steps)
  │                            │
  │ ◄── AiResponse ───────────┘
  │
  ├─ Affiche content
  └─ Si steps, affichage progressif + bouton "Ajouter à une tâche"
```

### AiResponse

```rust
struct AiResponse {
    content: String,
    steps: Option<Vec<String>>,
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
  │                              │    "Décompose en 3-7 micro-étapes"
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
Décompose la tâche suivante en 3 à 7 micro-étapes claires et actionnables.
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

## Ajout des étapes à une tâche (ChatPanel)

Quand le chat retourne des `steps`, un bouton "Ajouter ces étapes à la tâche" apparaît.
En cliquant, l'utilisateur voit la liste des tâches du jour et peut choisir une cible.

```
ChatPanel.tsx
  │
  ├─ getTasks("today") ──► Charge les tâches actives
  │
  ├─ Utilisateur clique sur une tâche
  │
  └─ setMicroSteps(taskId, steps) ──► Persiste en DB
```

---

## Parsing des réponses

`parse_ai_text(raw)` gère deux cas :

1. **JSON valide** : extrait `content` et `steps` de la réponse structurée
2. **Texte brut** : utilise le texte tel quel comme `content`, pas de `steps`

Cette tolérance évite les crashs si le LLM ne respecte pas le format demandé.

---

## Gestion des erreurs

- Si aucun provider n'est configuré : message d'erreur explicite en français
- Si l'API retourne une erreur : le message est affiché dans un `errorBanner` dans le chat
- Les erreurs réseau (timeout, DNS) sont aussi capturées et affichées

---

## Points d'attention pour l'IA qui code

1. **Clés API en backend uniquement** : jamais exposées côté frontend
2. **Un seul modèle utilisé par requête** : déterminé par `selectedModel` dans les settings
3. **Le system prompt est dynamique** : il change selon le profil et les tâches du jour
4. **Les messages sont persistés** : l'historique est stocké en SQLite
5. **La décomposition est séparée du chat** : `decompose_task` a son propre prompt optimisé
6. **Les micro-étapes sont persistées** : après décomposition, elles sont sauvées via `set_micro_steps`
7. **Pas de streaming** : les réponses sont reçues en bloc (pas de SSE)
