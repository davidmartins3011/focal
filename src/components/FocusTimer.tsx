import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./FocusTimer.module.css";

type TimerPhase = "running" | "paused" | "nudge" | "done";

interface Props {
  taskName: string;
  estimatedMinutes: number;
  nextTaskName?: string;
  onComplete: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

const EXTEND_MINUTES = 5;
const CIRCLE_RADIUS = 58;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const DONE_MESSAGES = [
  "Bravo, c'est bouclé !",
  "Bien joué — une de moins.",
  "Tâche terminée, tu gères.",
  "Validé. Tu avances bien.",
  "Nickel, on passe à la suite.",
];

const PAUSE_MESSAGES = [
  "Pause méritée. Reviens quand tu veux.",
  "Respire un coup. Pas de pression.",
  "C'est normal de faire une pause.",
  "Ton cerveau a besoin de souffler.",
];

const NUDGE_MESSAGES = [
  "Le temps est écoulé — tu as terminé ?",
  "Fin du timer ! Comment ça s'est passé ?",
  "Temps écoulé. On fait le point ?",
];

function formatTime(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  const sign = seconds < 0 ? "+" : "";
  return `${sign}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function FocusTimer({
  taskName,
  estimatedMinutes,
  nextTaskName,
  onComplete,
  onSkip,
  onCancel,
}: Props) {
  const totalSeconds = estimatedMinutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [phase, setPhase] = useState<TimerPhase>("running");
  const [elapsed, setElapsed] = useState(0);
  const [doneMessage] = useState(() => DONE_MESSAGES[Math.floor(Math.random() * DONE_MESSAGES.length)]);
  const [pauseMessage] = useState(() => PAUSE_MESSAGES[Math.floor(Math.random() * PAUSE_MESSAGES.length)]);
  const [nudgeMessage] = useState(() => NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (phase === "running") {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          const next = prev - 1;
          if (next <= 0 && prev > 0) {
            setPhase("nudge");
          }
          return next;
        });
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [phase, clearTimer]);

  const progress = Math.max(0, Math.min(1, 1 - remaining / totalSeconds));
  const strokeOffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

  const handlePause = () => setPhase("paused");
  const handleResume = () => setPhase("running");

  const handleDone = () => {
    clearTimer();
    setPhase("done");
  };

  const handleExtend = () => {
    setRemaining(EXTEND_MINUTES * 60);
    setPhase("running");
  };

  const elapsedMinutes = Math.ceil(elapsed / 60);

  return (
    <div className={`${styles.timer} ${phase === "done" ? styles.timerDone : ""}`}>
      {phase !== "done" && (
        <button className={styles.cancelBtn} onClick={onCancel} title="Annuler">
          ✕
        </button>
      )}

      {/* ── Active timer (running / paused / nudge) ── */}
      {phase !== "done" && (
        <>
          <div className={styles.label}>
            <span className={`${styles.pulse} ${phase === "paused" ? styles.pulsePaused : ""}`} />
            {phase === "paused" ? "En pause" : phase === "nudge" ? "Temps écoulé" : "Focus en cours"}
          </div>

          <div className={styles.ringWrap}>
            <svg className={styles.ring} viewBox="0 0 132 132">
              <circle
                className={styles.ringBg}
                cx="66" cy="66" r={CIRCLE_RADIUS}
                strokeWidth="4"
                fill="none"
              />
              <circle
                className={`${styles.ringProgress} ${phase === "nudge" ? styles.ringNudge : ""}`}
                cx="66" cy="66" r={CIRCLE_RADIUS}
                strokeWidth="4"
                fill="none"
                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                transform="rotate(-90 66 66)"
              />
            </svg>
            <div className={styles.ringCenter}>
              <div className={`${styles.time} ${remaining < 0 ? styles.timeOver : ""}`}>
                {formatTime(remaining)}
              </div>
              <div className={styles.timeLabel}>
                {remaining < 0 ? "en dépassement" : `sur ${estimatedMinutes} min`}
              </div>
            </div>
          </div>

          <div className={styles.taskName}>{taskName}</div>

          {phase === "paused" && (
            <div className={styles.pauseMsg}>{pauseMessage}</div>
          )}

          {phase === "nudge" && (
            <div className={styles.nudgeMsg}>{nudgeMessage}</div>
          )}

          <div className={styles.actions}>
            {phase === "running" && (
              <>
                <button className={styles.btnSecondary} onClick={handlePause}>
                  Pause
                </button>
                <button className={styles.btnPrimary} onClick={handleDone}>
                  ✓ J'ai terminé
                </button>
              </>
            )}

            {phase === "paused" && (
              <>
                <button className={styles.btnSecondary} onClick={onSkip}>
                  Passer
                </button>
                <button className={styles.btnPrimary} onClick={handleResume}>
                  ▶ Reprendre
                </button>
              </>
            )}

            {phase === "nudge" && (
              <>
                <button className={styles.btnSecondary} onClick={handleExtend}>
                  +{EXTEND_MINUTES} min
                </button>
                <button className={styles.btnSecondary} onClick={onSkip}>
                  Passer
                </button>
                <button className={styles.btnPrimary} onClick={handleDone}>
                  ✓ J'ai terminé
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Completion ── */}
      {phase === "done" && (
        <div className={styles.doneWrap}>
          <div className={styles.doneCheck}>✓</div>
          <div className={styles.doneMessage}>{doneMessage}</div>
          <div className={styles.doneStats}>
            Durée réelle : {elapsedMinutes} min (estimé : {estimatedMinutes} min)
          </div>

          {nextTaskName ? (
            <div className={styles.nextTask}>
              <div className={styles.nextLabel}>Prochaine tâche</div>
              <div className={styles.nextName}>{nextTaskName}</div>
              <div className={styles.nextActions}>
                <button className={styles.btnSecondary} onClick={onComplete}>
                  Plus tard
                </button>
                <button className={styles.btnPrimary} onClick={onComplete}>
                  ▶ Enchaîner
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.allClear}>
              <span>Toutes les priorités sont terminées !</span>
              <button className={styles.btnPrimary} onClick={onComplete}>
                Fermer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
