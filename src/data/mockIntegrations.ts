import type { Integration } from "../types";

const emptyContext = { rules: [], extraContext: "" };

export const defaultIntegrations: Integration[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Synchronise tes événements et bloque du temps pour tes tâches.",
    icon: "📅",
    connected: false,
    category: "calendar",
    context: { ...emptyContext },
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    description: "Connecte ton agenda Outlook pour voir tes créneaux disponibles.",
    icon: "🗓",
    connected: false,
    category: "calendar",
    context: { ...emptyContext },
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Transforme tes emails importants en tâches automatiquement.",
    icon: "✉️",
    connected: false,
    category: "email",
    context: { ...emptyContext },
  },
  {
    id: "outlook-mail",
    name: "Outlook Mail",
    description: "Connecte ta boîte Outlook pour capturer les actions à faire.",
    icon: "📧",
    connected: false,
    category: "email",
    context: { ...emptyContext },
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Synchronise tes deals, contacts et tâches CRM.",
    icon: "🟠",
    connected: false,
    category: "crm",
    context: { ...emptyContext },
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Importe tes opportunités et activités Salesforce.",
    icon: "☁️",
    connected: false,
    category: "crm",
    context: { ...emptyContext },
  },
  {
    id: "slack",
    name: "Slack",
    description: "Reçois des rappels et crée des tâches depuis Slack.",
    icon: "💬",
    connected: false,
    category: "messaging",
    context: { ...emptyContext },
  },
  {
    id: "notion",
    name: "Notion",
    description: "Synchronise tes bases de données et pages Notion.",
    icon: "📝",
    connected: false,
    category: "other",
    context: { ...emptyContext },
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Attache des fichiers Drive à tes tâches et projets.",
    icon: "📁",
    connected: false,
    category: "storage",
    context: { ...emptyContext },
  },
  {
    id: "linear",
    name: "Linear",
    description: "Synchronise tes issues et projets de développement.",
    icon: "◆",
    connected: false,
    category: "other",
    context: { ...emptyContext },
  },
];

export const categoryLabels: Record<string, string> = {
  calendar: "Agenda",
  email: "Email",
  crm: "CRM",
  messaging: "Messagerie",
  storage: "Stockage",
  other: "Autres",
};

export const categoryOrder = ["calendar", "email", "crm", "messaging", "storage", "other"];
