import { useState, useEffect, useRef, useCallback } from "react";
import styles from "../ToolboxView.module.css";

const WATCHERS = [
  { emoji: "🦉", name: "Hibou sage", message: "Je te regarde. Continue." },
  { emoji: "🐱", name: "Chat concentré", message: "Je t'observe depuis mon coin. Pas de pause." },
  { emoji: "👨‍🏫", name: "Prof bienveillant", message: "Je suis là. Tu fais du bon travail." },
  { emoji: "🧑‍🚀", name: "Astronaute", message: "Mission en cours. Reste concentré, Houston." },
  { emoji: "🐶", name: "Chien fidèle", message: "Je te quitte pas des yeux. Tu gères." },
  { emoji: "🥷", name: "Ninja silencieux", message: "Je suis dans l'ombre. Avance." },
  { emoji: "👵", name: "Grand-mère", message: "Je suis fière de toi. Continue mon petit." },
  { emoji: "🦊", name: "Renard rusé", message: "Pas de distraction. Je surveille." },
];

const RETURN_MESSAGES = [
  "Ah, te revoilà !",
  "Tu es de retour. On continue !",
  "Re-bienvenue. Au travail !",
  "Je commençais à m'inquiéter…",
  "Hey ! On se remet au boulot ?",
  "Tu m'avais presque oublié !",
];

const IDLE_THRESHOLD_MS = 15000;

export default function BodyDoubleTool() {
  const [active, setActive] = useState(false);
  const [watcherIdx, setWatcherIdx] = useState(() => Math.floor(Math.random() * WATCHERS.length));
  const [elapsed, setElapsed] = useState(0);
  const [blinkPhase, setBlinkPhase] = useState(false);
  const [gazeOffset, setGazeOffset] = useState({ x: 0, y: 0 });
  const [headTilt, setHeadTilt] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [returnReaction, setReturnReaction] = useState(false);
  const [returnMessage, setReturnMessage] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gazeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<{ source: AudioBufferSourceNode; lfo: OscillatorNode } | null>(null);
  const shiftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMouseMoveRef = useRef<number>(Date.now());
  const idleRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const watcher = WATCHERS[watcherIdx];

  const stopAudio = useCallback(() => {
    if (shiftTimerRef.current) { clearTimeout(shiftTimerRef.current); shiftTimerRef.current = null; }
    if (audioNodesRef.current) {
      try { audioNodesRef.current.source.stop(); audioNodesRef.current.lfo.stop(); } catch {}
      audioNodesRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null; }
    if (gazeRef.current) { clearInterval(gazeRef.current); gazeRef.current = null; }
    if (idleTimerRef.current) { clearInterval(idleTimerRef.current); idleTimerRef.current = null; }
    if (returnTimerRef.current) { clearTimeout(returnTimerRef.current); returnTimerRef.current = null; }
    stopAudio();
  }, [stopAudio]);

  useEffect(() => {
    if (!active) {
      clearTimers();
      setGazeOffset({ x: 0, y: 0 });
      setHeadTilt(0);
      setReturnReaction(false);
      return;
    }

    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    const scheduleBlink = () => {
      blinkRef.current = setTimeout(() => {
        setBlinkPhase(true);
        setTimeout(() => setBlinkPhase(false), 150);
        scheduleBlink();
      }, 5000 + Math.random() * 10000) as unknown as ReturnType<typeof setInterval>;
    };
    scheduleBlink();

    gazeRef.current = setInterval(() => {
      setGazeOffset({
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 4,
      });
    }, 3000 + Math.random() * 4000);

    lastMouseMoveRef.current = Date.now();
    idleRef.current = false;
    idleTimerRef.current = setInterval(() => {
      if (!idleRef.current && Date.now() - lastMouseMoveRef.current > IDLE_THRESHOLD_MS) {
        idleRef.current = true;
      }
    }, 1000);

    return clearTimers;
  }, [active, clearTimers]);

  useEffect(() => {
    if (!active) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      setGazeOffset({
        x: Math.max(-8, Math.min(8, dx * 16)),
        y: Math.max(-6, Math.min(6, dy * 12)),
      });
      setHeadTilt(Math.max(-5, Math.min(5, dx * 8)));
      lastMouseMoveRef.current = Date.now();

      if (idleRef.current) {
        idleRef.current = false;
        setReturnReaction(true);
        setReturnMessage(RETURN_MESSAGES[Math.floor(Math.random() * RETURN_MESSAGES.length)]);
        if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
        returnTimerRef.current = setTimeout(() => setReturnReaction(false), 3000);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [active]);

  useEffect(() => {
    if (!active || !soundEnabled) {
      stopAudio();
      return;
    }

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 150;
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.value = 0.025;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.25;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    lfo.start();
    audioNodesRef.current = { source, lfo };

    const scheduleShift = () => {
      shiftTimerRef.current = setTimeout(() => {
        if (!audioCtxRef.current || audioCtxRef.current.state === "closed") return;
        const c = audioCtxRef.current;
        const len = Math.floor(c.sampleRate * 0.2);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const s = c.createBufferSource();
        s.buffer = buf;
        const f = c.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 200 + Math.random() * 300;
        f.Q.value = 2;
        const g = c.createGain();
        g.gain.setValueAtTime(0, c.currentTime);
        g.gain.linearRampToValueAtTime(0.008, c.currentTime + 0.03);
        g.gain.linearRampToValueAtTime(0, c.currentTime + 0.18);
        s.connect(f);
        f.connect(g);
        g.connect(c.destination);
        s.start();
        s.stop(c.currentTime + 0.2);
        scheduleShift();
      }, 12000 + Math.random() * 20000);
    };
    scheduleShift();

    return () => stopAudio();
  }, [active, soundEnabled, stopAudio]);

  const handleStart = () => {
    setWatcherIdx(Math.floor(Math.random() * WATCHERS.length));
    setElapsed(0);
    setReturnReaction(false);
    setActive(true);
  };

  const handleStop = () => {
    setActive(false);
  };

  const handleShuffle = () => {
    setWatcherIdx((prev) => {
      let next = prev;
      while (next === prev) next = Math.floor(Math.random() * WATCHERS.length);
      return next;
    });
  };

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const displayMessage = returnReaction ? returnMessage : `« ${watcher.message} »`;

  return (
    <>
      <div className={styles.toolViewTitle}>Someone is watching</div>
      <div className={styles.toolViewDesc}>
        Le body doubling : le simple fait d'être observé aide à rester concentré.
        Lance l'avatar et mets-toi au travail.
      </div>
      <div className={styles.bodyDoubleContainer} ref={containerRef}>
        <div
          className={`${styles.bodyDoubleAvatar} ${active ? styles.bodyDoubleAvatarActive : ""}`}
          style={active ? { transform: `rotate(${headTilt}deg)` } : undefined}
        >
          {active && <div className={styles.bodyDoubleGlow} />}
          <div className={`${styles.bodyDoubleInner}${active ? ` ${styles.bodyDoubleBreathing}` : ""}`}>
            <div className={styles.bodyDoubleEmoji}>
              {watcher.emoji}
            </div>
            <div className={styles.bodyDoubleEyesRow}>
              <div
                className={`${styles.bodyDoubleEye} ${blinkPhase && active ? styles.bodyDoubleEyeBlink : ""} ${returnReaction ? styles.bodyDoubleEyeWide : ""}`}
              >
                <div
                  className={styles.bodyDoublePupil}
                  style={active ? { transform: `translate(${gazeOffset.x}px, ${gazeOffset.y}px)` } : undefined}
                />
              </div>
              <div
                className={`${styles.bodyDoubleEye} ${blinkPhase && active ? styles.bodyDoubleEyeBlink : ""} ${returnReaction ? styles.bodyDoubleEyeWide : ""}`}
              >
                <div
                  className={styles.bodyDoublePupil}
                  style={active ? { transform: `translate(${gazeOffset.x}px, ${gazeOffset.y}px)` } : undefined}
                />
              </div>
            </div>
          </div>
          {!active && <div className={styles.bodyDoubleSleeping}>z z z</div>}
        </div>

        <div className={styles.bodyDoubleName}>{watcher.name}</div>

        {active && (
          <div className={`${styles.bodyDoubleMessage} ${returnReaction ? styles.bodyDoubleReturnMessage : ""}`}>
            {displayMessage}
          </div>
        )}

        {active && (
          <div className={styles.bodyDoubleTimer}>
            {formatElapsed(elapsed)}
          </div>
        )}

        <div className={styles.bodyDoubleControls}>
          {active ? (
            <>
              <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStop}`} onClick={handleStop}>
                Arrêter
              </button>
              <button className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`} onClick={handleShuffle}>
                Changer d'avatar
              </button>
              <button
                className={`${styles.bodyDoubleSoundToggle} ${!soundEnabled ? styles.bodyDoubleSoundOff : ""}`}
                onClick={() => setSoundEnabled((v) => !v)}
                title={soundEnabled ? "Couper le son" : "Activer le son"}
              >
                {soundEnabled ? "🔊" : "🔇"}
              </button>
            </>
          ) : (
            <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`} onClick={handleStart}>
              Lancer la session
            </button>
          )}
        </div>

        {!active && elapsed > 0 && (
          <div className={styles.bodyDoubleSummary}>
            Dernière session : {formatElapsed(elapsed)} de focus
          </div>
        )}
      </div>
    </>
  );
}
