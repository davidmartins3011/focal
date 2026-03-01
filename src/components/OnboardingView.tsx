import { useState, useRef, useEffect, useCallback } from "react";
import type { ThemeId, AISettings, AIProviderId, AIKeyStatus, UserProfile } from "../types";
import { themes, providers } from "../data/settingsData";
import { validateApiKey, setSetting } from "../services/settings";
import { sendOnboardingMessage } from "../services/chat";
import { updateProfile } from "../services/profile";
import styles from "./OnboardingView.module.css";

interface OnboardingViewProps {
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  aiSettings: AISettings;
  onAISettingsChange: (settings: AISettings) => void;
  onComplete: () => void;
}

const INITIAL_GREETING = [
  "Salut ! Bienvenue sur focal. \u2728",
  "",
  "Je suis ton assistant de productivité, pensé spécialement pour les cerveaux qui fonctionnent un peu différemment.",
  "",
  "Avant de commencer, j\u2019aimerais apprendre à te connaître pour adapter l\u2019outil à ton fonctionnement. On va discuter quelques minutes, rien de compliqué.",
  "",
  "Comment tu t\u2019appelles ?",
].join("\n");

export default function OnboardingView({
  currentTheme,
  onThemeChange,
  aiSettings,
  onAISettingsChange,
  onComplete,
}: OnboardingViewProps) {
  const [step, setStep] = useState(1);

  // Step 2 state
  const [expandedProvider, setExpandedProvider] = useState<AIProviderId | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<AIProviderId, boolean>>({
    openai: false,
    anthropic: false,
    mistral: false,
  });
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;

  // Step 3 state
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (step === 3 && messages.length === 0) {
      setMessages([{ role: "ai", content: INITIAL_GREETING }]);
    }
  }, [step, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Step 2: API key validation ──

  const getProviderConfig = (id: AIProviderId) =>
    aiSettings.providers.find((p) => p.id === id) ?? { id, enabled: false, apiKey: "" };

  const runValidation = useCallback(
    (id: AIProviderId, apiKey: string) => {
      if (!apiKey.trim()) return;

      const current = aiSettingsRef.current;
      onAISettingsChange({
        ...current,
        providers: current.providers.map((p) =>
          p.id === id ? { ...p, keyStatus: "validating" as AIKeyStatus } : p
        ),
      });

      validateApiKey(id, apiKey)
        .then((valid) => {
          const latest = aiSettingsRef.current;
          const updated: AISettings = {
            ...latest,
            providers: latest.providers.map((p) =>
              p.id === id
                ? { ...p, apiKey, enabled: valid, keyStatus: (valid ? "valid" : "invalid") as AIKeyStatus }
                : p
            ),
          };
          if (valid && !updated.selectedModel) {
            const provider = providers.find((pr) => pr.id === id);
            if (provider?.models.length) {
              updated.selectedModel = provider.models[0].id;
            }
          }
          onAISettingsChange(updated);
        })
        .catch(() => {
          const latest = aiSettingsRef.current;
          onAISettingsChange({
            ...latest,
            providers: latest.providers.map((p) =>
              p.id === id ? { ...p, apiKey, keyStatus: "invalid" as AIKeyStatus } : p
            ),
          });
        });
    },
    [onAISettingsChange],
  );

  const updateApiKey = (id: AIProviderId, apiKey: string) => {
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }
    const updated = {
      ...aiSettings,
      providers: aiSettings.providers.map((p) =>
        p.id === id ? { ...p, apiKey, keyStatus: "untested" as AIKeyStatus } : p
      ),
    };
    onAISettingsChange(updated);

    if (apiKey.trim()) {
      debounceTimers.current[id] = setTimeout(() => {
        runValidation(id, apiKey);
      }, 800);
    }
  };

  const hasValidKey = aiSettings.providers.some(
    (p) => p.enabled && p.apiKey && p.keyStatus === "valid",
  );

  // ── Step 3: Chat ──

  const sendChat = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setChatError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setIsTyping(true);

    const historyForApi = newMessages
      .slice(1)
      .filter((m) => m.role === "user" || m.role === "ai")
      .slice(0, -1);

    sendOnboardingMessage(text, historyForApi, profile)
      .then((response) => {
        setIsTyping(false);

        const aiMsg = { role: "ai", content: response.content };
        setMessages((prev) => [...prev, aiMsg]);

        if (response.profileUpdates && typeof response.profileUpdates === "object") {
          setProfile((prev) => ({ ...prev, ...response.profileUpdates }));
        }

        if (response.onboardingComplete) {
          setOnboardingComplete(true);
        }
      })
      .catch((err) => {
        setIsTyping(false);
        const errMsg = typeof err === "string" ? err : String(err);
        setChatError(errMsg);
      });
  }, [input, isTyping, messages, profile]);

  const finishOnboarding = useCallback(() => {
    updateProfile(profile).catch(() => {});
    setSetting("onboarding-completed", "true").catch(() => {});
    onComplete();
  }, [profile, onComplete]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }

  // ── Renders ──

  const renderHeader = () => (
    <div className={styles.header}>
      <div className={styles.logo}>f.</div>
      <div className={styles.dots}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`${styles.dot} ${step >= s ? styles.dotActive : ""}`}
          />
        ))}
      </div>
      <div className={styles.headerSpacer} />
    </div>
  );

  const renderThemeStep = () => (
    <div className={styles.stepWrapper}>
      <div className={styles.stepContent}>
        <h1 className={styles.stepTitle}>Bienvenue sur focal.</h1>
        <p className={styles.stepSubtitle}>
          Choisis un thème qui te correspond. Tu pourras le changer à tout moment.
        </p>
        <div className={styles.themesGrid}>
          {themes.map((theme) => (
            <button
              key={theme.id}
              className={`${styles.themeCard} ${currentTheme === theme.id ? styles.themeActive : ""}`}
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
                <span className={styles.themeCheck}>✓</span>
              ) : theme.badge ? (
                <span className={styles.themeBadge}>{theme.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
        <button className={styles.nextBtn} onClick={() => setStep(2)}>
          Continuer
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );

  const renderApiKeyStep = () => (
    <div className={styles.stepWrapper}>
      <div className={styles.stepContent}>
        <h1 className={styles.stepTitle}>Intelligence artificielle</h1>
        <p className={styles.stepSubtitle}>
          Pour que ton assistant puisse t'aider, configure au moins un provider IA en entrant ta clé API.
        </p>
        <div className={styles.providersList}>
          {providers.map((provider) => {
            const config = getProviderConfig(provider.id);
            const isExpanded = expandedProvider === provider.id;
            const isValid = config.keyStatus === "valid";

            return (
              <div
                key={provider.id}
                className={`${styles.providerCard} ${isValid ? styles.providerValid : ""}`}
              >
                <div
                  className={styles.providerHeader}
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                >
                  <div className={styles.providerLogo} style={{ background: provider.iconBg }}>
                    {provider.icon}
                  </div>
                  <div className={styles.providerInfo}>
                    <div className={styles.providerName}>{provider.name}</div>
                    <div className={styles.providerModels}>
                      {provider.models.map((m) => m.name).join(", ")}
                    </div>
                  </div>
                  <svg
                    className={`${styles.providerChevron} ${isExpanded ? styles.providerChevronOpen : ""}`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {isExpanded && (
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
                        autoFocus
                      />
                      <button
                        className={styles.apiKeyToggle}
                        onClick={() => setVisibleKeys((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                        title={visibleKeys[provider.id] ? "Masquer" : "Afficher"}
                      >
                        {visibleKeys[provider.id] ? "\uD83D\uDE48" : "\uD83D\uDC41"}
                      </button>
                    </div>
                    <div className={styles.apiKeyStatus}>
                      {config.keyStatus === "validating" ? (
                        <>
                          <span className={`${styles.statusDot} ${styles.statusValidating}`} />
                          <span className={styles.statusText}>Vérification en cours…</span>
                        </>
                      ) : config.keyStatus === "valid" ? (
                        <>
                          <span className={`${styles.statusDot} ${styles.statusSaved}`} />
                          <span className={styles.statusText}>Clé valide</span>
                        </>
                      ) : config.keyStatus === "invalid" ? (
                        <>
                          <span className={`${styles.statusDot} ${styles.statusInvalid}`} />
                          <span className={`${styles.statusText} ${styles.statusError}`}>
                            Clé invalide — vérifie ta clé API
                          </span>
                        </>
                      ) : config.apiKey ? (
                        <>
                          <span className={`${styles.statusDot} ${styles.statusMissing}`} />
                          <span className={styles.statusText}>Clé non vérifiée</span>
                        </>
                      ) : (
                        <>
                          <span className={`${styles.statusDot} ${styles.statusMissing}`} />
                          <span className={styles.statusText}>Colle ta clé API ici</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button
          className={styles.nextBtn}
          onClick={() => setStep(3)}
          disabled={!hasValidKey}
        >
          Continuer
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );

  const renderChatStep = () => (
    <div className={styles.chatWrapper}>
      <div className={styles.chatMessages}>
        <div className={styles.chatMessagesInner}>
          {messages.map((msg, i) => (
            <div key={i} className={`${styles.msg} ${styles[msg.role]}`}>
              <div className={styles.msgRole}>
                {msg.role === "ai" ? "focal." : "Toi"}
              </div>
              <div
                className={styles.msgBubble}
                dangerouslySetInnerHTML={{
                  __html: msg.content.replace(/\n/g, "<br/>"),
                }}
              />
            </div>
          ))}

          {isTyping && (
            <div className={`${styles.msg} ${styles.ai}`}>
              <div className={styles.msgRole}>focal.</div>
              <div className={styles.typingIndicator}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </div>
          )}

          {chatError && (
            <div className={styles.errorBanner}>
              <span>⚠</span>
              <span>{chatError}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className={styles.chatInputArea}>
        <div className={styles.chatInputInner}>
          {onboardingComplete ? (
            <div className={styles.finishBar}>
              <button className={styles.finishBtn} onClick={finishOnboarding}>
                Commencer à utiliser focal.
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          ) : (
            <div className={styles.inputBox}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Écris ta réponse…"
                rows={1}
              />
              <button
                className={styles.sendBtn}
                onClick={sendChat}
                disabled={isTyping || !input.trim()}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      {renderHeader()}
      {step === 1 && renderThemeStep()}
      {step === 2 && renderApiKeyStep()}
      {step === 3 && renderChatStep()}
    </div>
  );
}
