import type { Task, MicroStep, WeekDay } from "../types";

export const mockDecompositions: Record<string, MicroStep[]> = {
  "5": [
    { id: "5a", text: "Lancer dbt test --select orders et noter l'erreur exacte", done: false },
    { id: "5b", text: "Vérifier le modèle source dans target/run_results.json", done: false },
    { id: "5c", text: "Identifier si c'est un problème de schéma ou de données amont", done: false },
  ],
  "6": [
    { id: "6a", text: "Lister 5 frustrations TDAH que tu vis au quotidien", done: false },
    { id: "6b", text: "Pour chaque frustration, noter une feature qui la résoudrait", done: false },
    { id: "6c", text: "Classer par impact vs effort — garder le top 3", done: false },
  ],
  "7": [
    { id: "7a", text: "Lister 5 questions ouvertes sur les habitudes de productivité", done: false },
    { id: "7b", text: "Préparer 3 questions sur les outils utilisés actuellement", done: false },
    { id: "7c", text: "Rédiger une intro de 2 lignes pour mettre à l'aise l'interviewé", done: false },
  ],
};

export const initialTodayTasks: Task[] = [
  {
    id: "1",
    name: "Sync équipe Data — stand-up",
    done: true,
    tags: [{ label: "Roadmap", color: "roadmap" }],
  },
  {
    id: "2",
    name: "Revoir les specs du connecteur Salesforce",
    done: true,
    tags: [{ label: "CRM", color: "crm" }],
  },
  {
    id: "3",
    name: "Répondre aux emails du matin",
    done: true,
    tags: [],
  },
  {
    id: "4",
    name: "Préparer la revue de sprint vendredi",
    done: false,
    tags: [
      { label: "Roadmap", color: "roadmap" },
      { label: "Prioritaire", color: "urgent" },
    ],
    aiDecomposed: true,
    estimatedMinutes: 45,
    microSteps: [
      { id: "4a", text: "Lister les tickets fermés depuis le dernier sprint", done: true },
      { id: "4b", text: "Identifier les 2-3 points de blocage à mentionner", done: false },
      { id: "4c", text: "Préparer les slides (5 slides max)", done: false },
    ],
  },
  {
    id: "5",
    name: "Investiguer le bug pipeline dbt — table orders",
    done: false,
    tags: [{ label: "Data Platform", color: "data" }],
  },
  {
    id: "6",
    name: "Brainstorm idées SaaS TDAH — 20 min",
    done: false,
    tags: [{ label: "SaaS", color: "saas" }],
  },
  {
    id: "7",
    name: "Préparer questions pour entretien utilisateur TDAH",
    done: false,
    tags: [{ label: "SaaS", color: "saas" }],
  },
];

export const weekDays: WeekDay[] = [
  { name: "Lun", date: 23, isToday: false, taskSummary: "5 tâches", dots: ["done", "done", "done", "done", "done"] },
  { name: "Mar", date: 24, isToday: false, taskSummary: "4 tâches", dots: ["done", "done", "done", "pending"] },
  { name: "Mer", date: 25, isToday: true, taskSummary: "7 tâches · 3 faites", dots: ["done", "done", "done", "pending", "pending"] },
  { name: "Jeu", date: 26, isToday: false, taskSummary: "3 tâches", dots: ["empty", "empty", "empty"] },
  { name: "Ven", date: 27, isToday: false, taskSummary: "Sprint review", dots: ["empty", "empty"] },
];

export const weekPriorities: Task[] = [
  { id: "w1", name: "Finaliser la roadmap Q1 avec l'équipe", done: true, tags: [{ label: "Roadmap", color: "roadmap" }] },
  { id: "w2", name: "Livrer la revue de sprint vendredi", done: false, tags: [{ label: "Roadmap", color: "roadmap" }] },
  { id: "w3", name: "Corriger le bug pipeline dbt en prod", done: false, tags: [{ label: "Data Platform", color: "data" }] },
  { id: "w4", name: "Valider le concept SaaS TDAH avec 3 personnes", done: false, tags: [{ label: "SaaS", color: "saas" }] },
];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function buildCalendarMockTasks(): Record<string, Task[]> {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const map: Record<string, Task[]> = {};

  const add = (day: number, tasks: Task[]) => {
    map[toKey(new Date(y, m, day))] = tasks;
  };

  add(today.getDate(), [
    { id: "c1", name: "Finaliser wireframes page pricing", done: false, tags: [{ label: "SaaS", color: "saas" }] },
    { id: "c2", name: "Répondre au mail de Marc", done: true, tags: [{ label: "CRM", color: "crm" }] },
    { id: "c3", name: "Préparer le standup", done: false, tags: [{ label: "Roadmap", color: "roadmap" }] },
  ]);

  add(today.getDate() - 1, [
    { id: "c4", name: "Revue de code PR #42", done: true, tags: [{ label: "Data", color: "data" }] },
    { id: "c5", name: "Rédiger spec notifications", done: true, tags: [{ label: "SaaS", color: "saas" }] },
  ]);

  add(today.getDate() + 1, [
    { id: "c6", name: "Call client Neovision — 14h", done: false, tags: [{ label: "CRM", color: "crm" }] },
  ]);

  add(today.getDate() + 3, [
    { id: "c7", name: "Livraison MVP dashboard", done: false, tags: [{ label: "Roadmap", color: "roadmap" }, { label: "Urgent", color: "urgent" }] },
    { id: "c8", name: "Tests E2E module facturation", done: false, tags: [{ label: "SaaS", color: "saas" }] },
  ]);

  add(today.getDate() + 5, [
    { id: "c9", name: "Webinaire produit — 10h30", done: false, tags: [{ label: "SaaS", color: "saas" }] },
    { id: "c10", name: "Synchro data pipeline", done: false, tags: [{ label: "Data", color: "data" }] },
    { id: "c11", name: "Déjeuner équipe", done: false, tags: [] },
  ]);

  add(today.getDate() - 3, [
    { id: "c12", name: "Intégration API paiement", done: true, tags: [{ label: "SaaS", color: "saas" }] },
  ]);

  add(today.getDate() - 5, [
    { id: "c13", name: "Planifier sprint Q2", done: true, tags: [{ label: "Roadmap", color: "roadmap" }] },
    { id: "c14", name: "Mise à jour documentation", done: true, tags: [{ label: "Data", color: "data" }] },
  ]);

  return map;
}
