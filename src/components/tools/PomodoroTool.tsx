import { useState, useEffect, useRef, useCallback } from "react";
import styles from "../ToolboxView.module.css";

const POMODORO_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60];
const BREAK_DURATION = 5 * 60;

export default function PomodoroTool() {
  const [workMinutes, setWorkMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const workDuration = workMinutes * 60;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!running) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setRunning(false);
          if (!onBreak) {
            setCompletedCount((c) => c + 1);
            setOnBreak(true);
            return BREAK_DURATION;
          } else {
            setOnBreak(false);
            return workDuration;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, onBreak, clearTimer, workDuration]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleToggle = () => setRunning((r) => !r);

  const handleReset = () => {
    clearTimer();
    setRunning(false);
    setOnBreak(false);
    setSecondsLeft(workDuration);
  };

  const handlePreset = (minutes: number) => {
    if (running) return;
    setWorkMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setOnBreak(false);
  };

  const timerClass = `${styles.pomodoroTimer} ${running ? (onBreak ? styles.onBreak : styles.running) : ""}`;

  return (
    <>
      <div className={styles.toolViewTitle}>Timer Pomodoro</div>
      <div className={styles.toolViewDesc}>
        Choisis ta durée de focus, puis lance le timer. Une pause de 5 min suit chaque cycle.
      </div>
      <div className={styles.pomodoro}>
        {!running && !onBreak && (
          <div className={styles.pomodoroPresets}>
            {POMODORO_PRESETS.map((m) => (
              <button
                key={m}
                className={`${styles.pomodoroPreset} ${workMinutes === m ? styles.pomodoroPresetActive : ""}`}
                onClick={() => handlePreset(m)}
              >
                {m} min
              </button>
            ))}
          </div>
        )}
        <div className={timerClass}>
          <div className={styles.pomodoroTime}>{formatTime(secondsLeft)}</div>
          <div className={styles.pomodoroLabel}>
            {onBreak ? "Pause" : "Focus"}
          </div>
        </div>
        <div className={styles.pomodoroControls}>
          <button
            className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`}
            onClick={handleToggle}
          >
            {running ? "Pause" : "Démarrer"}
          </button>
          <button
            className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStop}`}
            onClick={handleReset}
          >
            Réinitialiser
          </button>
        </div>
        <div className={styles.pomodoroStats}>
          <div className={styles.pomodoroStat}>
            <div className={styles.pomodoroStatValue}>{completedCount}</div>
            <div className={styles.pomodoroStatLabel}>Cycles terminés</div>
          </div>
          <div className={styles.pomodoroStat}>
            <div className={styles.pomodoroStatValue}>{completedCount * workMinutes}</div>
            <div className={styles.pomodoroStatLabel}>Min de focus</div>
          </div>
        </div>
      </div>
    </>
  );
}
