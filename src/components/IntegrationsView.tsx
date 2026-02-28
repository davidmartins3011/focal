import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./IntegrationsView.module.css";
import type { Integration } from "../types";
import { categoryLabels, categoryOrder } from "../data/integrationConstants";
import {
  getIntegrations,
  updateIntegrationConnection,
  updateIntegrationContext,
  getOAuthCredentials,
  setOAuthCredentials,
  startOAuth,
  disconnectIntegration,
} from "../services/integrations";
import ContextPanel from "./ContextPanel";
import { integrationLogos } from "./icons/IntegrationLogos";

interface IntegrationsViewProps {
  resetSignal?: number;
}

type OAuthStep = "idle" | "credentials" | "connecting" | "error";

export default function IntegrationsView({ resetSignal }: IntegrationsViewProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [contextFor, setContextFor] = useState<string | null>(null);

  // OAuth state
  const [oauthTarget, setOauthTarget] = useState<string | null>(null);
  const [oauthStep, setOauthStep] = useState<OAuthStep>("idle");
  const [oauthError, setOauthError] = useState("");
  const [credClientId, setCredClientId] = useState("");
  const [credClientSecret, setCredClientSecret] = useState("");

  useEffect(() => {
    getIntegrations()
      .then(setIntegrations)
      .catch((err) => console.error("[IntegrationsView] getIntegrations error:", err));
  }, []);

  useEffect(() => {
    setContextFor(null);
    setOauthTarget(null);
    setOauthStep("idle");
  }, [resetSignal]);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const persistContext = useCallback((integration: Integration) => {
    if (debounceTimers.current[integration.id]) {
      clearTimeout(debounceTimers.current[integration.id]);
    }
    debounceTimers.current[integration.id] = setTimeout(() => {
      updateIntegrationContext(
        integration.id,
        integration.context.rules,
        integration.context.extraContext,
      ).catch((err) => console.error("[IntegrationsView] persistContext error:", err));
      delete debounceTimers.current[integration.id];
    }, 500);
  }, []);

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const toggleConnection = (id: string) => {
    const item = integrations.find((i) => i.id === id);
    if (!item) return;
    const next = !item.connected;
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: next } : i))
    );
    updateIntegrationConnection(id, next);
  };

  const updateIntegration = (updated: Integration) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
    persistContext(updated);
  };

  // ─── OAuth flow ───

  const handleConnect = async (integration: Integration) => {
    if (!integration.oauthProvider) {
      toggleConnection(integration.id);
      return;
    }

    // If already connected, disconnect
    if (integration.connected) {
      try {
        const updated = await disconnectIntegration(integration.id);
        setIntegrations((prev) =>
          prev.map((i) => (i.id === updated.id ? updated : i))
        );
      } catch (err) {
        console.error("[IntegrationsView] disconnect error:", err);
      }
      return;
    }

    // Check if OAuth credentials are configured
    setOauthTarget(integration.id);
    setOauthError("");

    try {
      const creds = await getOAuthCredentials(integration.oauthProvider);
      if (!creds.configured) {
        setOauthStep("credentials");
        setCredClientId("");
        setCredClientSecret("");
        return;
      }

      // Credentials exist, start OAuth directly
      await runOAuthFlow(integration.id);
    } catch (err) {
      setOauthStep("error");
      setOauthError(String(err));
    }
  };

  const handleSaveCredentials = async () => {
    if (!oauthTarget) return;
    const integration = integrations.find((i) => i.id === oauthTarget);
    if (!integration?.oauthProvider) return;

    if (!credClientId.trim() || !credClientSecret.trim()) {
      setOauthError("Les deux champs sont requis.");
      return;
    }

    try {
      await setOAuthCredentials(integration.oauthProvider, credClientId.trim(), credClientSecret.trim());
      await runOAuthFlow(oauthTarget);
    } catch (err) {
      setOauthStep("error");
      setOauthError(String(err));
    }
  };

  const runOAuthFlow = async (integrationId: string) => {
    setOauthStep("connecting");
    setOauthError("");

    try {
      await startOAuth(integrationId);
      // Refresh integrations list to get updated connected state
      const updated = await getIntegrations();
      setIntegrations(updated);
      setOauthTarget(null);
      setOauthStep("idle");
    } catch (err) {
      setOauthStep("error");
      setOauthError(String(err));
    }
  };

  const closeOAuthModal = () => {
    setOauthTarget(null);
    setOauthStep("idle");
    setOauthError("");
  };

  // ─── Render ───

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

  const oauthTargetIntegration = oauthTarget
    ? integrations.find((i) => i.id === oauthTarget)
    : null;

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

      {oauthStep === "connecting" && oauthTargetIntegration && (
        <div className={styles.oauthBanner}>
          <span className={styles.spinner} />
          <span>
            Une fenêtre s'est ouverte dans ton navigateur — autorise l'accès pour connecter <strong>{oauthTargetIntegration.name}</strong>.
          </span>
        </div>
      )}

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
                    <span className={styles.cardIcon}>
                      {integrationLogos[integration.id]
                        ? integrationLogos[integration.id]({ size: 26 })
                        : integration.icon}
                    </span>
                    <div className={styles.cardInfo}>
                      <h3 className={styles.cardName}>
                        {integration.name}
                        {integration.oauthProvider && (
                          <span className={styles.oauthBadge}>OAuth</span>
                        )}
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
                      Directives
                    </button>
                    <button
                      className={`${styles.connectBtn} ${integration.connected ? styles.connectedBtn : ""} ${
                        oauthTarget === integration.id && oauthStep === "connecting" ? styles.connectingBtn : ""
                      }`}
                      onClick={() => handleConnect(integration)}
                      disabled={oauthTarget === integration.id && oauthStep === "connecting"}
                    >
                      {oauthTarget === integration.id && oauthStep === "connecting" ? (
                        <>
                          <span className={styles.spinner} />
                          En attente…
                        </>
                      ) : integration.connected ? (
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

      {/* OAuth Credentials Modal */}
      {oauthTargetIntegration && (oauthStep === "credentials" || oauthStep === "error") && (
        <div className={styles.modalOverlay} onClick={closeOAuthModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalIcon}>
                {integrationLogos[oauthTargetIntegration.id]
                  ? integrationLogos[oauthTargetIntegration.id]({ size: 28 })
                  : oauthTargetIntegration.icon}
              </span>
              <div>
                <h3 className={styles.modalTitle}>
                  Connecter {oauthTargetIntegration.name}
                </h3>
                <p className={styles.modalSub}>
                  Configure tes identifiants OAuth {oauthTargetIntegration.oauthProvider === "google" ? "Google" : "Microsoft"} pour te connecter.
                </p>
              </div>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalHint}>
                {oauthTargetIntegration.oauthProvider === "google" ? (
                  <>
                    Crée un projet sur{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Cloud Console
                    </a>
                    , active les APIs Calendar et Gmail, puis crée un identifiant OAuth 2.0 (type "Application de bureau").
                  </>
                ) : (
                  <>
                    Configure une application dans{" "}
                    <a
                      href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Azure Portal
                    </a>
                    .
                  </>
                )}
              </div>

              <label className={styles.fieldLabel}>Client ID</label>
              <input
                className={styles.fieldInput}
                type="text"
                placeholder="xxxx.apps.googleusercontent.com"
                value={credClientId}
                onChange={(e) => setCredClientId(e.target.value)}
                autoFocus
              />

              <label className={styles.fieldLabel}>Client Secret</label>
              <input
                className={styles.fieldInput}
                type="password"
                placeholder="GOCSPX-..."
                value={credClientSecret}
                onChange={(e) => setCredClientSecret(e.target.value)}
              />

              {oauthError && (
                <p className={styles.modalError}>{oauthError}</p>
              )}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={closeOAuthModal}>
                Annuler
              </button>
              <button className={styles.modalSaveBtn} onClick={handleSaveCredentials}>
                Sauvegarder et connecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
