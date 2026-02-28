import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./SettingsView.module.css";
import type { ThemeId, AIProviderId, AISettings, AIKeyStatus, NotificationSettings, ReminderFrequency, WeekDayId, StrategyFrequency, FrequencyOccurrence } from "../types";
import { themes, providers, type ProviderMeta } from "../data/settingsData";
import { validateApiKey } from "../services/settings";
import {
  DAY_LABELS,
  FREQUENCY_OPTIONS,
  getOccurrenceOptions,
  BIMONTHLY_CYCLES,
  BIANNUAL_CYCLES,
  QUARTERLY_CYCLES,
  STRATEGY_FREQUENCY_OPTIONS,
} from "../data/settingsConstants";

const STRATEGY_OCCURRENCE_OPTIONS: { id: FrequencyOccurrence; label: string }[] = [
  { id: "1st", label: "1er" },
  { id: "2nd", label: "2e" },
  { id: "3rd", label: "3e" },
  { id: "4th", label: "4e" },
  { id: "last", label: "Dernier" },
];

interface SettingsViewProps {
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  aiSettings: AISettings;
  onAISettingsChange: (settings: AISettings) => void;
  notifSettings: NotificationSettings;
  onNotifSettingsChange: (settings: NotificationSettings) => void;
  onTestNotification?: () => void;
  dailyPriorityCount: number;
  onDailyPriorityCountChange: (count: number) => void;
  strategyFrequency: StrategyFrequency;
  onStrategyFrequencyChange: (freq: StrategyFrequency) => void;
  strategyCycleStart: number;
  onStrategyCycleStartChange: (start: number) => void;
  strategyOccurrence: FrequencyOccurrence;
  onStrategyOccurrenceChange: (occ: FrequencyOccurrence) => void;
  strategyDay: WeekDayId;
  onStrategyDayChange: (day: WeekDayId) => void;
}

export default function SettingsView({
  currentTheme,
  onThemeChange,
  aiSettings,
  onAISettingsChange,
  notifSettings,
  onNotifSettingsChange,
  onTestNotification,
  dailyPriorityCount,
  onDailyPriorityCountChange,
  strategyFrequency,
  onStrategyFrequencyChange,
  strategyCycleStart,
  onStrategyCycleStartChange,
  strategyOccurrence,
  onStrategyOccurrenceChange,
  strategyDay,
  onStrategyDayChange,
}: SettingsViewProps) {
  const [visibleKeys, setVisibleKeys] = useState<Record<AIProviderId, boolean>>({
    openai: false,
    anthropic: false,
    mistral: false,
  });

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;

  const runValidation = useCallback((id: AIProviderId, apiKey: string) => {
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
        onAISettingsChange({
          ...latest,
          providers: latest.providers.map((p) =>
            p.id === id ? { ...p, apiKey, keyStatus: (valid ? "valid" : "invalid") as AIKeyStatus } : p
          ),
        });
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
  }, [onAISettingsChange]);

  const toggleProvider = (id: AIProviderId) => {
    const config = aiSettings.providers.find((p) => p.id === id);
    const wasEnabled = config?.enabled;
    const updated: AISettings = {
      ...aiSettings,
      providers: aiSettings.providers.map((p) =>
        p.id === id ? { ...p, enabled: !wasEnabled } : p
      ),
    };
    if (wasEnabled) {
      const enabledModels = getAvailableModels(updated);
      if (updated.selectedModel) {
        const stillAvailable = enabledModels.some((m) => m.id === updated.selectedModel);
        if (!stillAvailable) {
          updated.selectedModel = enabledModels[0]?.id;
        }
      }
    }
    onAISettingsChange(updated);
  };

  const getAvailableModels = (settings: AISettings): { id: string; name: string; provider: ProviderMeta }[] => {
    const result: { id: string; name: string; provider: ProviderMeta }[] = [];
    for (const provider of providers) {
      const config = settings.providers.find((p) => p.id === provider.id);
      if (config?.enabled && config.apiKey && config.keyStatus === "valid") {
        for (const model of provider.models) {
          result.push({ id: model.id, name: model.name, provider });
        }
      }
    }
    return result;
  };

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

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const toggleKeyVisibility = (id: AIProviderId) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getProviderConfig = (id: AIProviderId) =>
    aiSettings.providers.find((p) => p.id === id) ?? { id, enabled: false, apiKey: "" };

  const toggleNotifMaster = () => {
    onNotifSettingsChange({ ...notifSettings, enabled: !notifSettings.enabled });
  };

  const toggleReminder = (id: string) => {
    onNotifSettingsChange({
      ...notifSettings,
      reminders: notifSettings.reminders.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    });
  };

  const updateReminderTime = (id: string, time: string) => {
    onNotifSettingsChange({
      ...notifSettings,
      reminders: notifSettings.reminders.map((r) =>
        r.id === id ? { ...r, time } : r
      ),
    });
  };

  const updateReminderFrequency = (id: string, frequency: ReminderFrequency) => {
    onNotifSettingsChange({
      ...notifSettings,
      reminders: notifSettings.reminders.map((r) =>
        r.id === id ? { ...r, frequency } : r
      ),
    });
  };

  const toggleReminderDay = (reminderId: string, day: WeekDayId) => {
    onNotifSettingsChange({
      ...notifSettings,
      reminders: notifSettings.reminders.map((r) => {
        if (r.id !== reminderId) return r;
        const days = r.days.includes(day)
          ? r.days.filter((d) => d !== day)
          : [...r.days, day];
        return { ...r, days };
      }),
    });
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Paramètres</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Général</h2>
        <div className={styles.generalList}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>Priorités du jour</div>
              <div className={styles.settingDesc}>
                Nombre maximum de tâches affichées dans la section « Priorités du jour »
              </div>
            </div>
            <div className={styles.counterControl}>
              <button
                className={styles.counterBtn}
                onClick={() => onDailyPriorityCountChange(Math.max(1, dailyPriorityCount - 1))}
                disabled={dailyPriorityCount <= 1}
              >
                −
              </button>
              <span className={styles.counterValue}>{dailyPriorityCount}</span>
              <button
                className={styles.counterBtn}
                onClick={() => onDailyPriorityCountChange(Math.min(7, dailyPriorityCount + 1))}
                disabled={dailyPriorityCount >= 7}
              >
                +
              </button>
            </div>
          </div>

          <div className={styles.strategyCard}>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>Prise de recul</div>
                <div className={styles.settingDesc}>
                  À quelle fréquence veux-tu prendre du recul sur tes piliers et objectifs ?
                </div>
              </div>
            </div>

            <div className={styles.strategyBody}>
              <div className={styles.strategyFreqRow}>
                <label className={styles.strategyLabel}>Fréq.</label>
                <div className={styles.freqPills}>
                  {STRATEGY_FREQUENCY_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      className={`${styles.freqPill} ${strategyFrequency === f.id ? styles.freqActive : ""}`}
                      onClick={() => onStrategyFrequencyChange(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.strategyFreqRow}>
                <label className={styles.strategyLabel}>Quand</label>
                <div className={styles.occurrenceRow}>
                  <div className={styles.freqPills}>
                    {STRATEGY_OCCURRENCE_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        className={`${styles.freqPill} ${strategyOccurrence === o.id ? styles.freqActive : ""}`}
                        onClick={() => onStrategyOccurrenceChange(o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.dayPills}>
                    {DAY_LABELS.map((d) => (
                      <button
                        key={d.id}
                        className={`${styles.dayPill} ${strategyDay === d.id ? styles.dayActive : ""}`}
                        onClick={() => onStrategyDayChange(d.id)}
                      >
                        {d.short}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {strategyFrequency === "bimonthly" && (
                <div className={styles.strategyFreqRow}>
                  <label className={styles.strategyLabel}>Mois</label>
                  <div className={styles.cycleRow}>
                    {BIMONTHLY_CYCLES.map((c) => (
                      <button
                        key={c.start}
                        className={`${styles.cyclePill} ${strategyCycleStart === c.start ? styles.cycleActive : ""}`}
                        onClick={() => onStrategyCycleStartChange(c.start)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {strategyFrequency === "quarterly" && (
                <div className={styles.strategyFreqRow}>
                  <label className={styles.strategyLabel}>Mois</label>
                  <div className={styles.cycleRow}>
                    {QUARTERLY_CYCLES.map((c) => (
                      <button
                        key={c.start}
                        className={`${styles.cyclePill} ${strategyCycleStart === c.start ? styles.cycleActive : ""}`}
                        onClick={() => onStrategyCycleStartChange(c.start)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {strategyFrequency === "biannual" && (
                <div className={styles.strategyFreqRow}>
                  <label className={styles.strategyLabel}>Mois</label>
                  <div className={styles.cycleRow}>
                    {BIANNUAL_CYCLES.map((c) => (
                      <button
                        key={c.start}
                        className={`${styles.cyclePill} ${strategyCycleStart === c.start ? styles.cycleActive : ""}`}
                        onClick={() => onStrategyCycleStartChange(c.start)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Notifications & Rappels</h2>
          <button
            className={`${styles.toggle} ${notifSettings.enabled ? styles.on : ""}`}
            onClick={toggleNotifMaster}
          >
            <span className={styles.toggleDot} />
          </button>
        </div>
        <p className={styles.sectionDesc}>
          Focal te rappelle les moments clés de ta journée pour t'aider à rester sur les rails.
        </p>

        {notifSettings.enabled && (
          <>
            <div className={styles.remindersList}>
              {notifSettings.reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`${styles.reminderCard} ${reminder.enabled ? styles.reminderEnabled : ""}`}
                >
                  <div className={styles.reminderHeader}>
                    <span className={styles.reminderIcon}>{reminder.icon}</span>
                    <div className={styles.reminderInfo}>
                      <div className={styles.reminderLabel}>{reminder.label}</div>
                      <div className={styles.reminderDesc}>{reminder.description}</div>
                    </div>
                    <button
                      className={`${styles.toggle} ${reminder.enabled ? styles.on : ""}`}
                      onClick={() => toggleReminder(reminder.id)}
                    >
                      <span className={styles.toggleDot} />
                    </button>
                  </div>

                  {reminder.enabled && (
                    <div className={styles.reminderBody}>
                      <div className={styles.reminderTimeRow}>
                        <label className={styles.reminderTimeLabel}>Heure</label>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={reminder.time}
                          onChange={(e) => updateReminderTime(reminder.id, e.target.value)}
                        />
                      </div>
                      {reminder.id === "strategy-review" ? (
                        <div className={styles.reminderSyncNote}>
                          Fréquence calée sur le réglage « Prise de recul » ci-dessus.
                        </div>
                      ) : reminder.frequency ? (
                        <>
                          <div className={styles.reminderDaysRow}>
                            <label className={styles.reminderTimeLabel}>Fréq.</label>
                            <div className={styles.freqPills}>
                              {FREQUENCY_OPTIONS.map((f) => (
                                <button
                                  key={f.id}
                                  className={`${styles.freqPill} ${reminder.frequency === f.id ? styles.freqActive : ""}`}
                                  onClick={() => updateReminderFrequency(reminder.id, f.id)}
                                >
                                  {f.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {reminder.frequency !== "weekly" && (
                            <div className={styles.reminderDaysRow}>
                              <label className={styles.reminderTimeLabel}>Quand</label>
                              <div className={styles.occurrenceRow}>
                                <div className={styles.freqPills}>
                                  {getOccurrenceOptions(reminder.frequency).map((o) => (
                                    <button
                                      key={o.id}
                                      className={`${styles.freqPill} ${(reminder.frequencyOccurrence ?? "1st") === o.id ? styles.freqActive : ""}`}
                                      onClick={() => onNotifSettingsChange({
                                        ...notifSettings,
                                        reminders: notifSettings.reminders.map((r) =>
                                          r.id === reminder.id ? { ...r, frequencyOccurrence: o.id } : r
                                        ),
                                      })}
                                    >
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                                <div className={styles.dayPills}>
                                  {DAY_LABELS.map((d) => (
                                    <button
                                      key={d.id}
                                      className={`${styles.dayPill} ${reminder.days[0] === d.id ? styles.dayActive : ""}`}
                                      onClick={() => onNotifSettingsChange({
                                        ...notifSettings,
                                        reminders: notifSettings.reminders.map((r) =>
                                          r.id === reminder.id ? { ...r, days: [d.id] } : r
                                        ),
                                      })}
                                    >
                                      {d.short}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {reminder.frequency === "bimonthly" && (
                            <div className={styles.reminderDaysRow}>
                              <label className={styles.reminderTimeLabel}>Mois</label>
                              <div className={styles.cyclePills}>
                                {BIMONTHLY_CYCLES.map((c) => (
                                  <button
                                    key={c.start}
                                    className={`${styles.cyclePill} ${(reminder.frequencyCycleStart ?? 1) === c.start ? styles.cycleActive : ""}`}
                                    onClick={() => onNotifSettingsChange({
                                      ...notifSettings,
                                      reminders: notifSettings.reminders.map((r) =>
                                        r.id === reminder.id ? { ...r, frequencyCycleStart: c.start } : r
                                      ),
                                    })}
                                  >
                                    {c.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {reminder.frequency === "quarterly" && (
                            <div className={styles.reminderDaysRow}>
                              <label className={styles.reminderTimeLabel}>Mois</label>
                              <div className={styles.cyclePills}>
                                {QUARTERLY_CYCLES.map((c) => (
                                  <button
                                    key={c.start}
                                    className={`${styles.cyclePill} ${(reminder.frequencyCycleStart ?? 1) === c.start ? styles.cycleActive : ""}`}
                                    onClick={() => onNotifSettingsChange({
                                      ...notifSettings,
                                      reminders: notifSettings.reminders.map((r) =>
                                        r.id === reminder.id ? { ...r, frequencyCycleStart: c.start } : r
                                      ),
                                    })}
                                  >
                                    {c.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {reminder.frequency === "biannual" && (
                            <div className={styles.reminderDaysRow}>
                              <label className={styles.reminderTimeLabel}>Mois</label>
                              <div className={styles.cyclePills}>
                                {BIANNUAL_CYCLES.map((c) => (
                                  <button
                                    key={c.start}
                                    className={`${styles.cyclePill} ${(reminder.frequencyCycleStart ?? 1) === c.start ? styles.cycleActive : ""}`}
                                    onClick={() => onNotifSettingsChange({
                                      ...notifSettings,
                                      reminders: notifSettings.reminders.map((r) =>
                                        r.id === reminder.id ? { ...r, frequencyCycleStart: c.start } : r
                                      ),
                                    })}
                                  >
                                    {c.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {reminder.frequency === "weekly" && (
                            <div className={styles.reminderDaysRow}>
                              <label className={styles.reminderTimeLabel}>Jour</label>
                              <div className={styles.dayPills}>
                                {DAY_LABELS.map((d) => (
                                  <button
                                    key={d.id}
                                    className={`${styles.dayPill} ${reminder.days[0] === d.id ? styles.dayActive : ""}`}
                                    onClick={() => onNotifSettingsChange({
                                      ...notifSettings,
                                      reminders: notifSettings.reminders.map((r) =>
                                        r.id === reminder.id ? { ...r, days: [d.id] } : r
                                      ),
                                    })}
                                  >
                                    {d.short}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className={styles.reminderDaysRow}>
                          <label className={styles.reminderTimeLabel}>Jours</label>
                          <div className={styles.dayPills}>
                            {DAY_LABELS.map((d) => (
                              <button
                                key={d.id}
                                className={`${styles.dayPill} ${reminder.days.includes(d.id) ? styles.dayActive : ""}`}
                                onClick={() => toggleReminderDay(reminder.id, d.id)}
                              >
                                {d.short}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button className={styles.testBtn} onClick={onTestNotification}>
              Tester une notification
            </button>
          </>
        )}
      </section>

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
                    <div className={styles.providerModels}>{provider.models.map((m) => m.name).join(", ")}</div>
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
                      {config.keyStatus === "validating" ? (
                        <>
                          <span className={`${styles.statusDot} ${styles.validating}`} />
                          <span className={styles.statusText}>Vérification en cours…</span>
                        </>
                      ) : config.keyStatus === "valid" ? (
                        <>
                          <span className={`${styles.statusDot} ${styles.saved}`} />
                          <span className={styles.statusText}>Clé valide</span>
                        </>
                      ) : config.keyStatus === "invalid" ? (
                        <>
                          <span className={`${styles.statusDot} ${styles.invalid}`} />
                          <span className={`${styles.statusText} ${styles.statusError}`}>Clé invalide — vérifie ta clé API</span>
                        </>
                      ) : config.apiKey ? (
                        <>
                          <span className={`${styles.statusDot} ${styles.missing}`} />
                          <span className={styles.statusText}>Clé non vérifiée</span>
                        </>
                      ) : (
                        <>
                          <span className={`${styles.statusDot} ${styles.missing}`} />
                          <span className={styles.statusText}>Aucune clé configurée</span>
                        </>
                      )}
                      {config.apiKey && config.keyStatus !== "validating" && (
                        <button
                          className={styles.retestBtn}
                          onClick={() => runValidation(provider.id, config.apiKey)}
                        >
                          Re-tester
                        </button>
                      )}
                    </div>
                    {config.apiKey && config.keyStatus === "valid" && (
                      <div className={styles.modelsList}>
                        <div className={styles.modelsLabel}>Modèles disponibles</div>
                        <div className={styles.modelTags}>
                          {provider.models.map((m) => (
                            <span key={m.id} className={styles.modelTag}>{m.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
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
