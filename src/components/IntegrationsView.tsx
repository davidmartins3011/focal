import { useState } from "react";
import styles from "./IntegrationsView.module.css";
import type { Integration, IntegrationRule } from "../types";

const emptyContext = { rules: [], extraContext: "" };

const defaultIntegrations: Integration[] = [
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

const categoryLabels: Record<string, string> = {
  calendar: "Agenda",
  email: "Email",
  crm: "CRM",
  messaging: "Messagerie",
  storage: "Stockage",
  other: "Autres",
};

const categoryOrder = ["calendar", "email", "crm", "messaging", "storage", "other"];

// ─── Score Selector ───

function ScoreSelector({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: "urgency" | "importance";
}) {
  return (
    <div className={styles.scoreRow}>
      <span className={styles.scoreLabel}>{label}</span>
      <div className={styles.scoreDots}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`${styles.scoreDot} ${n <= value ? styles[`${color}Active`] : ""}`}
            onClick={() => onChange(n)}
            title={`${n}/5`}
          />
        ))}
      </div>
      <span className={styles.scoreValue}>{value}/5</span>
    </div>
  );
}

// ─── Context Panel ───

function ContextPanel({
  integration,
  onBack,
  onUpdate,
}: {
  integration: Integration;
  onBack: () => void;
  onUpdate: (updated: Integration) => void;
}) {
  const { context } = integration;

  const addRule = () => {
    const newRule: IntegrationRule = {
      id: crypto.randomUUID(),
      text: "",
      urgency: 3,
      importance: 3,
    };
    onUpdate({
      ...integration,
      context: { ...context, rules: [...context.rules, newRule] },
    });
  };

  const updateRule = (ruleId: string, patch: Partial<IntegrationRule>) => {
    onUpdate({
      ...integration,
      context: {
        ...context,
        rules: context.rules.map((r) =>
          r.id === ruleId ? { ...r, ...patch } : r
        ),
      },
    });
  };

  const deleteRule = (ruleId: string) => {
    onUpdate({
      ...integration,
      context: {
        ...context,
        rules: context.rules.filter((r) => r.id !== ruleId),
      },
    });
  };

  const setExtraContext = (extraContext: string) => {
    onUpdate({
      ...integration,
      context: { ...context, extraContext },
    });
  };

  return (
    <div className={styles.contextPanel}>
      <header className={styles.contextHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Retour
        </button>
        <div className={styles.contextTitle}>
          <span className={styles.contextIcon}>{integration.icon}</span>
          <div>
            <h2 className={styles.contextName}>{integration.name}</h2>
            <p className={styles.contextSub}>Contexte &amp; règles pour l'IA</p>
          </div>
        </div>
      </header>

      <div className={styles.contextContent}>
        {/* Rules */}
        <section className={styles.contextSection}>
          <div className={styles.contextSectionHead}>
            <h3 className={styles.contextSectionTitle}>
              Rules
              <span className={styles.ruleCount}>{context.rules.length}</span>
            </h3>
            <button className={styles.addRuleBtn} onClick={addRule}>
              + Ajouter une règle
            </button>
          </div>
          <p className={styles.contextHint}>
            Décris en langage naturel comment focal doit interagir avec {integration.name}.
          </p>

          {context.rules.length === 0 ? (
            <div className={styles.emptyRules}>
              <p>Aucune règle définie.</p>
              <button className={styles.addRuleEmptyBtn} onClick={addRule}>
                Créer ta première règle
              </button>
            </div>
          ) : (
            <div className={styles.rulesList}>
              {context.rules.map((rule, idx) => (
                <div key={rule.id} className={styles.ruleCard}>
                  <div className={styles.ruleTop}>
                    <span className={styles.ruleIndex}>#{idx + 1}</span>
                    <button
                      className={styles.ruleDeleteBtn}
                      onClick={() => deleteRule(rule.id)}
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    className={styles.ruleTextarea}
                    value={rule.text}
                    onChange={(e) => updateRule(rule.id, { text: e.target.value })}
                    placeholder="Ex : Ne jamais planifier de réunions avant 10h du matin..."
                    rows={2}
                  />
                  <div className={styles.ruleScores}>
                    <ScoreSelector
                      label="Urgence"
                      value={rule.urgency}
                      onChange={(v) => updateRule(rule.id, { urgency: v })}
                      color="urgency"
                    />
                    <ScoreSelector
                      label="Importance"
                      value={rule.importance}
                      onChange={(v) => updateRule(rule.id, { importance: v })}
                      color="importance"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Extra Context */}
        <section className={styles.contextSection}>
          <h3 className={styles.contextSectionTitle}>Extra Contexte</h3>
          <p className={styles.contextHint}>
            Informations supplémentaires que l'IA doit prendre en compte pour cette intégration.
          </p>
          <textarea
            className={styles.extraContextArea}
            value={context.extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder={`Ex : Mon compte ${integration.name} est utilisé principalement pour le projet X. Les contacts VIP sont...`}
            rows={5}
          />
        </section>
      </div>
    </div>
  );
}

// ─── Main View ───

export default function IntegrationsView() {
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  const [contextFor, setContextFor] = useState<string | null>(null);

  const toggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i))
    );
  };

  const updateIntegration = (updated: Integration) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
  };

  const activeIntegration = contextFor
    ? integrations.find((i) => i.id === contextFor)
    : null;

  if (activeIntegration) {
    return (
      <div className={styles.container}>
        <ContextPanel
          integration={activeIntegration}
          onBack={() => setContextFor(null)}
          onUpdate={updateIntegration}
        />
      </div>
    );
  }

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
              <span className={styles.badge}>
                {connectedCount} active{connectedCount > 1 ? "s" : ""}
              </span>
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
                      <h3 className={styles.cardName}>
                        {integration.name}
                        {integration.context.rules.length > 0 && (
                          <span className={styles.rulesIndicator}>
                            {integration.context.rules.length} rule{integration.context.rules.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </h3>
                      <p className={styles.cardDesc}>{integration.description}</p>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.contextBtn}
                      onClick={() => setContextFor(integration.id)}
                    >
                      Contexte
                    </button>
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
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
