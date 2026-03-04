import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, AISettings, Task, MicroStep } from "../types";
import { getChatMessages, sendMessage, sendDailyPrepMessage, sendWeeklyPrepMessage, clearChat, type DailyPrepResponse } from "../services/chat";
import { getTasks, createTask, deleteTask, updateTask, setMicroSteps } from "../services/tasks";
import { getSetting, setSetting } from "../services/settings";
import { chatHints } from "../data/chatConstants";
import { providers } from "../data/settingsData";
import styles from "./ChatPanel.module.css";

interface AvailableModel {
  id: string;
  name: string;
  providerName: string;
  providerIcon: string;
  providerIconBg: string;
}

function getAvailableModels(settings: AISettings): AvailableModel[] {
  const result: AvailableModel[] = [];
  for (const provider of providers) {
    const config = settings.providers.find((p) => p.id === provider.id);
    if (config?.enabled && config.apiKey && config.keyStatus === "valid") {
      for (const model of provider.models) {
        result.push({
          id: model.id,
          name: model.name,
          providerName: provider.name,
          providerIcon: provider.icon,
          providerIconBg: provider.iconBg,
        });
      }
    }
  }
  return result;
}

function parseAISettings(raw: string | null): { models: AvailableModel[]; selectedModel: string | null } | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as AISettings;
    const models = getAvailableModels(s);
    const selectedModel = s.selectedModel && models.some((m) => m.id === s.selectedModel) ? s.selectedModel : models[0]?.id ?? null;
    return { models, selectedModel };
  } catch {
    return null;
  }
}

interface ChatPanelProps {
  onStartOnboarding?: () => void;
  dailyPrepPending?: boolean;
  onDailyPrepConsumed?: () => void;
  weeklyPrepPending?: boolean;
  onWeeklyPrepConsumed?: () => void;
  onTasksChanged?: () => void;
}

export default function ChatPanel({ onStartOnboarding, dailyPrepPending, onDailyPrepConsumed, weeklyPrepPending, onWeeklyPrepConsumed, onTasksChanged }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealingMsgId, setRevealingMsgId] = useState<string | null>(null);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [prepMode, setPrepMode] = useState<"daily" | "weekly" | null>(null);
  const prepHistory = useRef<{ role: string; content: string }[]>([]);
  const todayTasksRef = useRef(todayTasks);
  todayTasksRef.current = todayTasks;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatMessages()
      .then(setMessages)
      .catch((err) => console.error("[ChatPanel] load error:", err));
    getTasks("today")
      .then(setTodayTasks)
      .catch(() => {});
    getSetting("ai-settings")
      .then((raw) => {
        const parsed = parseAISettings(raw);
        if (!parsed) return;
        setAvailableModels(parsed.models);
        setSelectedModelId(parsed.selectedModel);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      getSetting("ai-settings")
        .then((raw) => {
          const parsed = parseAISettings(raw);
          if (!parsed) return;
          setAvailableModels(parsed.models);
          setSelectedModelId((prev) => {
            if (prev && parsed.models.some((m) => m.id === prev)) return prev;
            return parsed.models[0]?.id ?? null;
          });
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!modelDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modelDropdownOpen]);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    setModelDropdownOpen(false);
    getSetting("ai-settings")
      .then((raw) => {
        if (!raw) return;
        try {
          const s = JSON.parse(raw) as AISettings;
          s.selectedModel = modelId;
          setSetting("ai-settings", JSON.stringify(s));
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, visibleStepCount]);

  const handlePrepResponse = useCallback(
    async (response: DailyPrepResponse) => {
      prepHistory.current.push({ role: "ai", content: response.content });

      const msgId = `ai-${Date.now()}`;
      const aiMsg: ChatMessage = { id: msgId, role: "ai", content: response.content };
      setMessages((prev) => [...prev, aiMsg]);

      let tasksModified = false;

      for (const t of response.tasksToAdd) {
        const alreadyExists = todayTasksRef.current.some(
          (existing) => existing.name.toLowerCase() === t.name.toLowerCase(),
        );
        if (alreadyExists) continue;

        try {
          const created = await createTask({
            name: t.name,
            context: "today",
            estimatedMinutes: t.estimatedMinutes,
            priority: t.priority,
            scheduledDate: t.scheduledDate,
          });
          setTodayTasks((prev) => [...prev, created]);
          tasksModified = true;
        } catch (err) {
          console.error("[ChatPanel] createTask error:", err);
        }
      }

      for (const taskId of response.tasksToRemove) {
        try {
          await deleteTask(taskId);
          setTodayTasks((prev) => prev.filter((t) => t.id !== taskId));
          tasksModified = true;
        } catch (err) {
          console.error("[ChatPanel] deleteTask error:", err);
        }
      }

      for (const upd of response.tasksToUpdate) {
        try {
          const updated = await updateTask({
            id: upd.id,
            priority: upd.priority,
            scheduledDate: upd.scheduledDate,
            estimatedMinutes: upd.estimatedMinutes,
          });
          setTodayTasks((prev) =>
            upd.scheduledDate
              ? prev.filter((t) => t.id !== upd.id)
              : prev.map((t) => (t.id === upd.id ? updated : t)),
          );
          tasksModified = true;
        } catch (err) {
          console.error("[ChatPanel] updateTask error:", err);
        }
      }

      if (tasksModified) {
        onTasksChanged?.();
      }

      if (response.prepComplete) {
        setPrepMode(null);
        prepHistory.current = [];
      }
    },
    [onTasksChanged],
  );

  const sendPrepMessage = useCallback(
    (text: string, mode: "daily" | "weekly" = "daily") => {
      if (isTyping) return;

      prepHistory.current.push({ role: "user", content: text });

      const userMsg: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setError(null);
      setIsTyping(true);

      const sendFn = mode === "weekly" ? sendWeeklyPrepMessage : sendDailyPrepMessage;
      sendFn(text, prepHistory.current.slice(0, -1))
        .then((response) => {
          setIsTyping(false);
          handlePrepResponse(response);
          textareaRef.current?.focus();
        })
        .catch((err) => {
          setIsTyping(false);
          const errMsg = typeof err === "string" ? err : String(err);
          setError(errMsg);
          console.error(`[ChatPanel] ${mode} prep error:`, err);
        });
    },
    [isTyping, handlePrepResponse],
  );

  const startDailyPrep = useCallback(() => {
    if (isTyping) return;
    setPrepMode("daily");
    prepHistory.current = [];
    textareaRef.current?.focus();
    sendPrepMessage("C'est parti ! Fais-moi un résumé de ce qui est déjà prévu pour aujourd'hui, et on ajuste ensemble.", "daily");
  }, [isTyping, sendPrepMessage]);

  const startWeeklyPrep = useCallback(() => {
    if (isTyping) return;
    setPrepMode("weekly");
    prepHistory.current = [];
    textareaRef.current?.focus();
    sendPrepMessage("C'est parti ! Fais-moi un résumé de ce qui est prévu pour cette semaine, et on organise ensemble.", "weekly");
  }, [isTyping, sendPrepMessage]);

  useEffect(() => {
    if (!dailyPrepPending) return;
    onDailyPrepConsumed?.();
    startDailyPrep();
  }, [dailyPrepPending, startDailyPrep, onDailyPrepConsumed]);

  useEffect(() => {
    if (!weeklyPrepPending) return;
    onWeeklyPrepConsumed?.();
    startWeeklyPrep();
  }, [weeklyPrepPending, startWeeklyPrep, onWeeklyPrepConsumed]);

  const resetInput = useCallback(() => {
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    if (text === "/start-onboarding" && onStartOnboarding) {
      resetInput();
      onStartOnboarding();
      return;
    }

    if (text === "/start-day") {
      resetInput();
      startDailyPrep();
      return;
    }

    if (text === "/start-week") {
      resetInput();
      startWeeklyPrep();
      return;
    }

    if (text === "/clear") {
      resetInput();
      setMessages([]);
      setPrepMode(null);
      prepHistory.current = [];
      setError(null);
      clearChat().catch((err) => console.error("[ChatPanel] clearChat error:", err));
      return;
    }

    resetInput();

    if (prepMode) {
      sendPrepMessage(text, prepMode);
      return;
    }

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setError(null);
    setIsTyping(true);

    sendMessage(text)
      .then((response) => {
        setIsTyping(false);

        const msgId = `ai-${Date.now()}`;
        const steps = response.steps?.map((s) => ({ text: s }));
        const aiMsg: ChatMessage = {
          id: msgId,
          role: "ai",
          content: response.content,
          steps,
        };
        setMessages((prev) => [...prev, aiMsg]);

        if (steps && steps.length > 0) {
          setRevealingMsgId(msgId);
          setVisibleStepCount(0);
          steps.forEach((_, i) => {
            setTimeout(() => setVisibleStepCount(i + 1), 350 * (i + 1));
          });
          setTimeout(() => setRevealingMsgId(null), 350 * steps.length + 300);
        }
      })
      .catch((err) => {
        setIsTyping(false);
        const errMsg = typeof err === "string" ? err : String(err);
        setError(errMsg);
        console.error("[ChatPanel] sendMessage error:", err);
      });
  }, [input, isTyping, prepMode, onStartOnboarding, startDailyPrep, startWeeklyPrep, sendPrepMessage, resetInput]);

  const addStepsToTask = useCallback((msgId: string, taskId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg?.steps) return;

    const steps: MicroStep[] = msg.steps.map((s, i) => ({
      id: `${taskId}-chat${i}`,
      text: s.text,
      done: false,
    }));

    setMicroSteps(taskId, steps)
      .then(() => {
        setPickingFor(null);
        setTodayTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, microSteps: steps, aiDecomposed: true } : t))
        );
      })
      .catch((err) => console.error("[ChatPanel] addSteps error:", err));
  }, [messages]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }

  return (
    <>
      <div className={styles.header}>
        <div className={styles.title}>
          <div className={styles.avatar}>⚡</div>
          <div>
            <h3>focal. assistant</h3>
            <p className={styles.status}>
              <span className={styles.statusDot} />
              En ligne
            </p>
          </div>
        </div>
        {availableModels.length > 0 ? (
          <div className={styles.modelSelectorWrap} ref={dropdownRef}>
            <button
              className={styles.modelSelector}
              onClick={() => setModelDropdownOpen((v) => !v)}
            >
              {(() => {
                const sel = availableModels.find((m) => m.id === selectedModelId);
                if (!sel) return <>Choisir un modèle</>;
                return (
                  <>
                    <span
                      className={styles.modelProviderIcon}
                      style={{ background: sel.providerIconBg }}
                    >
                      {sel.providerIcon}
                    </span>
                    {sel.name}
                    <svg className={`${styles.chevron} ${modelDropdownOpen ? styles.chevronOpen : ""}`} width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </>
                );
              })()}
            </button>
            {modelDropdownOpen && (
              <div className={styles.modelDropdown}>
                {(() => {
                  const groups: Record<string, AvailableModel[]> = {};
                  for (const m of availableModels) {
                    (groups[m.providerName] ??= []).push(m);
                  }
                  return Object.entries(groups).map(([providerName, models]) => (
                    <div key={providerName} className={styles.modelGroup}>
                      <div className={styles.modelGroupLabel}>
                        <span
                          className={styles.modelGroupIcon}
                          style={{ background: models[0].providerIconBg }}
                        >
                          {models[0].providerIcon}
                        </span>
                        {providerName}
                      </div>
                      {models.map((m) => (
                        <button
                          key={m.id}
                          className={`${styles.modelOption} ${m.id === selectedModelId ? styles.modelOptionActive : ""}`}
                          onClick={() => handleSelectModel(m.id)}
                        >
                          {m.name}
                          {m.id === selectedModelId && <span className={styles.modelCheck}>✓</span>}
                        </button>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.modelSelectorEmpty}>
            Aucune IA configurée
          </div>
        )}
      </div>

      <div className={styles.messages}>
        {messages.length > 0 && (
          <div className={styles.dayDivider}>
            <span>Conversation</span>
          </div>
        )}

        {messages.length === 0 && !isTyping && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>⚡</span>
            <p>Parle-moi d'une tâche, d'un blocage, ou demande-moi de préparer ta journée.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isRevealing = msg.id === revealingMsgId;

          return (
            <div key={msg.id} className={`${styles.msg} ${styles[msg.role]}`}>
              <div className={styles.msgRole}>
                {msg.role === "ai" ? "focal." : "Toi"}
              </div>
              <div
                className={styles.msgBubble}
                dangerouslySetInnerHTML={{
                  __html: msg.content.replace(/\n/g, "<br/>"),
                }}
              />
              {msg.steps && (
                <div className={styles.msgSteps}>
                  {msg.steps.map((step, i) => {
                    const visible = !isRevealing || i < visibleStepCount;
                    return (
                      <div
                        key={i}
                        className={`${styles.msgStep} ${
                          visible ? styles.stepVisible : styles.stepHidden
                        }`}
                      >
                        <div className={styles.stepNum}>{i + 1}</div>
                        <div
                          className={styles.stepContent}
                          dangerouslySetInnerHTML={{ __html: step.text }}
                        />
                      </div>
                    );
                  })}
                  {pickingFor === msg.id ? (
                    <div className={`${styles.taskPicker} ${styles.stepVisible}`}>
                      <div className={styles.taskPickerLabel}>Associer à quelle tâche ?</div>
                      {todayTasks.filter((t) => !t.done).map((t) => (
                        <button
                          key={t.id}
                          className={styles.taskPickerItem}
                          onClick={() => addStepsToTask(msg.id, t.id)}
                        >
                          {t.name}
                        </button>
                      ))}
                      <button
                        className={styles.taskPickerCancel}
                        onClick={() => setPickingFor(null)}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      className={`${styles.addToTasks} ${
                        isRevealing ? styles.stepHidden : styles.stepVisible
                      }`}
                      onClick={() => setPickingFor(msg.id)}
                    >
                      ＋ Ajouter ces étapes à la tâche
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

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

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputBox}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Parle-moi d'une tâche bloquante, de ta journée..."
            rows={1}
          />
          <button className={styles.sendBtn} onClick={send} disabled={isTyping}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className={styles.hints}>
          {chatHints.map((hint) => (
            <button
              key={hint.label}
              className={styles.hintPill}
              onClick={() => {
                setInput(hint.text);
                textareaRef.current?.focus();
              }}
            >
              {hint.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
