import { useState } from "react";
import styles from "../ToolboxView.module.css";

export default function QuickDecisionTool() {
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const handleDecide = () => {
    if (!optionA.trim() || !optionB.trim()) return;

    setSpinning(true);
    setResult(null);

    setTimeout(() => {
      const chosen = Math.random() < 0.5 ? optionA.trim() : optionB.trim();
      setResult(chosen);
      setSpinning(false);
    }, 800);
  };

  const handleReset = () => {
    setOptionA("");
    setOptionB("");
    setResult(null);
  };

  return (
    <>
      <div className={styles.toolViewTitle}>Décision rapide</div>
      <div className={styles.toolViewDesc}>
        Entre deux options et laisse le sort décider. Parfois, il suffit de s'y mettre.
      </div>
      <div className={styles.quickDecision}>
        <div className={styles.decisionInputGroup}>
          <input
            className={styles.decisionInput}
            value={optionA}
            onChange={(e) => setOptionA(e.target.value)}
            placeholder="Option A…"
          />
          <input
            className={styles.decisionInput}
            value={optionB}
            onChange={(e) => setOptionB(e.target.value)}
            placeholder="Option B…"
          />
        </div>

        <button
          className={styles.decisionBtn}
          onClick={handleDecide}
          disabled={!optionA.trim() || !optionB.trim() || spinning}
        >
          {spinning ? "…" : "Lancer le dé"}
        </button>

        {result && (
          <div className={styles.decisionResult}>
            <div className={styles.decisionResultIcon}>🎯</div>
            <div className={styles.decisionResultText}>{result}</div>
            <div className={styles.decisionResultHint}>
              Si cette réponse te déçoit, c'est que tu voulais l'autre. Fais-le.
            </div>
            <button
              className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
              onClick={handleReset}
              style={{ marginTop: 12 }}
            >
              Recommencer
            </button>
          </div>
        )}
      </div>
    </>
  );
}
