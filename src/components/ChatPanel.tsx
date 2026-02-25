import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "../types";
import styles from "./ChatPanel.module.css";

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "ai",
    content:
      "Bonjour David 👋 Tu as 7 tâches aujourd'hui et une revue de sprint vendredi. Je te suggère de commencer par la préparer — il te reste 2 étapes.\n\nComment je peux t'aider ?",
  },
  {
    id: "2",
    role: "user",
    content:
      "J'ai besoin de déboguer le bug pipeline dbt sur la table orders. Je sais pas par où commencer.",
  },
  {
    id: "3",
    role: "ai",
    content: "Pas de panique. Je découpe ça :",
    steps: [
      { text: "Lancer <code>dbt test --select orders</code> et noter l'erreur exacte" },
      { text: "Vérifier les logs dans <code>target/run_results.json</code>" },
      { text: "Identifier si l'erreur vient du modèle source ou d'une transformation en aval" },
      { text: "Colle-moi l'erreur ici — je t'aide à la résoudre" },
    ],
  },
  {
    id: "4",
    role: "user",
    content:
      "Prépare-moi aussi ma revue de fin de journée. J'ai du mal à bien terminer mes journées.",
  },
  {
    id: "5",
    role: "ai",
    content:
      "Bonne initiative. Ce soir à 17h30 je te propose une revue de 10 minutes : ce que tu as fait, ce qui reste, et ton top 3 pour demain.\n\nTu veux que je l'active en mode <strong>proactif</strong> (je t'envoie un rappel) ou tu le lances toi-même ?",
  },
];

const decompositionReplies = [
  {
    content: "Je découpe ça en étapes claires :",
    steps: [
      { text: "Identifier l'objectif précis — qu'est-ce qui est « fini » ?" },
      { text: "Lister les 2-3 blocages potentiels avant de commencer" },
      { text: "Faire la première micro-action (< 5 min) pour créer du momentum" },
    ],
  },
  {
    content: "Voilà comment je structurerais ça :",
    steps: [
      { text: "Rassembler les infos nécessaires (docs, contacts, données)" },
      { text: "Définir le livrable minimal — juste l'essentiel" },
      { text: "Bloquer 25 min focus dans ton calendrier pour l'exécuter" },
    ],
  },
  {
    content: "Pas de panique, on découpe :",
    steps: [
      { text: "Écrire en une phrase ce que tu veux accomplir" },
      { text: "Trouver la toute première action concrète (ouvrir un fichier, envoyer un message...)" },
      { text: "La faire maintenant — le reste viendra" },
    ],
  },
];

const genericReplies = [
  "Pas de panique. Commence par la partie la plus petite, celle que tu peux faire en moins de 5 minutes.",
  "Je note ça. Veux-tu que je le décompose en étapes actionnables ?",
  "Bonne question. Donne-moi un peu plus de contexte et je t'aide à débloquer ça.",
  "Noté ! Je l'ajoute à ta liste et je te rappellerai ce soir lors de ta revue.",
  "Tu sembles bloqué. Dis-moi la toute première micro-étape que tu peux faire maintenant, même petite.",
];

const hints = [
  { label: "Décomposer une tâche", text: "Décompose cette tâche pour moi : " },
  { label: "Plan du jour", text: "Plan du jour" },
  { label: "Je suis bloqué", text: "Je suis bloqué sur..." },
  { label: "Revue du soir", text: "Lance ma revue du soir" },
];

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
              stroke="#131316"
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
          {hints.map((hint) => (
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
