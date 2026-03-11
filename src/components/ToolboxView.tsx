import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../types";
import styles from "./ToolboxView.module.css";

type ToolId = "eisenhower" | "comparator" | "top5" | "pomodoro" | "braindump" | "energy" | "decision";

interface ToolDef {
  id: ToolId;
  icon: string;
  title: string;
  description: string;
}

const TOOLS: ToolDef[] = [
  {
    id: "eisenhower",
    icon: "📊",
    title: "Matrice d'Eisenhower",
    description: "Classe tes tâches par urgence et importance pour savoir quoi faire en premier.",
  },
  {
    id: "comparator",
    icon: "⚖️",
    title: "Comparateur de tâches",
    description: "Compare tes tâches deux par deux pour trouver laquelle attaquer en premier.",
  },
  {
    id: "top5",
    icon: "🎯",
    title: "Méthode 25/5",
    description: "Choisis tes 5 vraies priorités. Tout le reste devient ta liste \"ne pas toucher\".",
  },
  {
    id: "pomodoro",
    icon: "🍅",
    title: "Timer Pomodoro",
    description: "Lance un cycle de focus de 25 min suivi d'une pause pour avancer sans t'épuiser.",
  },
  {
    id: "braindump",
    icon: "🧠",
    title: "Vidage de tête",
    description: "Note tout ce qui te passe par la tête pour te libérer l'esprit et y voir plus clair.",
  },
  {
    id: "energy",
    icon: "⚡",
    title: "Check énergie",
    description: "Évalue ton niveau d'énergie pour adapter ce que tu fais au bon moment.",
  },
  {
    id: "decision",
    icon: "🎲",
    title: "Décision rapide",
    description: "Tu hésites entre deux options ? Laisse le hasard trancher pour toi.",
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
          <div className={styles.toolsGrid}>
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                className={styles.toolCard}
                onClick={() => setActiveTool(tool.id)}
              >
                <div className={styles.toolCardIcon}>{tool.icon}</div>
                <div className={styles.toolCardTitle}>{tool.title}</div>
                <div className={styles.toolCardDesc}>{tool.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolRouter({ toolId }: { toolId: ToolId }) {
  switch (toolId) {
    case "eisenhower": return <EisenhowerTool />;
    case "comparator": return <ComparatorTool />;
    case "top5": return <Top5Tool />;
    case "pomodoro": return <PomodoroTool />;
    case "braindump": return <BrainDumpTool />;
    case "energy": return <EnergyCheckTool />;
    case "decision": return <QuickDecisionTool />;
  }
}

// ─── Eisenhower Matrix ───

function EisenhowerTool() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<Task[]>("get_tasks")
      .then((t) => setTasks(t.filter((task) => !task.done)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const quadrants = {
    q1: tasks.filter((t) => (t.urgency ?? 0) >= 3 && (t.importance ?? 0) >= 3),
    q2: tasks.filter((t) => (t.urgency ?? 0) < 3 && (t.importance ?? 0) >= 3),
    q3: tasks.filter((t) => (t.urgency ?? 0) >= 3 && (t.importance ?? 0) < 3),
    q4: tasks.filter((t) => (t.urgency ?? 0) < 3 && (t.importance ?? 0) < 3),
  };

  const renderQuadrant = (
    key: "q1" | "q2" | "q3" | "q4",
    title: string,
    subtitle: string,
    taskList: Task[],
  ) => (
    <div className={`${styles.eisenhowerQuadrant} ${styles[key]}`}>
      <div className={styles.quadrantHeader}>
        <span className={styles.quadrantTitle}>{title}</span>
        <span className={styles.quadrantSubtitle}>{subtitle}</span>
      </div>
      <div className={styles.quadrantTasks}>
        {taskList.length === 0 ? (
          <div className={styles.quadrantEmpty}>Aucune tâche</div>
        ) : (
          taskList.slice(0, 5).map((t) => (
            <div key={t.id} className={styles.quadrantTask}>
              <span>{t.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className={styles.toolViewTitle}>Matrice d'Eisenhower</div>
      <div className={styles.toolViewDesc}>
        Tes tâches non terminées, classées selon leur urgence et leur importance.
      </div>
      {loading ? (
        <div className={styles.eisenhowerLoading}>Chargement des tâches…</div>
      ) : (
        <div className={styles.eisenhowerGrid}>
          {renderQuadrant("q1", "🔴 Faire maintenant", "Urgent + Important", quadrants.q1)}
          {renderQuadrant("q2", "🔵 Planifier", "Important, pas urgent", quadrants.q2)}
          {renderQuadrant("q3", "🟠 Déléguer", "Urgent, pas important", quadrants.q3)}
          {renderQuadrant("q4", "⚪ Éliminer ?", "Ni urgent, ni important", quadrants.q4)}
        </div>
      )}
    </>
  );
}

// ─── Task Comparator ───

function ComparatorTool() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairIndex, setPairIndex] = useState(0);
  const [winner, setWinner] = useState<Task | null>(null);
  const [rankings, setRankings] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    invoke<Task[]>("get_tasks")
      .then((t) => setTasks(t.filter((task) => !task.done)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pairs: [Task, Task][] = [];
  for (let i = 0; i < tasks.length && pairs.length < 5; i++) {
    for (let j = i + 1; j < tasks.length && pairs.length < 5; j++) {
      pairs.push([tasks[i], tasks[j]]);
    }
  }

  const currentPair = pairs[pairIndex];

  const handleChoice = (chosen: Task) => {
    setRankings((prev) => {
      const next = new Map(prev);
      next.set(chosen.id, (next.get(chosen.id) ?? 0) + 1);
      return next;
    });

    if (pairIndex + 1 < pairs.length) {
      setPairIndex((p) => p + 1);
    } else {
      let bestId = "";
      let bestScore = -1;
      rankings.forEach((score, id) => {
        if (score > bestScore || (score === bestScore && !bestId)) {
          bestScore = score;
          bestId = id;
        }
      });
      const chosenScore = (rankings.get(chosen.id) ?? 0) + 1;
      if (chosenScore > bestScore) {
        bestId = chosen.id;
      }
      setWinner(tasks.find((t) => t.id === bestId) ?? chosen);
    }
  };

  const handleReset = () => {
    setPairIndex(0);
    setWinner(null);
    setRankings(new Map());
  };

  if (loading) {
    return <div className={styles.eisenhowerLoading}>Chargement des tâches…</div>;
  }

  if (tasks.length < 2) {
    return (
      <>
        <div className={styles.toolViewTitle}>Comparateur de tâches</div>
        <div className={styles.toolViewDesc}>
          Il faut au moins 2 tâches non terminées pour utiliser le comparateur.
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.toolViewTitle}>Comparateur de tâches</div>
      <div className={styles.toolViewDesc}>
        Clique sur la tâche que tu préfères faire en premier. Après quelques comparaisons, on te dira laquelle attaquer.
      </div>
      <div className={styles.comparator}>
        {winner ? (
          <div className={styles.comparatorResult}>
            <div className={styles.comparatorResultIcon}>🏆</div>
            <div className={styles.comparatorResultTitle}>Tu devrais commencer par :</div>
            <div className={styles.comparatorResultText}>{winner.name}</div>
            <div className={styles.comparatorActions} style={{ marginTop: 16 }}>
              <button
                className={`${styles.comparatorBtn} ${styles.comparatorBtnSecondary}`}
                onClick={handleReset}
              >
                Recommencer
              </button>
            </div>
          </div>
        ) : currentPair ? (
          <>
            <div className={styles.comparatorPair}>
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
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--text3)" }}>
              Comparaison {pairIndex + 1} / {pairs.length}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// ─── Top 5 (Warren Buffett's 25/5 Rule) ───

function Top5Tool() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    invoke<Task[]>("get_tasks")
      .then((t) => setTasks(t.filter((task) => !task.done)))
      .catch(() => {})
      .finally(() => setLoading(false));
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

  const handleLock = () => setLocked(true);
  const handleReset = () => {
    setSelected(new Set());
    setLocked(false);
  };

  const top5 = tasks.filter((t) => selected.has(t.id));
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
              className={styles.brainDumpBtn}
              onClick={handleLock}
              disabled={selected.size === 0}
            >
              Valider mon top {selected.size > 0 ? selected.size : 5}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.top5Result}>
          <div className={styles.top5Section}>
            <div className={styles.top5SectionHeader}>
              <span className={styles.top5SectionIcon}>🟢</span>
              <span className={styles.top5SectionTitle}>Ton focus — fais uniquement ça</span>
            </div>
            <div className={styles.top5SectionList}>
              {top5.map((t, i) => (
                <div key={t.id} className={styles.top5ResultItem}>
                  <span className={styles.top5Rank}>{i + 1}</span>
                  <span>{t.name}</span>
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
            >
              Recommencer
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Pomodoro Timer ───

function PomodoroTool() {
  const WORK_DURATION = 25 * 60;
  const BREAK_DURATION = 5 * 60;

  const [secondsLeft, setSecondsLeft] = useState(WORK_DURATION);
  const [running, setRunning] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            return WORK_DURATION;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, onBreak, clearTimer]);

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
    setSecondsLeft(WORK_DURATION);
  };

  const timerClass = `${styles.pomodoroTimer} ${running ? (onBreak ? styles.onBreak : styles.running) : ""}`;

  return (
    <>
      <div className={styles.toolViewTitle}>Timer Pomodoro</div>
      <div className={styles.toolViewDesc}>
        25 min de focus, 5 min de pause. Un cycle simple pour avancer sans surcharge.
      </div>
      <div className={styles.pomodoro}>
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
            <div className={styles.pomodoroStatValue}>{completedCount * 25}</div>
            <div className={styles.pomodoroStatLabel}>Min de focus</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Brain Dump ───

function BrainDumpTool() {
  const [text, setText] = useState("");
  const [items, setItems] = useState<string[]>([]);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newItems = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    setItems((prev) => [...prev, ...newItems]);
    setText("");
  };

  const handleDelete = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    setItems([]);
    setText("");
  };

  return (
    <>
      <div className={styles.toolViewTitle}>Vidage de tête</div>
      <div className={styles.toolViewDesc}>
        Écris tout ce qui te passe par la tête, sans filtre. Tu trieras après.
      </div>
      <div className={styles.brainDump}>
        <textarea
          className={styles.brainDumpTextarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris ici tout ce qui te vient… une idée par ligne si tu veux."
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <div className={styles.brainDumpActions}>
          <button
            className={styles.brainDumpBtn}
            onClick={handleAdd}
            disabled={!text.trim()}
          >
            Ajouter
          </button>
          {items.length > 0 && (
            <button
              className={`${styles.brainDumpBtn} ${styles.brainDumpBtnSecondary}`}
              onClick={handleClear}
            >
              Tout effacer
            </button>
          )}
        </div>

        {items.length > 0 && (
          <div className={styles.brainDumpItems}>
            {items.map((item, i) => (
              <div key={i} className={styles.brainDumpItem}>
                <div className={styles.brainDumpItemDot} />
                <span className={styles.brainDumpItemText}>{item}</span>
                <button
                  className={styles.brainDumpItemDelete}
                  onClick={() => handleDelete(i)}
                  title="Supprimer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Energy Check ───

interface EnergyAdvice {
  label: string;
  emoji: string;
  title: string;
  text: string;
  tips: string[];
}

const ENERGY_LEVELS: EnergyAdvice[] = [
  {
    label: "Très bas",
    emoji: "😴",
    title: "Ménage-toi",
    text: "Ton énergie est très basse. Pas de culpabilité — fais le minimum vital.",
    tips: [
      "Fais une seule micro-tâche de 5 min max",
      "Prends une vraie pause (eau, air, marche)",
      "Reporte ce qui peut attendre demain",
    ],
  },
  {
    label: "Bas",
    emoji: "😕",
    title: "En douceur",
    text: "Tu es un peu à plat. Privilégie les tâches simples et routinières.",
    tips: [
      "Traite tes emails ou messages en attente",
      "Range / organise ton espace de travail",
      "Fais des tâches qui demandent peu de réflexion",
    ],
  },
  {
    label: "Moyen",
    emoji: "😊",
    title: "Rythme de croisière",
    text: "Énergie correcte ! Tu peux avancer sur du vrai travail.",
    tips: [
      "Lance un Pomodoro sur ta tâche prioritaire",
      "Avance sur un projet en cours",
      "Planifie le reste de ta journée",
    ],
  },
  {
    label: "Haut",
    emoji: "💪",
    title: "En forme !",
    text: "Belle énergie ! C'est le moment d'attaquer le plus difficile.",
    tips: [
      "Fais la tâche que tu repousses depuis longtemps",
      "Travaille sur du deep work (création, réflexion)",
      "Profite de cet élan pour prendre de l'avance",
    ],
  },
  {
    label: "Au top",
    emoji: "🔥",
    title: "Mode turbo",
    text: "Énergie maximale ! Profites-en pour les tâches les plus exigeantes.",
    tips: [
      "Attaque tes tâches les plus complexes",
      "Prends des décisions importantes",
      "Lance un nouveau projet ou une idée ambitieuse",
    ],
  },
];

function EnergyCheckTool() {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const advice = selectedLevel !== null ? ENERGY_LEVELS[selectedLevel] : null;

  return (
    <>
      <div className={styles.toolViewTitle}>Check énergie</div>
      <div className={styles.toolViewDesc}>
        Comment tu te sens là, maintenant ? Choisis ton niveau pour des conseils adaptés.
      </div>
      <div className={styles.energyCheck}>
        <div className={styles.energyLevels}>
          {ENERGY_LEVELS.map((level, i) => (
            <button
              key={i}
              className={`${styles.energyLevel} ${selectedLevel === i ? styles.selected : ""}`}
              onClick={() => setSelectedLevel(i)}
            >
              <span className={styles.energyEmoji}>{level.emoji}</span>
              <span className={styles.energyLabelText}>{level.label}</span>
            </button>
          ))}
        </div>

        {advice && (
          <div className={styles.energyAdvice}>
            <div className={styles.energyAdviceTitle}>
              {advice.emoji} {advice.title}
            </div>
            <div className={styles.energyAdviceText}>{advice.text}</div>
            <ul className={styles.energyAdviceList}>
              {advice.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
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
