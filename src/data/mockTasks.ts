import type { MicroStep, WeekDay } from "../types";

export const mockDecompositions: Record<string, MicroStep[]> = {
  "4": [
    { id: "4a-v2", text: "Collecter les métriques clés du sprint (vélocité, bugs)", done: false, estimatedMinutes: 10 },
    { id: "4b-v2", text: "Résumer les 3 livrables majeurs en une phrase chacun", done: false, estimatedMinutes: 10 },
    { id: "4c-v2", text: "Préparer 3 slides max : bilan, obstacles, plan d'action", done: false, estimatedMinutes: 25 },
  ],
  "5": [
    { id: "5a", text: "Lancer dbt test --select orders et noter l'erreur exacte", done: false, estimatedMinutes: 5 },
    { id: "5b", text: "Vérifier le modèle source dans target/run_results.json", done: false, estimatedMinutes: 10 },
    { id: "5c", text: "Identifier si c'est un problème de schéma ou de données amont", done: false, estimatedMinutes: 15 },
  ],
  "6": [
    { id: "6a", text: "Lister 5 frustrations TDAH que tu vis au quotidien", done: false, estimatedMinutes: 5 },
    { id: "6b", text: "Pour chaque frustration, noter une feature qui la résoudrait", done: false, estimatedMinutes: 8 },
    { id: "6c", text: "Classer par impact vs effort — garder le top 3", done: false, estimatedMinutes: 7 },
  ],
  "7": [
    { id: "7a", text: "Lister 5 questions ouvertes sur les habitudes de productivité", done: false, estimatedMinutes: 10 },
    { id: "7b", text: "Préparer 3 questions sur les outils utilisés actuellement", done: false, estimatedMinutes: 8 },
    { id: "7c", text: "Rédiger une intro de 2 lignes pour mettre à l'aise l'interviewé", done: false, estimatedMinutes: 5 },
  ],
};

export const mockStepDecompositions: Record<string, MicroStep[]> = {
  "4b": [
    { id: "4b1", text: "Relire les notes du dernier standup", done: false, estimatedMinutes: 5 },
    { id: "4b2", text: "Lister les tickets en retard ou bloqués", done: false, estimatedMinutes: 5 },
    { id: "4b3", text: "Choisir les 2 plus critiques à présenter", done: false, estimatedMinutes: 5 },
  ],
  "4c": [
    { id: "4c1", text: "Dupliquer le template de sprint review", done: false, estimatedMinutes: 3 },
    { id: "4c2", text: "Rédiger le slide bilan : livrables + métriques", done: false, estimatedMinutes: 8 },
    { id: "4c3", text: "Ajouter le slide risques et next steps", done: false, estimatedMinutes: 9 },
  ],
  "5a": [
    { id: "5a1", text: "Ouvrir le terminal et cd dans le projet dbt", done: false, estimatedMinutes: 1 },
    { id: "5a2", text: "Lancer dbt test --select orders", done: false, estimatedMinutes: 2 },
    { id: "5a3", text: "Copier le message d'erreur dans un fichier notes.md", done: false, estimatedMinutes: 2 },
  ],
  "6a": [
    { id: "6a1", text: "Timer 3 min : écrire tout ce qui te frustre", done: false, estimatedMinutes: 3 },
    { id: "6a2", text: "Garder les 5 frustrations les plus fréquentes", done: false, estimatedMinutes: 2 },
  ],
};

export const weekDays: WeekDay[] = [
  { name: "Lun", date: 23, isToday: false, taskSummary: "5 tâches", dots: ["done", "done", "done", "done", "done"] },
  { name: "Mar", date: 24, isToday: false, taskSummary: "4 tâches", dots: ["done", "done", "done", "pending"] },
  { name: "Mer", date: 25, isToday: true, taskSummary: "7 tâches · 3 faites", dots: ["done", "done", "done", "pending", "pending"] },
  { name: "Jeu", date: 26, isToday: false, taskSummary: "3 tâches", dots: ["empty", "empty", "empty"] },
  { name: "Ven", date: 27, isToday: false, taskSummary: "Sprint review", dots: ["empty", "empty"] },
];
