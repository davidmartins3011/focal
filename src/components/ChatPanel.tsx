import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, AISettings, AIProviderId, Task, MicroStep } from "../types";
import { getChatMessages, sendMessage } from "../services/chat";
import { getTasks } from "../services/tasks";
import { setMicroSteps } from "../services/tasks";
import { getSetting } from "../services/settings";
import { chatHints } from "../data/mockChat";
import styles from "./ChatPanel.module.css";

const PROVIDER_LABELS: Record<AIProviderId, string> = {
  openai: "GPT-4o",
  anthropic: "Claude Sonnet",
  mistral: "Mistral Large",
};

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealingMsgId, setRevealingMsgId] = useState<string | null>(null);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getChatMessages()
      .then(setMessages)
      .catch((err) => console.error("[ChatPanel] load error:", err));
    getTasks("today")
      .then(setTodayTasks)
      .catch(() => {});
    getSetting("ai-settings")
      .then((raw) => {
        if (!raw) return;
        try {
          const s = JSON.parse(raw) as AISettings;
          if (s.activeProvider) setActiveModel(PROVIDER_LABELS[s.activeProvider] ?? s.activeProvider);
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, visibleStepCount]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

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
  }, [input, isTyping]);

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
        {activeModel && (
          <div className={styles.modelSelector}>
            <div className={styles.modelDot} />
            {activeModel}
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
