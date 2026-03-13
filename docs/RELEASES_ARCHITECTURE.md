# Architecture des releases et mises à jour

## Vue d'ensemble

focal utilise **GitHub Releases** comme plateforme de distribution et le plugin **tauri-plugin-updater** pour les mises à jour in-app. Quand une nouvelle version est publiée, les utilisateurs voient une popup dans l'application leur proposant de mettre à jour. Le build et la publication sont automatisés via GitHub Actions.

```
Développeur                    GitHub Actions                GitHub Releases              Utilisateur
    │                               │                              │                          │
    │  git tag v0.2.0 + push        │                              │                          │
    │──────────────────────────────►│                              │                          │
    │                               │  Build macOS (ARM + Intel)   │                          │
    │                               │  Build Windows               │                          │
    │                               │  Signe les binaires          │                          │
    │                               │─────────────────────────────►│                          │
    │                               │  Upload .dmg, .exe,          │                          │
    │                               │  latest.json, .sig            │                          │
    │                               │                              │                          │
    │  Publie le draft              │                              │                          │
    │─────────────────────────────────────────────────────────────►│                          │
    │                               │                              │  check() au démarrage    │
    │                               │                              │◄─────────────────────────│
    │                               │                              │  latest.json → v0.2.0    │
    │                               │                              │─────────────────────────►│
    │                               │                              │                          │ Popup "Mise à jour"
    │                               │                              │  downloadAndInstall()    │
    │                               │                              │◄─────────────────────────│
    │                               │                              │  Binaire signé           │
    │                               │                              │─────────────────────────►│
    │                               │                              │                          │ Redémarrage
```

---

## Versioning

### Convention : Semantic Versioning (SemVer)

Le projet suit le format `MAJOR.MINOR.PATCH` :

| Segment | Quand l'incrémenter | Exemple |
|---------|---------------------|---------|
| **MAJOR** | Changement cassant, refonte majeure | `1.0.0` → `2.0.0` |
| **MINOR** | Nouvelle fonctionnalité, rétro-compatible | `0.1.0` → `0.2.0` |
| **PATCH** | Correction de bug, ajustement mineur | `0.2.0` → `0.2.1` |

### Fichiers contenant la version

La version doit être synchronisée dans **3 fichiers** :

| Fichier | Champ | Rôle |
|---------|-------|------|
| `package.json` | `"version": "0.1.0"` | Version npm, utilisée par le frontend |
| `src-tauri/tauri.conf.json` | `"version": "0.1.0"` | Version de l'application Tauri — c'est la **source de vérité** pour le système de mise à jour |
| `src-tauri/Cargo.toml` | `version = "0.1.0"` | Version du crate Rust |

**Important :** les trois doivent toujours être identiques. C'est `tauri.conf.json` qui est utilisé par le plugin updater pour comparer les versions.

---

## Anatomie du système de mise à jour

### Plugins Rust (backend)

Fichier : `src-tauri/Cargo.toml`

```toml
tauri-plugin-updater = "2"    # Vérifie, télécharge et installe les mises à jour
tauri-plugin-process = "2"    # Permet le redémarrage de l'app après installation
```

Fichier : `src-tauri/src/lib.rs`

Les plugins sont enregistrés dans le builder Tauri :

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```

### Permissions (capabilities)

Fichier : `src-tauri/capabilities/default.json`

```json
"permissions": [
    "core:default",
    "shell:allow-open",
    "notification:default",
    "updater:default",
    "process:allow-restart"
]
```

- `core:default` autorise les fonctionnalités de base Tauri.
- `shell:allow-open` autorise l'ouverture de liens dans le navigateur.
- `notification:default` autorise l'envoi de notifications natives OS.
- `updater:default` autorise le frontend à vérifier et télécharger les mises à jour.
- `process:allow-restart` autorise le frontend à redémarrer l'application.

### Configuration de l'updater

Fichier : `src-tauri/tauri.conf.json`

```json
"bundle": {
    "createUpdaterArtifacts": true
},
"plugins": {
    "updater": {
        "pubkey": "YOUR_UPDATER_PUBKEY_HERE",
        "endpoints": [
            "https://github.com/davidmartins3011/focal/releases/latest/download/latest.json"
        ]
    }
}
```

- **`createUpdaterArtifacts`** : lors du build, Tauri génère un fichier `latest.json` et des fichiers `.sig` (signatures) en plus des installateurs normaux.
- **`pubkey`** : clé publique utilisée pour vérifier l'authenticité des mises à jour. L'app refuse toute mise à jour dont la signature ne correspond pas.
- **`endpoints`** : URL(s) où l'app vérifie si une nouvelle version existe. Pointe vers `latest.json` dans la dernière GitHub Release.

### Packages JavaScript (frontend)

Fichier : `package.json`

```json
"@tauri-apps/plugin-updater": "^2.10.0"   // API JS : check(), downloadAndInstall()
"@tauri-apps/plugin-process": "^2.3.1"    // API JS : relaunch()
```

### Composant de notification

Fichier : `src/components/UpdateNotification.tsx`

Ce composant React gère l'expérience utilisateur de la mise à jour :

**Cycle de vie :**

1. **Au montage** : appelle `check()` qui interroge l'endpoint `latest.json`
2. **Toutes les 4 heures** : re-vérifie automatiquement (constante `CHECK_INTERVAL_MS` dans le composant), pour couvrir le cas où l'utilisateur ne redémarre jamais l'app
3. **Si une mise à jour existe** : affiche la popup (phase `available`)
4. **L'utilisateur clique "Mettre à jour"** : passe en phase `downloading`, avec une barre de progression
5. **Téléchargement terminé** : passe en phase `ready`, propose "Redémarrer maintenant"
6. **Redémarrage** : appelle `relaunch()` qui ferme et relance l'app avec la nouvelle version

Si l'utilisateur clique "Plus tard", la popup disparaît mais réapparaîtra au prochain check périodique (4h) si une mise à jour est toujours disponible.

**Phases du composant :**

| Phase | Ce qui est affiché | Actions possibles |
|-------|--------------------|-------------------|
| `available` | "Mise à jour disponible — Version X.Y.Z" | Mettre à jour / Plus tard |
| `downloading` | Barre de progression + pourcentage | — |
| `ready` | "Mise à jour prête" | Redémarrer maintenant |
| `error` | Message d'erreur | Réessayer |

Le composant est monté dans `App.tsx` et apparaît en **position fixe en bas à gauche** de l'écran.

---

## CI/CD : le workflow de release

Fichier : `.github/workflows/release.yml`

### Déclenchement

Le workflow se déclenche quand un **tag git** commençant par `v` est poussé :

```yaml
on:
  push:
    tags:
      - "v*"
```

### Matrice de build

Trois builds s'exécutent en parallèle :

| Plateforme | Target | Artefacts produits |
|------------|--------|--------------------|
| `macos-latest` | `aarch64-apple-darwin` | `.dmg` (Apple Silicon) |
| `macos-latest` | `x86_64-apple-darwin` | `.dmg` (Intel) |
| `windows-latest` | (défaut) | `.msi`, `.exe` (NSIS) |

### Ce que fait `tauri-apps/tauri-action`

1. Exécute `npm run tauri build` avec les arguments de la matrice
2. Signe les artefacts de mise à jour avec `TAURI_SIGNING_PRIVATE_KEY`
3. Génère `latest.json` (le manifeste que l'updater consulte)
4. Upload tous les fichiers dans une **GitHub Release en draft**

### Secrets GitHub nécessaires

| Secret | Description |
|--------|-------------|
| `GITHUB_TOKEN` | Fourni automatiquement par GitHub Actions |
| `TAURI_SIGNING_PRIVATE_KEY` | Clé privée pour signer les mises à jour |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Mot de passe de la clé privée |

Ces secrets doivent être configurés en tant que **Repository secrets** (et non Environment secrets) :
GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**.

---

## Fichier `latest.json`

C'est le fichier central du système de mise à jour. Il est généré automatiquement par `tauri-apps/tauri-action` et uploadé dans chaque GitHub Release.

Structure type :

```json
{
  "version": "0.2.0",
  "notes": "Release notes ici",
  "pub_date": "2026-03-13T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://github.com/davidmartins3011/focal/releases/download/v0.2.0/focal.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "...",
      "url": "https://github.com/davidmartins3011/focal/releases/download/v0.2.0/focal.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/davidmartins3011/focal/releases/download/v0.2.0/focal_0.2.0_x64-setup.nsis.zip"
    }
  }
}
```

L'updater compare `latest.json.version` avec la version dans `tauri.conf.json`. Si `latest.json` est plus récent → mise à jour disponible.

---

## Sécurité : signature des mises à jour

Les mises à jour sont signées avec un système de clé asymétrique (Ed25519) :

- **Clé privée** : connue uniquement du CI (stockée en secret GitHub). Utilisée pour signer les binaires lors du build.
- **Clé publique** : embarquée dans l'application (`pubkey` dans `tauri.conf.json`). Utilisée pour vérifier que la mise à jour provient bien du développeur.

Si un attaquant modifie le binaire ou le `latest.json`, la vérification de signature échouera et l'app refusera la mise à jour.

### Générer les clés

```bash
npm run tauri signer generate -- -w ~/.tauri/focal.key
```

Cela produit :
- `~/.tauri/focal.key` → clé privée (à mettre dans les secrets GitHub)
- `~/.tauri/focal.key.pub` → clé publique (à copier dans `tauri.conf.json` → `plugins.updater.pubkey`)

---

## Procédure de release pas à pas

### Prérequis (première release uniquement)

1. Générer les clés de signature :
```bash
npm run tauri signer generate -- -w ~/.tauri/focal.key
```

2. Copier la clé publique (`~/.tauri/focal.key.pub`) dans `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` (remplacer `YOUR_UPDATER_PUBKEY_HERE`).

3. Ajouter les **Repository secrets** sur GitHub (Settings → Secrets and variables → Actions → New repository secret) :
   - `TAURI_SIGNING_PRIVATE_KEY` : contenu de `~/.tauri/focal.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` : mot de passe choisi à la génération

### 1. Vérifier la clé publique

S'assurer que `plugins.updater.pubkey` dans `src-tauri/tauri.conf.json` contient bien la vraie clé publique (pas le placeholder).

```bash
cat ~/.tauri/focal.key.pub
```

### 2. Mettre à jour la version

Modifier la version dans les **3 fichiers** (ils doivent toujours être synchronisés) :
- `package.json` → `"version": "0.2.0"`
- `src-tauri/tauri.conf.json` → `"version": "0.2.0"`
- `src-tauri/Cargo.toml` → `version = "0.2.0"`

Vérifier la synchronisation :
```bash
grep '"version"' package.json
grep '"version"' src-tauri/tauri.conf.json
grep '^version' src-tauri/Cargo.toml
```

### 3. Commiter et taguer

```bash
git add -A
git status                          # vérifier que tout est propre
git commit -m "release: v0.2.0"
git tag v0.2.0
git push origin main --tags         # le --tags déclenche le workflow
```

### 4. Suivre le build

Le workflow GitHub Actions se déclenche automatiquement.
Suivre l'avancement sur : **https://github.com/davidmartins3011/focal/actions**

3 jobs tournent en parallèle (macOS ARM, macOS Intel, Windows). Durée typique : 10-20 minutes.
En cas d'échec, cliquer sur le job pour voir les logs détaillés.

### 5. Publier la release

Le workflow crée une **Release en draft**. Aller sur :
**https://github.com/davidmartins3011/focal/releases**

Vérifier que tous les artefacts sont présents (.dmg, .exe, .msi, latest.json, fichiers .sig), éditer les notes de release si besoin, puis cliquer **Publish release**.

### 6. Vérification

Après publication, vérifier que ce lien retourne un JSON valide :
**https://github.com/davidmartins3011/focal/releases/latest/download/latest.json**

C'est ce fichier que l'app consulte pour savoir si une mise à jour est disponible.
Les utilisateurs sur l'ancienne version verront la popup de mise à jour au prochain lancement de l'app ou dans les 4 heures si l'app est déjà ouverte.

---

## Distribution via un site web

Les liens de téléchargement sur un site web peuvent pointer directement vers les artefacts GitHub Releases :

```
https://github.com/davidmartins3011/focal/releases/latest
```

Pour des liens dynamiques (qui pointent toujours vers la dernière version), utiliser l'API GitHub :

```javascript
const res = await fetch(
    "https://api.github.com/repos/davidmartins3011/focal/releases/latest"
);
const release = await res.json();
const dmg = release.assets.find(a => a.name.endsWith(".dmg"));
const exe = release.assets.find(a => a.name.endsWith("-setup.exe"));
```

---

## Signature et notarisation macOS (Apple Developer)

### Situation actuelle

L'app n'est **pas signée** avec un certificat Apple Developer. Conséquence : macOS Gatekeeper affiche le message « focal est endommagé et ne peut pas être ouvert » quand un utilisateur tente de l'ouvrir après téléchargement.

**Contournement temporaire pour les utilisateurs :**

1. Clic droit sur l'app → **Ouvrir** (au lieu de double-clic). Une alerte apparaît avec un bouton "Ouvrir" → cliquer dessus. Ne sera demandé qu'une fois.
2. Ou via le terminal : `xattr -cr /Applications/focal.app`

### Pour supprimer ce problème définitivement

Il faut un **Apple Developer Program** (99$/an) : https://developer.apple.com/programs/

Cela donne accès à :
- **Code Signing** : un certificat `Developer ID Application` qui signe l'app pour que macOS la reconnaisse comme sûre
- **Notarisation** : Apple scanne le binaire et délivre un "ticket" qui supprime totalement l'alerte Gatekeeper

### Configuration dans le workflow GitHub Actions

Le workflow `release.yml` peut être mis à jour pour signer et notariser automatiquement. Il faudra :

1. Exporter le certificat Developer ID en `.p12` depuis Keychain Access
2. Ajouter ces **Repository secrets** sur GitHub :
   - `APPLE_CERTIFICATE` : certificat `.p12` encodé en base64
   - `APPLE_CERTIFICATE_PASSWORD` : mot de passe du `.p12`
   - `APPLE_ID` : email du compte Apple Developer
   - `APPLE_PASSWORD` : mot de passe spécifique à l'app (généré sur appleid.apple.com)
   - `APPLE_TEAM_ID` : identifiant de l'équipe Apple Developer
3. `tauri-apps/tauri-action` supporte nativement ces variables d'environnement pour la signature et notarisation macOS

**TODO :** souscrire à l'Apple Developer Program et configurer la signature quand le projet sera prêt pour une distribution grand public.

---

## Arborescence des fichiers impliqués

```
focal/
├── package.json                          ← version npm
├── src-tauri/
│   ├── Cargo.toml                        ← version Rust + plugins updater/process
│   ├── tauri.conf.json                   ← version app + config updater (pubkey, endpoints)
│   ├── capabilities/
│   │   └── default.json                  ← permissions updater:default, process:allow-restart
│   └── src/
│       └── lib.rs                        ← enregistrement des plugins Rust
├── src/
│   ├── App.tsx                           ← monte <UpdateNotification />
│   └── components/
│       ├── UpdateNotification.tsx         ← logique et UI de la popup de mise à jour
│       └── UpdateNotification.module.css  ← styles de la popup
└── .github/
    └── workflows/
        └── release.yml                   ← CI/CD : build + sign + publish
```
