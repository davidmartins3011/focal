import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../../types";
import styles from "../ToolboxView.module.css";

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

export default function ComparatorTool() {
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
