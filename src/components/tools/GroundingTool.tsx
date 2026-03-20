import { useState } from "react";
import styles from "../ToolboxView.module.css";

interface GroundingSense {
  count: number;
  sense: string;
  emoji: string;
  prompt: string;
}

const GROUNDING_SENSES: GroundingSense[] = [
  { count: 5, sense: "vue", emoji: "👁️", prompt: "Nomme 5 choses que tu vois autour de toi." },
  { count: 4, sense: "toucher", emoji: "✋", prompt: "Nomme 4 choses que tu peux toucher." },
  { count: 3, sense: "ouïe", emoji: "👂", prompt: "Nomme 3 sons que tu entends." },
  { count: 2, sense: "odorat", emoji: "👃", prompt: "Nomme 2 odeurs que tu perçois." },
  { count: 1, sense: "goût", emoji: "👅", prompt: "Nomme 1 goût que tu ressens (ou imagine)." },
];

export default function GroundingTool() {
  const [stepIdx, setStepIdx] = useState(0);
  const [inputs, setInputs] = useState<string[][]>(
    GROUNDING_SENSES.map((s) => Array(s.count).fill("")),
  );
  const [done, setDone] = useState(false);

  const current = GROUNDING_SENSES[stepIdx];
  const currentInputs = inputs[stepIdx];
  const filledCount = currentInputs.filter((v) => v.trim()).length;
  const canNext = filledCount >= current.count;

  const handleInputChange = (itemIdx: number, value: string) => {
    setInputs((prev) => {
      const next = prev.map((arr) => [...arr]);
      next[stepIdx][itemIdx] = value;
      return next;
    });
  };

  const handleNext = () => {
    if (stepIdx + 1 < GROUNDING_SENSES.length) {
      setStepIdx((s) => s + 1);
    } else {
      setDone(true);
    }
  };

  const handleBack = () => {
    if (stepIdx > 0) setStepIdx((s) => s - 1);
  };

  const handleReset = () => {
    setStepIdx(0);
    setInputs(GROUNDING_SENSES.map((s) => Array(s.count).fill("")));
    setDone(false);
  };

  return (
    <>
      <div className={styles.toolViewTitle}>Ancrage 5-4-3-2-1</div>
      <div className={styles.toolViewDesc}>
        Quand ton esprit s'emballe, ramène-le au présent. Utilise tes 5 sens, un par un.
      </div>
      <div className={styles.groundingContainer}>
        {done ? (
          <div className={styles.groundingDone}>
            <div className={styles.groundingDoneIcon}>🧘</div>
            <div className={styles.groundingDoneTitle}>Tu es ancré.</div>
            <div className={styles.groundingDoneText}>
              Ton attention est revenue au présent. Prends un instant, puis choisis une seule chose à faire.
            </div>
            <button
              className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
              onClick={handleReset}
              style={{ marginTop: 16 }}
            >
              Recommencer
            </button>
          </div>
        ) : (
          <>
            <div className={styles.groundingProgress}>
              {GROUNDING_SENSES.map((s, i) => (
                <div
                  key={i}
                  className={`${styles.groundingDot} ${i < stepIdx ? styles.groundingDotDone : ""} ${i === stepIdx ? styles.groundingDotActive : ""}`}
                >
                  {s.emoji}
                </div>
              ))}
            </div>

            <div className={styles.groundingSenseCard}>
              <div className={styles.groundingSenseEmoji}>{current.emoji}</div>
              <div className={styles.groundingSensePrompt}>{current.prompt}</div>
              <div className={styles.groundingInputs}>
                {currentInputs.map((val, i) => (
                  <input
                    key={`${stepIdx}-${i}`}
                    className={styles.groundingInput}
                    value={val}
                    onChange={(e) => handleInputChange(i, e.target.value)}
                    placeholder={`${current.sense} ${i + 1}…`}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>

            <div className={styles.groundingNav}>
              {stepIdx > 0 && (
                <button
                  className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
                  onClick={handleBack}
                >
                  ← Précédent
                </button>
              )}
              <button
                className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`}
                onClick={handleNext}
                disabled={!canNext}
              >
                {stepIdx + 1 < GROUNDING_SENSES.length ? "Suivant →" : "Terminer ✓"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
