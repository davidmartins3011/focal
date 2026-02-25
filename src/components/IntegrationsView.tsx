import { useState } from "react";
import styles from "./IntegrationsView.module.css";
import type { Integration } from "../types";

const defaultIntegrations: Integration[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Synchronise tes événements et bloque du temps pour tes tâches.",
    icon: "📅",
    connected: false,
    category: "calendar",
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    description: "Connecte ton agenda Outlook pour voir tes créneaux disponibles.",
    icon: "🗓",
    connected: false,
    category: "calendar",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Transforme tes emails importants en tâches automatiquement.",
    icon: "✉️",
    connected: false,
    category: "email",
  },
  {
    id: "outlook-mail",
    name: "Outlook Mail",
    description: "Connecte ta boîte Outlook pour capturer les actions à faire.",
    icon: "📧",
    connected: false,
    category: "email",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Synchronise tes deals, contacts et tâches CRM.",
    icon: "🟠",
    connected: false,
    category: "crm",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Importe tes opportunités et activités Salesforce.",
    icon: "☁️",
    connected: false,
    category: "crm",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Reçois des rappels et crée des tâches depuis Slack.",
    icon: "💬",
    connected: false,
    category: "messaging",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Synchronise tes bases de données et pages Notion.",
    icon: "📝",
    connected: false,
    category: "other",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Attache des fichiers Drive à tes tâches et projets.",
    icon: "📁",
    connected: false,
    category: "storage",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Synchronise tes issues et projets de développement.",
    icon: "◆",
    connected: false,
    category: "other",
  },
];

const categoryLabels: Record<string, string> = {
  calendar: "Agenda",
  email: "Email",
  crm: "CRM",
  messaging: "Messagerie",
  storage: "Stockage",
  other: "Autres",
};

const categoryOrder = ["calendar", "email", "crm", "messaging", "storage", "other"];

export default function IntegrationsView() {
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);

  const toggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i))
    );
  };

  const grouped = categoryOrder
    .map((cat) => ({
      category: cat,
      label: categoryLabels[cat],
      items: integrations.filter((i) => i.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Intégrations</h1>
          <p className={styles.subtitle}>
            Connecte tes outils pour centraliser ton travail.
            {connectedCount > 0 && (
              <span className={styles.badge}>{connectedCount} active{connectedCount > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
      </header>

      <div className={styles.content}>
        {grouped.map((group) => (
          <section key={group.category} className={styles.section}>
            <h2 className={styles.sectionTitle}>{group.label}</h2>
            <div className={styles.grid}>
              {group.items.map((integration) => (
                <div
                  key={integration.id}
                  className={`${styles.card} ${integration.connected ? styles.connected : ""}`}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>{integration.icon}</span>
                    <div className={styles.cardInfo}>
                      <h3 className={styles.cardName}>{integration.name}</h3>
                      <p className={styles.cardDesc}>{integration.description}</p>
                    </div>
                  </div>
                  <button
                    className={`${styles.connectBtn} ${integration.connected ? styles.connectedBtn : ""}`}
                    onClick={() => toggleConnection(integration.id)}
                  >
                    {integration.connected ? (
                      <>
                        <span className={styles.dot} />
                        Connecté
                      </>
                    ) : (
                      "Connecter"
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
