export const chatHints = [
  { label: "Décomposer une tâche", text: "Décompose cette tâche pour moi : " },
  { label: "Plan du jour", text: "/start-day" },
  { label: "Préparer la semaine", text: "/start-week" },
  { label: "Je suis bloqué", text: "Je suis bloqué sur..." },
];

export const slashCommands: { command: string; description: string }[] = [
  { command: "/help", description: "Affiche la liste des commandes disponibles" },
  { command: "/start-onboarding", description: "Lance le parcours d'onboarding" },
  { command: "/start-day", description: "Démarre la préparation de ta journée avec l'IA" },
  { command: "/start-week", description: "Démarre la préparation de ta semaine avec l'IA" },
  { command: "/start-period", description: "Démarre la préparation de ta période (prise de recul) avec l'IA" },
  { command: "/reset-period", description: "Réinitialise la préparation de la période en cours (debug)" },
  { command: "/clear", description: "Efface l'historique du chat" },
  { command: "/clear-db-tasks", description: "Supprime toutes les tâches de la base de données" },
  { command: "/clear-db-tasks-today", description: "Supprime les tâches d'aujourd'hui de la base de données" },
  { command: "/analyse-conversations", description: "Lance l'analyse comportementale des conversations" },
];
