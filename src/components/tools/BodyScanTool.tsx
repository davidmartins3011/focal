import { useState, useEffect, useRef, useCallback } from "react";
import styles from "../ToolboxView.module.css";

interface BodyZone {
  emoji: string;
  name: string;
  instruction: string;
  duration: number;
}

const BODY_ZONES: BodyZone[] = [
  { emoji: "🧠", name: "Tête & visage", instruction: "Relâche les mâchoires, le front, les yeux. Desserre les dents.", duration: 10 },
  { emoji: "🫁", name: "Épaules & cou", instruction: "Laisse tomber les épaules. Relâche le cou. Respire.", duration: 10 },
  { emoji: "💪", name: "Bras & mains", instruction: "Détends les bras. Ouvre les mains. Relâche chaque doigt.", duration: 10 },
  { emoji: "❤️", name: "Poitrine & ventre", instruction: "Respire profondément. Sens ton ventre se gonfler, puis se vider.", duration: 15 },
  { emoji: "🦵", name: "Jambes & pieds", instruction: "Relâche les cuisses, les mollets. Sens tes pieds au sol.", duration: 10 },
  { emoji: "✨", name: "Corps entier", instruction: "Prends une grande inspiration. Expire tout. Tu es ancré.", duration: 10 },
];

export default function BodyScanTool() {
  const [running, setRunning] = useState(false);
  const [zoneIdx, setZoneIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const zone = BODY_ZONES[zoneIdx];

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

    setCountdown(BODY_ZONES[zoneIdx].duration);

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimer();
          setZoneIdx((zi) => {
            const next = zi + 1;
            if (next >= BODY_ZONES.length) {
              setRunning(false);
              setDone(true);
              return zi;
            }
            return next;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, zoneIdx, clearTimer]);

  useEffect(() => {
    if (running && countdown === 0 && !done) {
      setCountdown(BODY_ZONES[zoneIdx].duration);
    }
  }, [zoneIdx, running, countdown, done]);

  const handleStart = () => {
    setZoneIdx(0);
    setDone(false);
    setCountdown(BODY_ZONES[0].duration);
    setRunning(true);
  };

  const handleReset = () => {
    clearTimer();
    setRunning(false);
    setDone(false);
    setZoneIdx(0);
    setCountdown(0);
  };

  const totalDuration = BODY_ZONES.reduce((s, z) => s + z.duration, 0);

  return (
    <>
      <div className={styles.toolViewTitle}>Scan corporel express</div>
      <div className={styles.toolViewDesc}>
        {totalDuration} secondes pour parcourir ton corps et relâcher les tensions. Ferme les yeux si tu veux.
      </div>
      <div className={styles.bodyScanContainer}>
        {done ? (
          <div className={styles.bodyScanDone}>
            <div className={styles.bodyScanDoneIcon}>🧘</div>
            <div className={styles.bodyScanDoneTitle}>Scan terminé</div>
            <div className={styles.bodyScanDoneText}>
              Ton corps est relâché. Prends une dernière respiration avant de reprendre.
            </div>
            <div className={styles.bodyScanControls}>
              <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`} onClick={handleStart}>
                Relancer
              </button>
              <button className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`} onClick={handleReset}>
                Retour
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.bodyScanProgress}>
              {BODY_ZONES.map((z, i) => (
                <div
                  key={i}
                  className={`${styles.bodyScanDot} ${i < zoneIdx ? styles.bodyScanDotDone : ""} ${i === zoneIdx && running ? styles.bodyScanDotActive : ""}`}
                >
                  {z.emoji}
                </div>
              ))}
            </div>

            {running ? (
              <div className={styles.bodyScanZone}>
                <div className={styles.bodyScanZoneEmoji}>{zone.emoji}</div>
                <div className={styles.bodyScanZoneName}>{zone.name}</div>
                <div className={styles.bodyScanZoneInstruction}>{zone.instruction}</div>
                <div className={styles.bodyScanCountdown}>{countdown}</div>
              </div>
            ) : (
              <div className={styles.bodyScanReady}>
                <div className={styles.bodyScanReadyEmoji}>🫁</div>
                <div className={styles.bodyScanReadyText}>
                  Installe-toi confortablement.<br />Le scan dure {totalDuration} secondes.
                </div>
              </div>
            )}

            <div className={styles.bodyScanControls}>
              {running ? (
                <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStop}`} onClick={handleReset}>
                  Arrêter
                </button>
              ) : (
                <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`} onClick={handleStart}>
                  Commencer le scan
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
