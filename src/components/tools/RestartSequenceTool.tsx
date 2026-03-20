import { useState } from "react";
import styles from "../ToolboxView.module.css";

interface RestartStep {
  icon: string;
  title: string;
  detail: string;
}

const RESTART_STEPS: RestartStep[] = [
  {
    icon: "🛑",
    title: "Stop — accepte la pause",
    detail: "Pas de culpabilité. Tu as décroché, c'est normal. Prends 5 secondes pour respirer.",
  },
  {
    icon: "🪟",
    title: "Ferme le bruit",
    detail: "Ferme les onglets inutiles, les apps de chat, les notifications. Dégage ton espace.",
  },
  {
    icon: "💧",
    title: "Bois un verre d'eau",
    detail: "Lève-toi, bouge 30 secondes, hydrate-toi. Ton cerveau en a besoin.",
  },
  {
    icon: "🎯",
    title: "Nomme UNE seule tâche",
    detail: "Dis à voix haute (ou dans ta tête) : « Là, maintenant, je fais… ». Une seule chose.",
  },
  {
    icon: "🪜",
    title: "Choisis le plus petit pas",
    detail: "Quel est le micro-geste le plus facile pour commencer ? Juste ouvrir le fichier, écrire une phrase…",
  },
  {
    icon: "⏱️",
    title: "Lance un timer de 10 min",
    detail: "Pas 25 min, pas 1h. Juste 10 min. Tu peux tout supporter pendant 10 min.",
  },
];

export default function RestartSequenceTool() {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [currentStep, setCurrentStep] = useState(0);

  const toggleStep = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
    if (!checked.has(idx) && idx === currentStep && currentStep < RESTART_STEPS.length - 1) {
      setTimeout(() => setCurrentStep((s) => Math.max(s, idx + 1)), 300);
    }
  };

  const allDone = checked.size === RESTART_STEPS.length;

  const handleReset = () => {
    setChecked(new Set());
    setCurrentStep(0);
  };

  return (
    <>
      <div className={styles.toolViewTitle}>Séquence de redémarrage</div>
      <div className={styles.toolViewDesc}>
        Tu as décroché, tu tournes en rond, tu scrolles… Pas grave. Suis ces étapes une par une pour te relancer.
      </div>
      <div className={styles.restartContainer}>
        {allDone && (
          <div className={styles.restartDone}>
            <span className={styles.restartDoneIcon}>🚀</span>
            <div>
              <div className={styles.restartDoneTitle}>C'est reparti !</div>
              <div className={styles.restartDoneText}>
                Tu as tout fait. Maintenant, lance-toi — juste 10 minutes.
              </div>
            </div>
          </div>
        )}

        <div className={styles.restartSteps}>
          {RESTART_STEPS.map((step, i) => {
            const isDone = checked.has(i);
            const isActive = i <= currentStep || isDone;
            return (
              <button
                key={i}
                className={`${styles.restartStep} ${isDone ? styles.restartStepDone : ""} ${!isActive ? styles.restartStepLocked : ""}`}
                onClick={() => isActive && toggleStep(i)}
                disabled={!isActive}
              >
                <div className={styles.restartStepCheck}>
                  {isDone ? "✓" : i + 1}
                </div>
                <div className={styles.restartStepContent}>
                  <div className={styles.restartStepHeader}>
                    <span className={styles.restartStepIcon}>{step.icon}</span>
                    <span className={styles.restartStepTitle}>{step.title}</span>
                  </div>
                  {isActive && (
                    <div className={styles.restartStepDetail}>{step.detail}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {checked.size > 0 && (
          <div className={styles.restartActions}>
            <button
              className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
              onClick={handleReset}
            >
              Recommencer
            </button>
          </div>
        )}
      </div>
    </>
  );
}
