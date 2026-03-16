import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../types";
import styles from "./ToolboxView.module.css";

type ToolId = "comparator" | "top5" | "pomodoro" | "decision" | "breathing" | "restart" | "grounding" | "bodydouble" | "woop" | "bodyscan" | "micromovement";

interface ToolDef {
  id: ToolId;
  icon: string;
  title: string;
  description: string;
}

const TOOLS: Record<ToolId, ToolDef> = {
  comparator: {
    id: "comparator",
    icon: "⚖️",
    title: "Comparateur de tâches",
    description: "Compare tes tâches deux par deux pour trouver laquelle attaquer en premier.",
  },
  top5: {
    id: "top5",
    icon: "🎯",
    title: "Méthode 25/5",
    description: "Choisis tes 5 vraies priorités. Tout le reste devient ta liste \"ne pas toucher\".",
  },
  pomodoro: {
    id: "pomodoro",
    icon: "🍅",
    title: "Timer Pomodoro",
    description: "Lance un cycle de focus de 25 min suivi d'une pause pour avancer sans t'épuiser.",
  },
  decision: {
    id: "decision",
    icon: "🎲",
    title: "Décision rapide",
    description: "Tu hésites entre deux options ? Laisse le hasard trancher pour toi.",
  },
  breathing: {
    id: "breathing",
    icon: "🌬️",
    title: "Respiration guidée",
    description: "Un exercice de respiration visuel pour calmer ton esprit et retrouver ta concentration.",
  },
  restart: {
    id: "restart",
    icon: "🔄",
    title: "Séquence de redémarrage",
    description: "Tu as décroché ? Suis ce protocole étape par étape pour te relancer en douceur.",
  },
  grounding: {
    id: "grounding",
    icon: "🧘",
    title: "Ancrage 5-4-3-2-1",
    description: "Ramène ton attention au présent grâce à tes 5 sens. Idéal quand tu es submergé.",
  },
  bodydouble: {
    id: "bodydouble",
    icon: "👁️",
    title: "Someone is watching",
    description: "Un avatar te regarde travailler. Le simple fait d'être « observé » booste ta concentration.",
  },
  woop: {
    id: "woop",
    icon: "💭",
    title: "Méthode WOOP",
    description: "Visualise ton objectif en 4 étapes : Souhait, Résultat, Obstacle, Plan d'action.",
  },
  bodyscan: {
    id: "bodyscan",
    icon: "🫁",
    title: "Scan corporel express",
    description: "Parcours ton corps zone par zone en 90 secondes pour relâcher les tensions.",
  },
  micromovement: {
    id: "micromovement",
    icon: "🤸",
    title: "Micro-mouvement",
    description: "Un exercice physique rapide tiré au hasard pour casser l'immobilité et relancer l'énergie.",
  },
};

interface ToolSection {
  label: string;
  icon: string;
  toolIds: ToolId[];
}

const TOOL_SECTIONS: ToolSection[] = [
  {
    label: "Focus",
    icon: "🎯",
    toolIds: ["pomodoro", "bodydouble", "restart"],
  },
  {
    label: "Organisation",
    icon: "📋",
    toolIds: ["comparator", "top5", "decision", "woop"],
  },
  {
    label: "Conscience & Relaxation",
    icon: "🧘",
    toolIds: ["breathing", "grounding", "bodyscan", "micromovement"],
  },
];

export default function ToolboxView() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>🧰</span>
          Boîte à outils
        </div>
        <div className={styles.subtitle}>
          Choisis un outil pour t'aider à décider, prioriser ou te débloquer.
        </div>
      </div>

      <div className={styles.content}>
        {activeTool ? (
          <div className={styles.toolView}>
            <button className={styles.backBtn} onClick={() => setActiveTool(null)}>
              ← Retour aux outils
            </button>
            <ToolRouter toolId={activeTool} />
          </div>
        ) : (
          <div className={styles.toolSections}>
            {TOOL_SECTIONS.map((section) => (
              <div key={section.label} className={styles.toolSection}>
                <div className={styles.toolSectionHeader}>
                  <span className={styles.toolSectionIcon}>{section.icon}</span>
                  <span className={styles.toolSectionTitle}>{section.label}</span>
                </div>
                <div className={styles.toolSectionGrid}>
                  {section.toolIds.map((id) => {
                    const tool = TOOLS[id];
                    return (
                      <button
                        key={tool.id}
                        className={styles.toolCard}
                        onClick={() => setActiveTool(tool.id)}
                      >
                        <div className={styles.toolCardIcon}>{tool.icon}</div>
                        <div className={styles.toolCardTitle}>{tool.title}</div>
                        <div className={styles.toolCardDesc}>{tool.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolRouter({ toolId }: { toolId: ToolId }) {
  switch (toolId) {
    case "comparator": return <ComparatorTool />;
    case "top5": return <Top5Tool />;
    case "pomodoro": return <PomodoroTool />;
    case "decision": return <QuickDecisionTool />;
    case "breathing": return <BreathingTool />;
    case "restart": return <RestartSequenceTool />;
    case "grounding": return <GroundingTool />;
    case "bodydouble": return <BodyDoubleTool />;
    case "woop": return <WoopTool />;
    case "bodyscan": return <BodyScanTool />;
    case "micromovement": return <MicroMovementTool />;
  }
}

// ─── Task Comparator ───

type ComparatorScope = "today" | "week" | "range" | "all";

const COMPARATOR_SCOPES: { id: ComparatorScope; label: string; icon: string }[] = [
  { id: "today", label: "Aujourd'hui", icon: "📅" },
  { id: "week", label: "Cette semaine", icon: "🗓️" },
  { id: "range", label: "Période", icon: "📆" },
  { id: "all", label: "Tout", icon: "📋" },
];

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(mon), end: fmt(sun) };
}

function formatDateInput(d: Date): string {
  return d.toISOString().split("T")[0];
}

function ComparatorTool() {
  const [scope, setScope] = useState<ComparatorScope>("today");
  const [rangeStart, setRangeStart] = useState(() => formatDateInput(new Date()));
  const [rangeEnd, setRangeEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatDateInput(d);
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [bracket, setBracket] = useState<Task[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [winner, setWinner] = useState<Task | null>(null);
  const [roundWinners, setRoundWinners] = useState<Task[]>([]);
  const [completedMatches, setCompletedMatches] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const initTournament = useCallback((taskList: Task[]) => {
    const shuffled = [...taskList].sort(() => Math.random() - 0.5);
    setBracket(shuffled);
    setMatchIndex(0);
    setRound(1);
    setRoundWinners([]);
    setWinner(null);
    setCompletedMatches(0);
    setTotalMatches(shuffled.length - 1);
    setAnimKey((k) => k + 1);
  }, []);

  const loadTasks = useCallback(async (s: ComparatorScope) => {
    setLoading(true);
    try {
      let result: Task[];
      if (s === "today") {
        result = await invoke<Task[]>("get_tasks", { context: "today" });
      } else if (s === "week") {
        const { start, end } = getWeekRange();
        result = await invoke<Task[]>("get_tasks_by_date_range", { startDate: start, endDate: end });
      } else if (s === "range") {
        result = await invoke<Task[]>("get_tasks_by_date_range", { startDate: rangeStart, endDate: rangeEnd });
      } else {
        result = await invoke<Task[]>("get_all_tasks");
      }
      const pending = result.filter((t) => !t.done);
      setTasks(pending);
      return pending;
    } catch {
      setTasks([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  const handleStart = useCallback(async () => {
    const pending = await loadTasks(scope);
    if (pending.length >= 2) {
      initTournament(pending);
      setStarted(true);
    }
  }, [scope, loadTasks, initTournament]);

  const matchesInRound = Math.floor(bracket.length / 2);
  const hasBye = bracket.length % 2 === 1;

  const currentPair: [Task, Task] | null = (() => {
    const idx = matchIndex * 2;
    if (idx + 1 < bracket.length) return [bracket[idx], bracket[idx + 1]];
    return null;
  })();

  const handleChoice = (chosen: Task) => {
    const newWinners = [...roundWinners, chosen];
    const newCompleted = completedMatches + 1;
    setCompletedMatches(newCompleted);
    setAnimKey((k) => k + 1);

    if (matchIndex + 1 < matchesInRound) {
      setRoundWinners(newWinners);
      setMatchIndex(matchIndex + 1);
    } else {
      if (hasBye) newWinners.push(bracket[bracket.length - 1]);

      if (newWinners.length === 1) {
        setWinner(newWinners[0]);
      } else {
        setBracket(newWinners);
        setRoundWinners([]);
        setMatchIndex(0);
        setRound((r) => r + 1);
      }
    }
  };

  const handleReset = () => initTournament(tasks);

  const handleBackToSetup = () => {
    setStarted(false);
    setWinner(null);
    setBracket([]);
    setTasks([]);
  };

  const scopeLabel = COMPARATOR_SCOPES.find((s) => s.id === scope)?.label ?? "";

  if (!started) {
    return (
      <>
        <div className={styles.toolViewTitle}>Comparateur de tâches</div>
        <div className={styles.toolViewDesc}>
          Choisis le périmètre de tâches à comparer, puis lance le tournoi par élimination.
        </div>
        <div className={styles.comparatorSetup}>
          <div className={styles.comparatorScopeLabel}>Quelles tâches comparer ?</div>
          <div className={styles.comparatorScopes}>
            {COMPARATOR_SCOPES.map((s) => (
              <button
                key={s.id}
                className={`${styles.comparatorScopeBtn} ${scope === s.id ? styles.comparatorScopeBtnActive : ""}`}
                onClick={() => setScope(s.id)}
              >
                <span className={styles.comparatorScopeBtnIcon}>{s.icon}</span>
                <span className={styles.comparatorScopeBtnLabel}>{s.label}</span>
              </button>
            ))}
          </div>

          {scope === "range" && (
            <div className={styles.comparatorDateRange}>
              <label className={styles.comparatorDateLabel}>
                Du
                <input
                  type="date"
                  className={styles.comparatorDateInput}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </label>
              <span className={styles.comparatorDateSep}>→</span>
              <label className={styles.comparatorDateLabel}>
                Au
                <input
                  type="date"
                  className={styles.comparatorDateInput}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </label>
            </div>
          )}

          <button
            className={styles.comparatorLaunchBtn}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? "Chargement…" : "⚔️ Lancer le tournoi"}
          </button>
        </div>
      </>
    );
  }

  if (loading) {
    return <div className={styles.toolViewDesc}>Chargement des tâches…</div>;
  }

  if (tasks.length < 2) {
    return (
      <>
        <div className={styles.toolViewTitle}>Comparateur de tâches</div>
        <div className={styles.toolViewDesc}>
          Pas assez de tâches non terminées ({tasks.length}) pour « {scopeLabel} ».
        </div>
        <div className={styles.comparator}>
          <button
            className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
            onClick={handleBackToSetup}
          >
            ← Changer le périmètre
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.toolViewTitle}>Comparateur de tâches</div>
      <div className={styles.toolViewDesc}>
        Clique sur la tâche que tu préfères faire en premier. Tournoi sur « {scopeLabel} » ({tasks.length} tâches).
      </div>
      <div className={styles.comparator}>
        {winner ? (
          <div className={styles.comparatorResult}>
            <div className={styles.comparatorResultIcon}>🏆</div>
            <div className={styles.comparatorResultTitle}>Tu devrais commencer par :</div>
            <div className={styles.comparatorWinnerName}>{winner.name}</div>
            {winner.tags?.[0] && (
              <div className={styles.comparatorTaskMeta}>{winner.tags[0].label}</div>
            )}
            <div className={styles.comparatorActions} style={{ marginTop: 16 }}>
              <button
                className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
                onClick={handleReset}
              >
                Recommencer
              </button>
              <button
                className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
                onClick={handleBackToSetup}
              >
                Changer le périmètre
              </button>
            </div>
          </div>
        ) : currentPair ? (
          <>
            <div className={styles.comparatorProgress}>
              <div className={styles.comparatorProgressBar}>
                <div
                  className={styles.comparatorProgressFill}
                  style={{ width: `${(completedMatches / totalMatches) * 100}%` }}
                />
              </div>
              <div className={styles.comparatorProgressLabel}>
                Match {completedMatches + 1} / {totalMatches} — Tour {round}
              </div>
            </div>
            <div className={styles.comparatorPair} key={animKey}>
              <button
                className={styles.comparatorCard}
                onClick={() => handleChoice(currentPair[0])}
              >
                <div className={styles.comparatorTaskName}>{currentPair[0].name}</div>
                {currentPair[0].tags?.[0] && (
                  <div className={styles.comparatorTaskMeta}>{currentPair[0].tags[0].label}</div>
                )}
              </button>
              <div className={styles.comparatorVs}>VS</div>
              <button
                className={styles.comparatorCard}
                onClick={() => handleChoice(currentPair[1])}
              >
                <div className={styles.comparatorTaskName}>{currentPair[1].name}</div>
                {currentPair[1].tags?.[0] && (
                  <div className={styles.comparatorTaskMeta}>{currentPair[1].tags[0].label}</div>
                )}
              </button>
            </div>
            <div className={styles.comparatorBracketInfo}>
              {bracket.length} tâches restantes dans le tournoi
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// ─── Top 5 (Warren Buffett's 25/5 Rule) ───

const TOP5_SETTING_KEY = "top5-task-ids";

function Top5Tool() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [allTasks, savedJson] = await Promise.all([
          invoke<Task[]>("get_all_tasks"),
          invoke<string | null>("get_setting", { key: TOP5_SETTING_KEY }),
        ]);

        if (cancelled) return;

        const pending = allTasks.filter((task) => !task.done);
        setTasks(pending);

        if (savedJson) {
          const savedIds: string[] = JSON.parse(savedJson);
          const pendingIds = new Set(pending.map((t) => t.id));
          const validIds = savedIds.filter((id) => pendingIds.has(id));

          if (validIds.length > 0) {
            setSelected(new Set(validIds));
            setLocked(true);
          }
        }
      } catch {
        // silently ignore load errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const toggleTask = (id: string) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  const handleLock = async () => {
    setSaving(true);
    try {
      const ids = Array.from(selected);
      await invoke("set_setting", {
        key: TOP5_SETTING_KEY,
        value: JSON.stringify(ids),
      });
      setLocked(true);
    } catch {
      // persist failed — lock locally anyway
      setLocked(true);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await invoke("set_setting", {
        key: TOP5_SETTING_KEY,
        value: JSON.stringify([]),
      });
    } catch {
      // ignore
    } finally {
      setSelected(new Set());
      setLocked(false);
      setSaving(false);
    }
  };

  const completedCount = tasks.filter(
    (t) => selected.has(t.id) && t.done,
  ).length;

  const top5 = Array.from(selected)
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const avoid = tasks.filter((t) => !selected.has(t.id));

  if (loading) {
    return <div className={styles.eisenhowerLoading}>Chargement des tâches…</div>;
  }

  return (
    <>
      <div className={styles.toolViewTitle}>Méthode 25/5</div>
      <div className={styles.toolViewDesc}>
        La règle de Warren Buffett : choisis tes 5 priorités absolues.
        Tout le reste devient ta liste « à éviter » tant que le top 5 n'est pas fait.
      </div>

      {!locked ? (
        <div className={styles.top5Selection}>
          <div className={styles.top5Counter}>
            <span className={styles.top5CounterValue}>{selected.size}</span>
            <span className={styles.top5CounterLabel}> / 5 sélectionnées</span>
          </div>
          <div className={styles.top5List}>
            {tasks.map((t) => {
              const isSelected = selected.has(t.id);
              const isFull = selected.size >= 5 && !isSelected;
              return (
                <button
                  key={t.id}
                  className={`${styles.top5Item} ${isSelected ? styles.top5ItemSelected : ""} ${isFull ? styles.top5ItemDisabled : ""}`}
                  onClick={() => toggleTask(t.id)}
                  disabled={isFull}
                >
                  <span className={styles.top5Checkbox}>
                    {isSelected ? "★" : "☆"}
                  </span>
                  <span className={styles.top5ItemName}>{t.name}</span>
                  {t.tags?.[0] && (
                    <span className={styles.top5ItemTag}>{t.tags[0].label}</span>
                  )}
                </button>
              );
            })}
          </div>
          {tasks.length === 0 && (
            <div className={styles.quadrantEmpty}>Aucune tâche non terminée.</div>
          )}
          <div className={styles.top5Actions}>
            <button
              className={styles.top5Btn}
              onClick={handleLock}
              disabled={selected.size === 0 || saving}
            >
              {saving ? "Enregistrement…" : `Valider mon top ${selected.size > 0 ? selected.size : 5}`}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.top5Result}>
          {completedCount > 0 && completedCount < top5.length && (
            <div className={styles.top5Progress}>
              <div className={styles.top5ProgressBar}>
                <div
                  className={styles.top5ProgressFill}
                  style={{ width: `${(completedCount / top5.length) * 100}%` }}
                />
              </div>
              <span className={styles.top5ProgressLabel}>
                {completedCount} / {top5.length} terminées
              </span>
            </div>
          )}
          {completedCount === top5.length && top5.length > 0 && (
            <div className={styles.top5AllDone}>
              <span className={styles.top5AllDoneIcon}>🎉</span>
              <span>Top {top5.length} terminé ! Tu peux recommencer avec de nouvelles priorités.</span>
            </div>
          )}

          <div className={styles.top5Section}>
            <div className={styles.top5SectionHeader}>
              <span className={styles.top5SectionIcon}>🟢</span>
              <span className={styles.top5SectionTitle}>Ton focus — fais uniquement ça</span>
            </div>
            <div className={styles.top5SectionList}>
              {top5.map((t, i) => (
                <div key={t.id} className={`${styles.top5ResultItem} ${t.done ? styles.top5ResultItemDone : ""}`}>
                  <span className={styles.top5Rank}>{i + 1}</span>
                  <span className={t.done ? styles.top5DoneText : ""}>{t.name}</span>
                  {t.done && <span className={styles.top5DoneCheck}>✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div className={`${styles.top5Section} ${styles.top5SectionAvoid}`}>
            <div className={styles.top5SectionHeader}>
              <span className={styles.top5SectionIcon}>🔴</span>
              <span className={styles.top5SectionTitle}>Liste « ne pas toucher »</span>
            </div>
            <div className={styles.top5SectionHint}>
              Ces tâches ne sont pas supprimées — mais tu t'engages à ne pas y toucher tant que ton top n'est pas fait.
            </div>
            <div className={styles.top5SectionList}>
              {avoid.map((t) => (
                <div key={t.id} className={`${styles.top5ResultItem} ${styles.top5ResultItemFaded}`}>
                  <span>{t.name}</span>
                </div>
              ))}
              {avoid.length === 0 && (
                <div className={styles.quadrantEmpty}>Toutes tes tâches sont dans ton top !</div>
              )}
            </div>
          </div>

          <div className={styles.top5Actions}>
            <button
              className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
              onClick={handleReset}
              disabled={saving}
            >
              {saving ? "…" : "Recommencer"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Pomodoro Timer ───

const POMODORO_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60];
const BREAK_DURATION = 5 * 60;

function PomodoroTool() {
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

// ─── Quick Decision ───

function QuickDecisionTool() {
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

// ─── Guided Breathing ───

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

function BreathingTool() {
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

// ─── Restart Sequence ───

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

function RestartSequenceTool() {
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

// ─── Grounding 5-4-3-2-1 ───

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

function GroundingTool() {
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

// ─── Body Double ("Someone is watching") ───

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

function BodyDoubleTool() {
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

// ─── WOOP Method ───

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

function WoopTool() {
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

// ─── Body Scan Express ───

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

function BodyScanTool() {
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

// ─── Micro-mouvement ───

interface MicroExercise {
  emoji: string;
  name: string;
  instruction: string;
  duration: string;
}

const MICRO_EXERCISES: MicroExercise[] = [
  { emoji: "🙆", name: "Étirement cervical", instruction: "Penche la tête à droite 10s, puis à gauche 10s. Doucement.", duration: "20s" },
  { emoji: "🤷", name: "Roulé d'épaules", instruction: "Fais 10 rotations d'épaules vers l'arrière, puis 10 vers l'avant.", duration: "20s" },
  { emoji: "🧍", name: "Debout 30 secondes", instruction: "Lève-toi, reste debout, étire-toi. C'est tout.", duration: "30s" },
  { emoji: "🚶", name: "Micro-marche", instruction: "Fais 20 pas dans la pièce. Regarde autour de toi.", duration: "30s" },
  { emoji: "✊", name: "Serrer-relâcher", instruction: "Serre les poings très fort 5s, puis relâche. Répète 5 fois.", duration: "25s" },
  { emoji: "🦶", name: "Pointes de pieds", instruction: "Monte sur la pointe des pieds, tiens 5s, redescends. 10 fois.", duration: "30s" },
  { emoji: "🌀", name: "Rotation des poignets", instruction: "Fais tourner tes poignets dans un sens, puis dans l'autre. 15 tours chaque.", duration: "20s" },
  { emoji: "🧎", name: "Squat de bureau", instruction: "Fais 10 squats lents à côté de ta chaise. Respire.", duration: "30s" },
  { emoji: "💨", name: "Respiration debout", instruction: "Debout, inspire en levant les bras. Expire en les baissant. 5 fois.", duration: "25s" },
  { emoji: "👐", name: "Étirement des doigts", instruction: "Écarte les doigts au max 5s, puis ferme le poing. 10 fois.", duration: "20s" },
  { emoji: "🔄", name: "Rotation du buste", instruction: "Assis, tourne le buste à droite 10s, puis à gauche 10s.", duration: "20s" },
  { emoji: "🦵", name: "Extension de jambes", instruction: "Assis, tends une jambe devant toi 10s. Change. 3 fois chaque.", duration: "30s" },
  { emoji: "🪑", name: "Dips de chaise", instruction: "Mains sur le bord de la chaise, descends les fesses et remonte. 8 fois.", duration: "30s" },
  { emoji: "🐱", name: "Chat-vache", instruction: "À quatre pattes ou assis, arrondis le dos (chat) puis creuse-le (vache). 8 fois.", duration: "25s" },
  { emoji: "👀", name: "Yoga des yeux", instruction: "Regarde en haut, en bas, à droite, à gauche. Puis fais 5 cercles dans chaque sens.", duration: "20s" },
  { emoji: "🤲", name: "Étirement avant-bras", instruction: "Tends un bras, tire les doigts vers toi avec l'autre main. 15s par côté.", duration: "30s" },
  { emoji: "🦋", name: "Papillon d'épaules", instruction: "Mains sur les épaules, fais des cercles avec les coudes. 10 avant, 10 arrière.", duration: "25s" },
  { emoji: "🏔️", name: "Posture montagne", instruction: "Debout, pieds joints, étire-toi vers le ciel en inspirant. Tiens 15s. Relâche.", duration: "20s" },
  { emoji: "🫲", name: "Pression isométrique", instruction: "Paumes l'une contre l'autre devant la poitrine, pousse fort 10s. Relâche. 5 fois.", duration: "25s" },
  { emoji: "🦩", name: "Équilibre unipodal", instruction: "Tiens-toi sur un pied 15s, puis change. Recommence 2 fois chaque côté.", duration: "30s" },
];

function MicroMovementTool() {
  const [exerciseIdx, setExerciseIdx] = useState(() => Math.floor(Math.random() * MICRO_EXERCISES.length));
  const [history, setHistory] = useState<number[]>([]);

  const exercise = MICRO_EXERCISES[exerciseIdx];

  const pickRandom = () => {
    let next = exerciseIdx;
    while (next === exerciseIdx) {
      next = Math.floor(Math.random() * MICRO_EXERCISES.length);
    }
    setExerciseIdx(next);
  };

  const handleNext = () => {
    pickRandom();
  };

  const handleDone = () => {
    setHistory((prev) => [...prev, exerciseIdx]);
    pickRandom();
  };

  return (
    <>
      <div className={styles.toolViewTitle}>Micro-mouvement</div>
      <div className={styles.toolViewDesc}>
        Un exercice rapide tiré au hasard. Fais-le maintenant, ça prend moins de 30 secondes.
      </div>
      <div className={styles.microMoveContainer}>
        <div className={styles.microMoveCard}>
          <div className={styles.microMoveEmoji}>{exercise.emoji}</div>
          <div className={styles.microMoveName}>{exercise.name}</div>
          <div className={styles.microMoveInstruction}>{exercise.instruction}</div>
          <div className={styles.microMoveDuration}>{exercise.duration}</div>
        </div>

        <div className={styles.microMoveControls}>
          <button className={`${styles.pomodoroBtn} ${styles.pomodoroBtnStart}`} onClick={handleDone}>
            Fait ✓
          </button>
          <button className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`} onClick={handleNext}>
            Un autre
          </button>
        </div>

        {history.length > 0 && (
          <div className={styles.microMoveHistory}>
            {history.length} exercice{history.length > 1 ? "s" : ""} fait{history.length > 1 ? "s" : ""} cette session
          </div>
        )}
      </div>
    </>
  );
}
