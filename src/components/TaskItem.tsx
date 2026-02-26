import { useState, useEffect, useRef } from "react";
import type { Task } from "../types";
import EditableEstimate from "./EditableEstimate";
import styles from "./TaskItem.module.css";

const CELEBRATIONS = [
  "Bien joué ! 🎯",
  "Un de moins 💪",
  "Tu avances ! 🚀",
  "Nice ! ✨",
  "Continue ! 🔥",
  "Bravo ! 🌟",
  "Écrasé ! 👊",
  "Yes ! 🙌",
];

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onToggleStep: (taskId: string, stepId: string) => void;
  onDecompose?: (id: string) => void;
  onRedecompose?: (id: string) => void;
  onDecomposeStep?: (taskId: string, stepId: string) => void;
  onEditStep?: (taskId: string, stepId: string, text: string) => void;
  onStuck?: (id: string) => void;
  onUpdateEstimate?: (taskId: string, minutes: number | undefined) => void;
  onUpdateStepEstimate?: (taskId: string, stepId: string, minutes: number | undefined) => void;
  isDecomposing?: boolean;
  decomposingStepId?: string | null;
  animDelay?: number;
  isSecondary?: boolean;
}

export default function TaskItem({
  task,
  onToggle,
  onToggleStep,
  onDecompose,
  onRedecompose,
  onDecomposeStep,
  onEditStep,
  onStuck,
  onUpdateEstimate,
  onUpdateStepEstimate,
  isDecomposing = false,
  decomposingStepId = null,
  animDelay = 0,
  isSecondary = false,
}: Props) {
  const [expanded, setExpanded] = useState(!!task.microSteps?.length && !task.done);
  const [visibleSteps, setVisibleSteps] = useState<number>(task.microSteps?.length ?? 0);
  const [justDecomposed, setJustDecomposed] = useState(false);
  const [showStuckMenu, setShowStuckMenu] = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const prevDoneRef = useRef(task.done);
  const stuckMenuRef = useRef<HTMLDivElement>(null);

  const hasSteps = task.microSteps && task.microSteps.length > 0;
  const canDecompose = !task.done && !hasSteps && !isDecomposing;

  useEffect(() => {
    if (task.done && !prevDoneRef.current) {
      const msg = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
      setCelebrationMsg(msg);
      const timer = setTimeout(() => setCelebrationMsg(null), 2500);
      prevDoneRef.current = task.done;
      return () => clearTimeout(timer);
    }
    prevDoneRef.current = task.done;
  }, [task.done]);

  useEffect(() => {
    if (!showStuckMenu) return;
    const handler = (e: MouseEvent) => {
      if (stuckMenuRef.current && !stuckMenuRef.current.contains(e.target as Node)) {
        setShowStuckMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStuckMenu]);

  useEffect(() => {
    if (!task.microSteps?.length) {
      setVisibleSteps(0);
      return;
    }
    if (justDecomposed) return;
    setVisibleSteps(task.microSteps.length);
  }, [task.microSteps?.length, justDecomposed]);

  useEffect(() => {
    if (!task.microSteps?.length || !isDecomposing) return;

    setJustDecomposed(true);
    setExpanded(true);
    setVisibleSteps(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    task.microSteps.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleSteps(i + 1), 300 * (i + 1)));
    });

    const doneTimer = setTimeout(
      () => setJustDecomposed(false),
      300 * task.microSteps.length + 400
    );
    timers.push(doneTimer);

    return () => timers.forEach(clearTimeout);
  }, [task.microSteps, isDecomposing]);

  const showGlow =
    justDecomposed &&
    visibleSteps === (task.microSteps?.length ?? 0) &&
    visibleSteps > 0;

  function startEditStep(stepId: string, text: string) {
    setEditingStepId(stepId);
    setEditingText(text);
  }

  function commitEditStep(stepId: string) {
    if (editingText.trim()) {
      onEditStep?.(task.id, stepId, editingText.trim());
    }
    setEditingStepId(null);
  }

  return (
    <div
      className={[
        styles.item,
        expanded && hasSteps ? styles.expanded : "",
        isDecomposing && !hasSteps ? styles.decomposing : "",
        showGlow ? styles.glowDone : "",
        isSecondary ? styles.secondary : "",
        celebrationMsg ? styles.celebrating : "",
        showStuckMenu ? styles.stuckOpen : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ animation: `fadeUp 0.25s ease ${animDelay}s both` }}
    >
      <button
        className={`${styles.check} ${task.done ? styles.checkDone : ""}`}
        onClick={() => onToggle(task.id)}
      >
        {task.done && "✓"}
      </button>

      <div className={styles.body}>
        <div className={styles.nameRow}>
          <div className={`${styles.name} ${task.done ? styles.nameDone : ""}`}>
            {task.name}
          </div>
          {!task.done && (
            <EditableEstimate
              minutes={task.estimatedMinutes}
              onChange={(m) => onUpdateEstimate?.(task.id, m)}
            />
          )}
        </div>

        {task.tags.length > 0 && (
          <div className={styles.tags}>
            {task.tags.map((tag, i) => (
              <span key={i} className={`${styles.tag} ${styles[tag.color]}`}>
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {celebrationMsg && (
          <div className={styles.celebration}>{celebrationMsg}</div>
        )}

        {isDecomposing && !hasSteps && (
          <div className={styles.skeleton}>
            <div className={styles.skeletonLabel}>
              <span className={styles.skeletonDot} />
              focal. décompose
              <span className={styles.ellipsis} />
            </div>
            <div className={styles.skeletonLines}>
              <div className={`${styles.skeletonLine} ${styles.line1}`} />
              <div className={`${styles.skeletonLine} ${styles.line2}`} />
              <div className={`${styles.skeletonLine} ${styles.line3}`} />
            </div>
          </div>
        )}

        {!task.done && !isDecomposing && (
          <div className={styles.actions}>
            {canDecompose && onDecompose && (
              <button
                className={styles.decomposeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onDecompose(task.id);
                }}
              >
                <span className={styles.decomposeIcon}>✦</span>
                Décomposer
              </button>
            )}

            <div className={styles.stuckWrap} ref={stuckMenuRef}>
              <button
                className={styles.stuckBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStuckMenu(!showStuckMenu);
                }}
              >
                Je bloque
              </button>

              {showStuckMenu && (
                <div className={styles.stuckMenu}>
                  <button
                    className={styles.stuckOption}
                    onClick={() => setShowStuckMenu(false)}
                  >
                    <span>↻</span>
                    <span>Passer à une autre tâche</span>
                  </button>
                  <button
                    className={styles.stuckOption}
                    onClick={() => {
                      onStuck?.(task.id);
                      setShowStuckMenu(false);
                    }}
                  >
                    <span>💬</span>
                    <span>En parler avec focal.</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {hasSteps && !isDecomposing && (
          <div className={styles.stepsHeader}>
            <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
              <span>{expanded ? "▾" : "▸"}</span>
              <span>{task.microSteps!.length} étapes · décomposé par IA</span>
              {task.aiDecomposed && <span className={styles.aiBadge}>IA</span>}
            </button>
            {!task.done && onRedecompose && (
              <button
                className={styles.redoBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onRedecompose(task.id);
                }}
                title="Régénérer la décomposition"
              >
                ↻
              </button>
            )}
          </div>
        )}

        {expanded && hasSteps && (
          <div className={styles.microSteps}>
            {task.microSteps!.map((step, i) => (
              <div
                key={step.id}
                className={`${styles.microStep} ${
                  i < visibleSteps ? styles.stepVisible : styles.stepHidden
                }`}
                style={{
                  transitionDelay: justDecomposed ? `${i * 0.05}s` : "0s",
                }}
              >
                {decomposingStepId === step.id ? (
                  <div className={styles.stepLoading}>
                    <span className={styles.skeletonDot} />
                    <span className={styles.stepLoadingText}>
                      focal. décompose<span className={styles.ellipsis} />
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      className={styles.stepContent}
                      onClick={() => {
                        if (editingStepId !== step.id) onToggleStep(task.id, step.id);
                      }}
                    >
                      <div
                        className={`${styles.stepDot} ${
                          step.done ? styles.stepDotDone : ""
                        }`}
                      />
                      {editingStepId === step.id ? (
                        <input
                          className={styles.stepEditInput}
                          value={editingText}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => commitEditStep(step.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditStep(step.id);
                            if (e.key === "Escape") setEditingStepId(null);
                          }}
                        />
                      ) : (
                        <div
                          className={`${styles.stepText} ${
                            step.done ? styles.stepTextDone : ""
                          }`}
                        >
                          {step.text}
                        </div>
                      )}
                    </button>

                    {!task.done && !step.done && editingStepId !== step.id && (
                      <div className={styles.stepActions}>
                        <button
                          className={styles.stepActionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditStep(step.id, step.text);
                          }}
                          title="Modifier"
                        >
                          ✎
                        </button>
                        {onDecomposeStep && (
                          <button
                            className={styles.stepActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDecomposeStep(task.id, step.id);
                            }}
                            title="Décomposer cette étape"
                          >
                            ✦
                          </button>
                        )}
                      </div>
                    )}

                    {!task.done && (
                      <EditableEstimate
                        minutes={step.estimatedMinutes}
                        onChange={(m) => onUpdateStepEstimate?.(task.id, step.id, m)}
                        small
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
