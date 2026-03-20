# focal. — Roadmap MVP & Gaps identifiés

> Ce document est le résultat d'une session de réflexion (20 mars 2026) sur ce qui manque pour que focal. soit complet et prêt à être lancé en MVP.

---

## Contexte

David est **quasiment prêt à construire le MVP** pour le lancer. L'architecture est solide, les fonctionnalités principales sont implémentées. Il reste des gaps précis à combler, et des détails à tester/polir avant de pouvoir mettre l'app entre les mains d'utilisateurs réels.

Le **système de Skills** (différenciateur post-MVP) est volontairement mis de côté pour l'instant.

---

## Vision fonctionnelle (ce que focal. doit faire)

### 1. Préparation et revue du jour

Le flux complet doit fonctionner ainsi :

- **Le matin** : une notification cliquable est envoyée. Cliquer dessus ouvre l'app, positionne sur la vue Aujourd'hui, et lance automatiquement la préparation via le chat IA.
- **Dans la vue Aujourd'hui** : un bouton "Lancer la préparation" permet de démarrer le même process à tout moment.
- **Le soir** : une notification cliquable est envoyée. Cliquer dessus lance la revue du jour via le chat IA.
- **Dans la vue Aujourd'hui** : un bouton "Lancer la revue" permet de démarrer la revue à tout moment.
- **En fin de revue** : le chat propose de préparer le lendemain. Certains préfèrent préparer le soir, d'autres le matin — cette préférence doit être respectée.
- **Priorisation IA** : pendant la préparation, l'IA aide à définir les priorités du jour en se basant sur l'importance, l'urgence, et le contexte utilisateur (profil, charge, objectifs de la période).

**État actuel :** ✅ Tout ce flux est implémenté. La préférence matin/soir existe (`dayPrepPreference`). L'IA utilise une matrice urgence × importance pour prioriser.

---

### 2. Préparation et revue de la semaine

Même principe que le jour, avec en plus :

- L'IA lit le **Google Calendar** de la semaine et propose des tâches de préparation pour les réunions importantes.
- L'IA tient compte des **Directives** définies dans chaque intégration (règles et contexte libre configurables par l'utilisateur dans la vue Intégrations).
- La **revue de fin de semaine** est également guidée par le chat.

**Gmail n'est pas dans le scope** de la préparation semaine — Calendar suffit.

**État actuel :** ✅ Tout implémenté. Google Calendar est lu, les directives existent.

---

### 3. Prise de recul (vue Stratégie)

La vue Stratégie permet de faire un point sur une période (mensuelle, bimestrielle, trimestrielle, semestrielle) :

- Définir des caps à tenir (North Star)
- Poser des objectifs, stratégies, tactiques
- Voir le bilan de ce qui a été accompli
- Mener une réflexion sur la période écoulée et les engagements pour la suivante

**La préparation de période** (début de période) est assistée par l'IA via le chat — ✅ implémenté.

**La revue de période** (fin de période) doit être elle aussi guidée par le chat IA : l'IA pose des questions, challenge les réflexions, aide à formuler les insights, génère un bilan. Ce pattern est le même que pour la revue du jour.

**État actuel :** ❌ GAP — le bouton "Lancer la revue de la période" scrolle vers des `<textarea>` manuels. L'IA n'intervient pas dans cette phase.

**À faire :** Implémenter un mode `period_review` dans le chat, sur le même modèle que `daily_review`. L'IA doit :
- Prendre connaissance du bilan chiffré (tâches terminées, objectifs avancés, etc.)
- Poser des questions sur ce qui a bien fonctionné / ce qui a bloqué
- Challenger les réflexions et engagements formulés
- Générer un résumé de la période

---

### 4. Onboarding

L'onboarding doit guider l'utilisateur via le chat pour :

1. **Dresser son profil** : prénom, contexte principal (travail, projets perso...), rapport à la neurodivergence/TDAH, blocages récurrents — ✅ déjà implémenté.
2. **Configurer ses paramètres** : pendant la conversation, l'IA doit collecter et configurer automatiquement les préférences clés :
   - Préférence **matin ou soir** pour préparer sa journée du lendemain
   - **Jours travaillés** (pour les rappels/notifications)
   - **Nombre de priorités** par jour
3. À la fin du chat d'onboarding, les settings correspondants sont mis à jour automatiquement sans que l'utilisateur ait à aller dans les Réglages.

**État actuel :** ❌ GAP — l'onboarding collecte le profil mais ne collecte pas les préférences de paramétrage. L'utilisateur doit les configurer manuellement dans les Réglages.

**À faire :** Étendre le prompt d'onboarding pour collecter ces préférences de manière naturelle dans la conversation, et appeler les commandes de mise à jour des settings en fin d'onboarding (comme `updateSettings` avec `dayPrepPreference`, `workDays`, `maxPriorities`, etc.).

---

## Récapitulatif des gaps à combler avant MVP

| Priorité | Gap | Effort estimé |
|---|---|---|
| 🔴 Haute | **Revue de période guidée par l'IA** (mode `period_review` dans le chat) | Moyen |
| 🔴 Haute | **Onboarding collecte et configure les préférences** (matin/soir, jours travaillés, nb priorités) | Faible |
| 🟡 Moyenne | **Petits détails UX / bugs** à identifier pendant une session de test complète (flux jour → semaine → stratégie) | Variable |

---

## Ce qui est mis de côté (post-MVP)

- **Système de Skills** : modules de comportement activables (body double virtuel, détection de procrastination, mode focus Pomodoro adapté...) — différenciateur clé, mais volontairement hors scope MVP.
- **Suivi meetings & relations** : la 2e partie de la vision produit (comme Dex) — post-MVP assumé.
- **Intégration Microsoft** (Outlook Calendar / Outlook Mail) — connecteur non implémenté.
- **Extension browser** — post-MVP.
- **Mode offline / modèle IA local** — question ouverte non tranchée.

---

## Questions ouvertes

- **Monétisation** : probablement une approche hybride (freemium + hébergé), mais non tranchée définitivement. À décider avant le lancement.
- **Validation utilisateur** : des interviews avec de vrais utilisateurs TDAH sont nécessaires pour valider le "moment magique" (décomposition en micro-étapes) avant de scaler.

---

## Prochaines étapes recommandées

1. **Implémenter le mode `period_review`** dans le chat (revue de période guidée par l'IA).
2. **Étendre l'onboarding** pour collecter et appliquer les préférences de paramétrage.
3. **Session de test complète** : parcourir tous les flux (onboarding → jour → semaine → stratégie) et noter tous les détails qui ne fonctionnent pas comme attendu.
4. **Corriger les bugs/détails** remontés par la session de test.
5. **Trancher la monétisation** avant de préparer le lancement.

---

*Dernière mise à jour : 2026-03-20*
