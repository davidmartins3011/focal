import { useState, useEffect, useRef, useCallback } from "react";
import styles from "../ToolboxView.module.css";

type BreathingPattern = {
  id: string;
  label: string;
  phases: { label: string; duration: number }[];
};

const BREATHING_PATTERNS: BreathingPattern[] = [
  {
    id: "box",
    label: "Box Breathing (4-4-4-4)",
    phases: [
      { label: "Inspire", duration: 4 },
      { label: "Retiens", duration: 4 },
      { label: "Expire", duration: 4 },
      { label: "Retiens", duration: 4 },
    ],
  },
  {
    id: "478",
    label: "Relaxation (4-7-8)",
    phases: [
      { label: "Inspire", duration: 4 },
      { label: "Retiens", duration: 7 },
      { label: "Expire", duration: 8 },
    ],
  },
  {
    id: "calm",
    label: "Cohérence cardiaque (5-5)",
    phases: [
      { label: "Inspire", duration: 5 },
      { label: "Expire", duration: 5 },
    ],
  },
];

const CYCLE_OPTIONS = [3, 5, 8, 10];

export default function BreathingTool() {
  const [patternIdx, setPatternIdx] = useState(0);
  const [targetCycles, setTargetCycles] = useState(5);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pattern = BREATHING_PATTERNS[patternIdx];
  const phase = pattern.phases[phaseIdx];

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cyclesRef = useRef(cycles);
  cyclesRef.current = cycles;

  useEffect(() => {
    if (!running) {
      clearTimer();
      return;
    }

    setCountdown(pattern.phases[phaseIdx].duration);

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setPhaseIdx((pi) => {
            const next = pi + 1;
            if (next >= pattern.phases.length) {
              const newCycles = cyclesRef.current + 1;
              setCycles(newCycles);
              if (newCycles >= targetCycles) {
                clearTimer();
                setRunning(false);
                setFinished(true);
              }
              return 0;
            }
            return next;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, phaseIdx, patternIdx, clearTimer, pattern.phases, targetCycles]);

  useEffect(() => {
    if (running && countdown === 0 && !finished) {
      setCountdown(pattern.phases[phaseIdx].duration);
    }
  }, [phaseIdx, running, countdown, pattern.phases, finished]);

  const handleStart = () => {
    setPhaseIdx(0);
    setCycles(0);
    setCountdown(pattern.phases[0].duration);
    setFinished(false);
    setRunning(true);
  };

  const handleStop = () => {
    clearTimer();
    setRunning(false);
    setPhaseIdx(0);
    setCountdown(0);
  };

  const handleNewSession = () => {
    setFinished(false);
    setPhaseIdx(0);
    setCycles(0);
    setCountdown(0);
  };

  const isExpanding = phase.label === "Inspire";
  const isHolding = phase.label === "Retiens";
  const circleScale = running
    ? isExpanding
      ? 1 + (1 - countdown / phase.duration) * 0.4
      : isHolding
        ? phaseIdx > 0 && pattern.phases[phaseIdx - 1].label === "Inspire"
          ? 1.4
          : 1
        : 1 + (countdown / phase.duration) * 0.4
    : 1;

  const cycleDuration = pattern.phases.reduce((sum, p) => sum + p.duration, 0);
  const totalSeconds = cycleDuration * targetCycles;
  const totalMinLabel = totalSeconds >= 60
    ? `≈ ${Math.round(totalSeconds / 60)} min`
    : `${totalSeconds}s`;

  return (
    <>
      <div className={styles.toolViewTitle}>Respiration guidée</div>
      <div className={styles.toolViewDesc}>
        Choisis un rythme et un nombre de cycles, puis laisse-toi guider.
      </div>
      <div className={styles.breathingContainer}>
        {finished ? (
          <div className={styles.breathingFinished}>
            <div className={styles.breathingFinishedIcon}>✨</div>
            <div className={styles.breathingFinishedTitle}>Séance terminée</div>
            <div className={styles.breathingFinishedText}>
              {targetCycles} cycles de {pattern.label.split(" (")[0]} — bien joué.
              <br />Prends un instant avant de reprendre.
            </div>
            <div className={styles.breathingControls}>
              <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`} onClick={handleStart}>
                Relancer
              </button>
              <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStop}`} onClick={handleNewSession}>
                Nouvelle séance
              </button>
            </div>
          </div>
        ) : (
          <>
            {!running && (
              <>
                <div className={styles.breathingPatterns}>
                  {BREATHING_PATTERNS.map((p, i) => (
                    <button
                      key={p.id}
                      className={`${styles.breathingPatternBtn} ${patternIdx === i ? styles.breathingPatternActive : ""}`}
                      onClick={() => setPatternIdx(i)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className={styles.breathingCyclesPicker}>
                  <div className={styles.breathingCyclesLabel}>Nombre de cycles</div>
                  <div className={styles.breathingCyclesOptions}>
                    {CYCLE_OPTIONS.map((n) => (
                      <button
                        key={n}
                        className={`${styles.breathingCycleOption} ${targetCycles === n ? styles.breathingCycleOptionActive : ""}`}
                        onClick={() => setTargetCycles(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className={styles.breathingDurationHint}>
                    Durée estimée : {totalMinLabel}
                  </div>
                </div>
              </>
            )}

            <div className={styles.breathingVisual}>
              <div
                className={`${styles.breathingCircle} ${running ? styles.breathingCircleActive : ""}`}
                style={{ transform: `scale(${circleScale})` }}
              >
                {running ? (
                  <>
                    <div className={styles.breathingPhaseLabel}>{phase.label}</div>
                    <div className={styles.breathingCountdown}>{countdown}</div>
                  </>
                ) : (
                  <div className={styles.breathingPhaseLabel}>Prêt</div>
                )}
              </div>
            </div>

            {running && (
              <div className={styles.breathingSessionProgress}>
                <div className={styles.breathingSessionBar}>
                  <div
                    className={styles.breathingSessionFill}
                    style={{ width: `${(cycles / targetCycles) * 100}%` }}
                  />
                </div>
                <span className={styles.breathingSessionLabel}>
                  {cycles} / {targetCycles} cycles
                </span>
              </div>
            )}

            <div className={styles.breathingControls}>
              {running ? (
                <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStop}`} onClick={handleStop}>
                  Arrêter
                </button>
              ) : (
                <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`} onClick={handleStart}>
                  Commencer
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
