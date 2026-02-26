import { useState, useCallback } from "react";
import FocusNow from "./FocusNow";
import ProgressBar from "./ProgressBar";
import TaskItem from "./TaskItem";
import type { Task } from "../types";
import { initialTodayTasks, mockDecompositions } from "../data/mockTasks";
import styles from "./TodayView.module.css";

const DECOMPOSE_DELAY_MS = 1800;

export default function TodayView() {
  const [tasks, setTasks] = useState<Task[]>(initialTodayTasks);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const doneCount = tasks.filter((t) => t.done).length;
  const focusTask = tasks.find((t) => !t.done && t.estimatedMinutes);

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function toggleStep(taskId: string, stepId: string) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return {
          ...t,
          microSteps: t.microSteps.map((s) =>
            s.id === stepId ? { ...s, done: !s.done } : s
          ),
        };
      })
    );
  }

  const decompose = useCallback((taskId: string) => {
    if (decomposingId) return;
    setDecomposingId(taskId);

    const steps = mockDecompositions[taskId];
    if (!steps) {
      setDecomposingId(null);
      return;
    }

    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, microSteps: steps, aiDecomposed: true }
            : t
        )
      );

      setTimeout(() => setDecomposingId(null), steps.length * 300 + 500);
    }, DECOMPOSE_DELAY_MS);
  }, [decomposingId]);

  return (
    <div>
      {focusTask && (
        <FocusNow
          task={focusTask.name}
          estimatedMinutes={focusTask.estimatedMinutes!}
          onStart={() => {}}
        />
      )}

      <ProgressBar done={doneCount} total={tasks.length} />

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Tâches du jour</span>
        <button className={styles.sectionAction}>+ Ajouter</button>
      </div>

      <div className={styles.taskList}>
        {tasks.map((task, i) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={toggleTask}
            onToggleStep={toggleStep}
            onDecompose={decompose}
            isDecomposing={decomposingId === task.id}
            animDelay={0.08 + i * 0.04}
          />
        ))}
      </div>
    </div>
  );
}
