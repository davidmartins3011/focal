import type { ThemeId, AIProviderId, NotificationReminder } from "../types";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  badge?: string;
  colors: { bg: string; accent: string; text: string; bg2: string };
}

export interface ProviderModelMeta {
  id: string;
  name: string;
}

export interface ProviderMeta {
  id: AIProviderId;
  name: string;
  models: ProviderModelMeta[];
  icon: string;
  iconBg: string;
  placeholder: string;
}

export const themes: ThemeOption[] = [
  {
    id: "default",
    name: "Défaut",
    description: "Sombre avec accents violets",
    colors: { bg: "#131316", accent: "#a78bfa", text: "#e8e4ee", bg2: "#1a1a1f" },
  },
  {
    id: "clair",
    name: "Clair",
    description: "Interface lumineuse et aérée",
    colors: { bg: "#f5f3f7", accent: "#7c5cbf", text: "#1e1a26", bg2: "#eae7ef" },
  },
  {
    id: "sombre",
    name: "Sombre",
    description: "Noir profond, contraste réduit",
    colors: { bg: "#09090b", accent: "#8b6fd8", text: "#d4d0dc", bg2: "#0f0f13" },
  },
  {
    id: "zen",
    name: "Zen",
    description: "Tons chauds et apaisants, faible stimulation",
    badge: "TDAH",
    colors: { bg: "#1c1917", accent: "#d4a574", text: "#e5ddd4", bg2: "#231f1c" },
  },
  {
    id: "hyperfocus",
    name: "Hyperfocus",
    description: "Contraste net, palette calme et structurée",
    badge: "TDAH",
    colors: { bg: "#0f1419", accent: "#34d399", text: "#e2e8f0", bg2: "#151c23" },
  },
  {
    id: "aurore",
    name: "Aurore",
    description: "Lever de soleil — corail et pêche sur crème",
    colors: { bg: "#fdf6f0", accent: "#e07850", text: "#2c1e14", bg2: "#f5ebe2" },
  },
  {
    id: "ocean",
    name: "Océan",
    description: "Bleu profond, cyan et reflets marins",
    colors: { bg: "#0a1628", accent: "#22d3ee", text: "#e0f2fe", bg2: "#0f1e34" },
  },
  {
    id: "sakura",
    name: "Sakura",
    description: "Rose pâle, doux et floral",
    colors: { bg: "#fdf2f8", accent: "#e45da0", text: "#2a1824", bg2: "#f5e6f0" },
  },
  {
    id: "nord",
    name: "Nord",
    description: "Bleu glacé nordique, net et épuré",
    colors: { bg: "#1a2030", accent: "#88c0d0", text: "#eceff4", bg2: "#212838" },
  },
  {
    id: "solaire",
    name: "Solaire",
    description: "Ambre et or sur blanc chaud",
    colors: { bg: "#fffdf5", accent: "#d97706", text: "#1c1408", bg2: "#faf5e8" },
  },
];

const weekdays: ("lun" | "mar" | "mer" | "jeu" | "ven")[] = ["lun", "mar", "mer", "jeu", "ven"];
const allDays: ("lun" | "mar" | "mer" | "jeu" | "ven" | "sam" | "dim")[] = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export const defaultReminders: NotificationReminder[] = [
  {
    id: "morning-plan",
    label: "Planification du matin",
    description: "Prépare ta journée en définissant tes priorités",
    time: "09:00",
    enabled: true,
    days: [...weekdays],
    icon: "🌅",
  },
  {
    id: "lunch-break",
    label: "Pause déjeuner",
    description: "Fais une vraie pause, tu l'as mérité",
    time: "12:30",
    enabled: false,
    days: [...allDays],
    icon: "🍽",
  },
  {
    id: "daily-review",
    label: "Revue du jour",
    description: "Fais le point sur ta journée et célèbre tes victoires",
    time: "18:00",
    enabled: true,
    days: [...weekdays],
    icon: "📝",
  },
  {
    id: "weekly-prep",
    label: "Préparation de la semaine",
    description: "Pose tes objectifs et répartis tes tâches pour la semaine",
    time: "09:00",
    enabled: true,
    days: ["lun"],
    icon: "📋",
    frequency: "weekly",
  },
  {
    id: "weekly-review",
    label: "Revue hebdomadaire",
    description: "Bilan de la semaine et préparation de la suivante",
    time: "10:00",
    enabled: true,
    days: ["dim"],
    icon: "📊",
    frequency: "weekly",
  },
  {
    id: "strategy-review",
    label: "Prise de recul",
    description: "Prends du recul sur tes piliers et ajuste tes priorités du mois",
    time: "10:00",
    enabled: true,
    days: ["dim"],
    icon: "🧭",
    frequency: "monthly",
    frequencyOccurrence: "last",
    frequencyCycleStart: 1,
  },
];

export const providers: ProviderMeta[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-5.4", name: "GPT-5.4" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
      { id: "gpt-5.4-nano", name: "GPT-5.4 Nano" },
    ],
    icon: "⬡",
    iconBg: "#10a37f",
    placeholder: "sk-proj-...",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
      { id: "claude-opus-4.6", name: "Claude Opus 4.6" },
      { id: "claude-haiku-4.5", name: "Claude Haiku 4.5" },
    ],
    icon: "△",
    iconBg: "#d97757",
    placeholder: "sk-ant-...",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    models: [
      { id: "mistral-large", name: "Mistral Large" },
      { id: "mistral-medium", name: "Mistral Medium" },
      { id: "codestral", name: "Codestral" },
    ],
    icon: "◆",
    iconBg: "#f24822",
    placeholder: "sk-...",
  },
];
