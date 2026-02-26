import type { ChatMessage } from "../types";

export const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "ai",
    content:
      "Bonjour David 👋 Tu as 7 tâches aujourd'hui et une revue de sprint vendredi. Je te suggère de commencer par la préparer — il te reste 2 étapes.\n\nComment je peux t'aider ?",
  },
  {
    id: "2",
    role: "user",
    content:
      "J'ai besoin de déboguer le bug pipeline dbt sur la table orders. Je sais pas par où commencer.",
  },
  {
    id: "3",
    role: "ai",
    content: "Pas de panique. Je découpe ça :",
    steps: [
      { text: "Lancer <code>dbt test --select orders</code> et noter l'erreur exacte" },
      { text: "Vérifier les logs dans <code>target/run_results.json</code>" },
      { text: "Identifier si l'erreur vient du modèle source ou d'une transformation en aval" },
      { text: "Colle-moi l'erreur ici — je t'aide à la résoudre" },
    ],
  },
  {
    id: "4",
    role: "user",
    content:
      "Prépare-moi aussi ma revue de fin de journée. J'ai du mal à bien terminer mes journées.",
  },
  {
    id: "5",
    role: "ai",
    content:
      "Bonne initiative. Ce soir à 17h30 je te propose une revue de 10 minutes : ce que tu as fait, ce qui reste, et ton top 3 pour demain.\n\nTu veux que je l'active en mode <strong>proactif</strong> (je t'envoie un rappel) ou tu le lances toi-même ?",
  },
];

export const decompositionReplies = [
  {
    content: "Je découpe ça en étapes claires :",
    steps: [
      { text: "Identifier l'objectif précis — qu'est-ce qui est « fini » ?" },
      { text: "Lister les 2-3 blocages potentiels avant de commencer" },
      { text: "Faire la première micro-action (< 5 min) pour créer du momentum" },
    ],
  },
  {
    content: "Voilà comment je structurerais ça :",
    steps: [
      { text: "Rassembler les infos nécessaires (docs, contacts, données)" },
      { text: "Définir le livrable minimal — juste l'essentiel" },
      { text: "Bloquer 25 min focus dans ton calendrier pour l'exécuter" },
    ],
  },
  {
    content: "Pas de panique, on découpe :",
    steps: [
      { text: "Écrire en une phrase ce que tu veux accomplir" },
      { text: "Trouver la toute première action concrète (ouvrir un fichier, envoyer un message...)" },
      { text: "La faire maintenant — le reste viendra" },
    ],
  },
];

export const genericReplies = [
  "Pas de panique. Commence par la partie la plus petite, celle que tu peux faire en moins de 5 minutes.",
  "Je note ça. Veux-tu que je le décompose en étapes actionnables ?",
  "Bonne question. Donne-moi un peu plus de contexte et je t'aide à débloquer ça.",
  "Noté ! Je l'ajoute à ta liste et je te rappellerai ce soir lors de ta revue.",
  "Tu sembles bloqué. Dis-moi la toute première micro-étape que tu peux faire maintenant, même petite.",
];

export const chatHints = [
  { label: "Décomposer une tâche", text: "Décompose cette tâche pour moi : " },
  { label: "Plan du jour", text: "Plan du jour" },
  { label: "Je suis bloqué", text: "Je suis bloqué sur..." },
  { label: "Revue du soir", text: "Lance ma revue du soir" },
];
