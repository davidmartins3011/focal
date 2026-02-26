import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "../types";
import {
  initialMessages,
  decompositionReplies,
  genericReplies,
  chatHints,
} from "../data/mockChat";
import styles from "./ChatPanel.module.css";

function isDecomposeRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("décompose") ||
    lower.includes("decompose") ||
    lower.includes("découpe") ||
    lower.includes("micro-étape") ||
    lower.includes("étapes pour")
  );
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [revealingMsgId, setRevealingMsgId] = useState<string | null>(null);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyIdx = useRef(0);
  const decompIdx = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, visibleStepCount]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setIsTyping(true);
    const isDecomp = isDecomposeRequest(text);
    const thinkTime = isDecomp ? 1600 : 800;

    setTimeout(() => {
      setIsTyping(false);

      if (isDecomp) {
        const decomp =
          decompositionReplies[decompIdx.current % decompositionReplies.length];
        decompIdx.current++;

        const msgId = (Date.now() + 1).toString();
        const aiMsg: ChatMessage = {
          id: msgId,
          role: "ai",
          content: decomp.content,
          steps: decomp.steps,
        };
        setMessages((prev) => [...prev, aiMsg]);

        setRevealingMsgId(msgId);
        setVisibleStepCount(0);

        decomp.steps.forEach((_, i) => {
          setTimeout(() => setVisibleStepCount(i + 1), 350 * (i + 1));
        });
        setTimeout(() => {
          setRevealingMsgId(null);
        }, 350 * decomp.steps.length + 300);
      } else {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: genericReplies[replyIdx.current % genericReplies.length],
        };
        replyIdx.current++;
        setMessages((prev) => [...prev, aiMsg]);
      }
    }, thinkTime);
  }, [input, isTyping]);

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
        <div className={styles.modelSelector}>
          <div className={styles.modelDot} />
          Claude 3.5 ▾
        </div>
      </div>

      <div className={styles.messages}>
        <div className={styles.dayDivider}>
          <span>Aujourd'hui</span>
        </div>

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
                  <button
                    className={`${styles.addToTasks} ${
                      isRevealing ? styles.stepHidden : styles.stepVisible
                    }`}
                  >
                    ＋ Ajouter ces étapes à la tâche
                  </button>
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
