import { useState } from "react";
import styles from "./IntegrationsView.module.css";
import type { Integration } from "../types";
import { defaultIntegrations, categoryLabels, categoryOrder } from "../data/mockIntegrations";
import ContextPanel from "./ContextPanel";

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
