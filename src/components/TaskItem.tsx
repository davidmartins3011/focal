import { useState, useEffect } from "react";
import type { Task } from "../types";
import styles from "./TaskItem.module.css";

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onToggleStep: (taskId: string, stepId: string) => void;
  onDecompose?: (id: string) => void;
  isDecomposing?: boolean;
  animDelay?: number;
}

export default function TaskItem({
  task,
  onToggle,
  onToggleStep,
  onDecompose,
  isDecomposing = false,
  animDelay = 0,
}: Props) {
  const [expanded, setExpanded] = useState(!!task.microSteps?.length && !task.done);
  const [visibleSteps, setVisibleSteps] = useState<number>(
    task.microSteps?.length ?? 0
  );
  const [justDecomposed, setJustDecomposed] = useState(false);
  const hasSteps = task.microSteps && task.microSteps.length > 0;
  const canDecompose = !task.done && !hasSteps && !isDecomposing;

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
      timers.push(
        setTimeout(() => setVisibleSteps(i + 1), 300 * (i + 1))
      );
    });

    const doneTimer = setTimeout(() => {
      setJustDecomposed(false);
    }, 300 * task.microSteps.length + 400);
    timers.push(doneTimer);

    return () => timers.forEach(clearTimeout);
  }, [task.microSteps, isDecomposing]);

  const showGlow = justDecomposed && visibleSteps === (task.microSteps?.length ?? 0) && visibleSteps > 0;

  return (
    <div
      className={[
        styles.item,
        expanded && hasSteps ? styles.expanded : "",
        isDecomposing && !hasSteps ? styles.decomposing : "",
        showGlow ? styles.glowDone : "",
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
        <div className={`${styles.name} ${task.done ? styles.nameDone : ""}`}>
          {task.name}
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

        {/* Loading skeleton */}
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

        {/* Decompose button */}
        {canDecompose && onDecompose && (
          <button
            className={styles.decomposeBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDecompose(task.id);
            }}
          >
            <span className={styles.decomposeIcon}>✦</span>
            Décomposer par IA
          </button>
        )}

        {/* Expand/collapse for existing steps */}
        {hasSteps && !isDecomposing && (
          <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
            <span>{expanded ? "▾" : "▸"}</span>
            <span>{task.microSteps!.length} étapes · décomposé par IA</span>
            {task.aiDecomposed && <span className={styles.aiBadge}>IA</span>}
          </button>
        )}

        {/* Micro-steps with stagger reveal */}
        {expanded && hasSteps && (
          <div className={styles.microSteps}>
            {task.microSteps!.map((step, i) => (
              <button
                key={step.id}
                className={`${styles.microStep} ${
                  i < visibleSteps ? styles.stepVisible : styles.stepHidden
                }`}
                style={{
                  transitionDelay: justDecomposed ? `${i * 0.05}s` : "0s",
                }}
                onClick={() => onToggleStep(task.id, step.id)}
              >
                <div
                  className={`${styles.stepDot} ${
                    step.done ? styles.stepDotDone : ""
                  }`}
                />
                <div
                  className={`${styles.stepText} ${
                    step.done ? styles.stepTextDone : ""
                  }`}
                >
                  {step.text}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
