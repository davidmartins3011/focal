import { useState } from "react";
import styles from "./SettingsView.module.css";
import type { ThemeId, AIProviderId, AISettings } from "../types";
import { themes, providers } from "../data/mockSettings";

interface SettingsViewProps {
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  aiSettings: AISettings;
  onAISettingsChange: (settings: AISettings) => void;
}

export default function SettingsView({
  currentTheme,
  onThemeChange,
  aiSettings,
  onAISettingsChange,
}: SettingsViewProps) {
  const [visibleKeys, setVisibleKeys] = useState<Record<AIProviderId, boolean>>({
    openai: false,
    anthropic: false,
    mistral: false,
  });

  const toggleProvider = (id: AIProviderId) => {
    const updated = {
      ...aiSettings,
      providers: aiSettings.providers.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      ),
    };
    onAISettingsChange(updated);
  };

  const updateApiKey = (id: AIProviderId, apiKey: string) => {
    const updated = {
      ...aiSettings,
      providers: aiSettings.providers.map((p) =>
        p.id === id ? { ...p, apiKey } : p
      ),
    };
    onAISettingsChange(updated);
  };

  const toggleKeyVisibility = (id: AIProviderId) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getProviderConfig = (id: AIProviderId) =>
    aiSettings.providers.find((p) => p.id === id) ?? { id, enabled: false, apiKey: "" };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Paramètres</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Intelligence Artificielle</h2>
        <div className={styles.providersList}>
          {providers.map((provider) => {
            const config = getProviderConfig(provider.id);
            return (
              <div
                key={provider.id}
                className={`${styles.providerCard} ${config.enabled ? styles.enabled : ""}`}
              >
                <div className={styles.providerHeader} onClick={() => toggleProvider(provider.id)}>
                  <div className={styles.providerLogo} style={{ background: provider.iconBg, color: "#fff" }}>
                    {provider.icon}
                  </div>
                  <div className={styles.providerInfo}>
                    <div className={styles.providerName}>{provider.name}</div>
                    <div className={styles.providerModels}>{provider.models}</div>
                  </div>
                  <button
                    className={`${styles.toggle} ${config.enabled ? styles.on : ""}`}
                    onClick={(e) => { e.stopPropagation(); toggleProvider(provider.id); }}
                  >
                    <span className={styles.toggleDot} />
                  </button>
                </div>

                {config.enabled && (
                  <div className={styles.providerBody}>
                    <div className={styles.apiKeyLabel}>Clé API</div>
                    <div className={styles.apiKeyWrapper}>
                      <input
                        className={styles.apiKeyInput}
                        type={visibleKeys[provider.id] ? "text" : "password"}
                        value={config.apiKey}
                        onChange={(e) => updateApiKey(provider.id, e.target.value)}
                        placeholder={provider.placeholder}
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <button
                        className={styles.apiKeyToggle}
                        onClick={() => toggleKeyVisibility(provider.id)}
                        title={visibleKeys[provider.id] ? "Masquer" : "Afficher"}
                      >
                        {visibleKeys[provider.id] ? "🙈" : "👁"}
                      </button>
                    </div>
                    <div className={styles.apiKeyStatus}>
                      <span className={`${styles.statusDot} ${config.apiKey ? styles.saved : styles.missing}`} />
                      <span className={styles.statusText}>
                        {config.apiKey ? "Clé enregistrée" : "Aucune clé configurée"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Apparence</h2>
        <div className={styles.themesGrid}>
          {themes.map((theme) => (
            <button
              key={theme.id}
              className={`${styles.themeCard} ${currentTheme === theme.id ? styles.active : ""}`}
              onClick={() => onThemeChange(theme.id)}
            >
              <div className={styles.themePreview}>
                <div className={styles.previewBar} style={{ background: theme.colors.bg, flex: 1 }} />
                <div className={styles.previewBar} style={{ background: theme.colors.bg2, flex: 2 }} />
                <div className={styles.previewBar} style={{ background: theme.colors.accent, flex: 0.5 }} />
                <div className={styles.previewBar} style={{ background: theme.colors.text, flex: 0.3 }} />
              </div>
              <div className={styles.themeName}>{theme.name}</div>
              <div className={styles.themeDesc}>{theme.description}</div>
              {currentTheme === theme.id ? (
                <span className={styles.checkmark}>✓</span>
              ) : theme.badge ? (
                <span className={styles.badge}>{theme.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
