import { useState } from "react";
import styles from "../ToolboxView.module.css";

interface WoopStep {
  key: string;
  letter: string;
  title: string;
  subtitle: string;
  placeholder: string;
}

const WOOP_STEPS: WoopStep[] = [
  {
    key: "wish",
    letter: "W",
    title: "Wish — Souhait",
    subtitle: "Quel est ton objectif ou souhait le plus important en ce moment ?",
    placeholder: "Ex : Finir le MVP de mon projet avant vendredi…",
  },
  {
    key: "outcome",
    letter: "O",
    title: "Outcome — Résultat",
    subtitle: "Imagine le meilleur résultat possible. Que ressens-tu ? Que vois-tu ?",
    placeholder: "Ex : Je me sens soulagé, fier, l'équipe est contente…",
  },
  {
    key: "obstacle",
    letter: "O",
    title: "Obstacle",
    subtitle: "Quel est l'obstacle intérieur principal qui pourrait t'empêcher d'y arriver ?",
    placeholder: "Ex : Je procrastine quand la tâche est floue, je perds du temps sur Slack…",
  },
  {
    key: "plan",
    letter: "P",
    title: "Plan — Si… alors…",
    subtitle: "Formule un plan concret : « Si [obstacle], alors je [action]. »",
    placeholder: "Ex : Si je sens que je procrastine, alors je décompose en micro-étape de 5 min…",
  },
];

export default function WoopTool() {
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>(["", "", "", ""]);
  const [done, setDone] = useState(false);

  const current = WOOP_STEPS[stepIdx];

  const handleChange = (value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[stepIdx] = value;
      return next;
    });
  };

  const handleNext = () => {
    if (stepIdx + 1 < WOOP_STEPS.length) {
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
    setAnswers(["", "", "", ""]);
    setDone(false);
  };

  return (
    <>
      <div className={styles.toolViewTitle}>Méthode WOOP</div>
      <div className={styles.toolViewDesc}>
        4 étapes pour transformer un souhait en plan d'action concret. Technique validée par la recherche en psychologie.
      </div>
      <div className={styles.woopContainer}>
        {done ? (
          <div className={styles.woopDone}>
            <div className={styles.woopDoneIcon}>✅</div>
            <div className={styles.woopDoneTitle}>Ton plan WOOP est prêt</div>
            <div className={styles.woopSummary}>
              {WOOP_STEPS.map((step, i) => (
                <div key={step.key} className={styles.woopSummaryItem}>
                  <div className={styles.woopSummaryLetter}>{step.letter}</div>
                  <div className={styles.woopSummaryContent}>
                    <div className={styles.woopSummaryLabel}>{step.title.split(" — ")[0]}</div>
                    <div className={styles.woopSummaryText}>{answers[i]}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.woopSummaryHint}>
              Rappelle-toi de ton « Si… alors… » quand l'obstacle se présente.
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
            <div className={styles.woopProgress}>
              {WOOP_STEPS.map((step, i) => (
                <div
                  key={step.key}
                  className={`${styles.woopDot} ${i < stepIdx ? styles.woopDotDone : ""} ${i === stepIdx ? styles.woopDotActive : ""}`}
                >
                  {step.letter}
                </div>
              ))}
            </div>

            <div className={styles.woopCard}>
              <div className={styles.woopCardLetter}>{current.letter}</div>
              <div className={styles.woopCardTitle}>{current.title}</div>
              <div className={styles.woopCardSubtitle}>{current.subtitle}</div>
              <textarea
                className={styles.woopTextarea}
                value={answers[stepIdx]}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={current.placeholder}
                autoFocus
              />
            </div>

            <div className={styles.woopNav}>
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
                disabled={!answers[stepIdx].trim()}
              >
                {stepIdx + 1 < WOOP_STEPS.length ? "Suivant →" : "Terminer ✓"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
