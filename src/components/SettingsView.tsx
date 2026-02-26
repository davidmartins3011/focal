import { useState } from "react";
import styles from "./SettingsView.module.css";
import type { ThemeId, AIProviderId, AISettings } from "../types";

interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  badge?: string;
  colors: { bg: string; accent: string; text: string; bg2: string };
}

interface ProviderMeta {
  id: AIProviderId;
  name: string;
  models: string;
  icon: string;
  iconBg: string;
  placeholder: string;
}

const themes: ThemeOption[] = [
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

const providers: ProviderMeta[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: "GPT-4o, GPT-4o-mini, o1, o3-mini",
    icon: "⬡",
    iconBg: "#10a37f",
    placeholder: "sk-proj-...",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: "Claude 4 Opus, Claude 4 Sonnet",
    icon: "△",
    iconBg: "#d97757",
    placeholder: "sk-ant-...",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    models: "Mistral Large, Mistral Medium, Codestral",
    icon: "◆",
    iconBg: "#f24822",
    placeholder: "sk-...",
  },
];

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
