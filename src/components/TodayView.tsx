import { useState, useCallback } from "react";
import FocusNow from "./FocusNow";
import FocusTimer from "./FocusTimer";
import ProgressBar from "./ProgressBar";
import TaskItem from "./TaskItem";
import type { Task } from "../types";
import { initialTodayTasks, mockDecompositions, mockStepDecompositions } from "../data/mockTasks";
import styles from "./TodayView.module.css";

const DECOMPOSE_DELAY_MS = 1800;
const MOCK_STREAK = 5;

interface TodayViewProps {
  dailyPriorityCount: number;
}

export default function TodayView({ dailyPriorityCount }: TodayViewProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTodayTasks);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const [decomposingStepKey, setDecomposingStepKey] = useState<string | null>(null);
  const [focusingTaskId, setFocusingTaskId] = useState<string | null>(null);

  const sorted = [...tasks].sort((a, b) => {
    const pa = a.priority === "main" ? 0 : 1;
    const pb = b.priority === "main" ? 0 : 1;
    return pa - pb;
  });
  const mainTasks = sorted.slice(0, dailyPriorityCount);
  const secondaryTasks = sorted.slice(dailyPriorityCount);
  const doneCount = tasks.filter((t) => t.done).length;
  const mainDoneCount = mainTasks.filter((t) => t.done).length;
  const secondaryDoneCount = secondaryTasks.filter((t) => t.done).length;
  const focusTask = mainTasks.find((t) => !t.done && t.estimatedMinutes);
  const focusingTask = focusingTaskId ? tasks.find((t) => t.id === focusingTaskId) : null;

  const isBusy = !!decomposingId || !!decomposingStepKey;

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

  function updateEstimate(taskId: string, minutes: number | undefined) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, estimatedMinutes: minutes } : t
      )
    );
  }

  function updateStepEstimate(
    taskId: string,
    stepId: string,
    minutes: number | undefined
  ) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return {
          ...t,
          microSteps: t.microSteps.map((s) =>
            s.id === stepId ? { ...s, estimatedMinutes: minutes } : s
          ),
        };
      })
    );
  }

  function editStep(taskId: string, stepId: string, text: string) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return {
          ...t,
          microSteps: t.microSteps.map((s) =>
            s.id === stepId ? { ...s, text } : s
          ),
        };
      })
    );
  }

  const decompose = useCallback(
    (taskId: string) => {
      if (isBusy) return;
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
    },
    [isBusy]
  );

  function redecompose(taskId: string) {
    if (isBusy) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, microSteps: undefined, aiDecomposed: false }
          : t
      )
    );

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
  }

  function decomposeStep(taskId: string, stepId: string) {
    if (isBusy) return;

    setDecomposingStepKey(`${taskId}:${stepId}`);

    const subSteps = mockStepDecompositions[stepId];
    if (!subSteps) {
      setDecomposingStepKey(null);
      return;
    }

    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId || !t.microSteps) return t;
          const idx = t.microSteps.findIndex((s) => s.id === stepId);
          if (idx === -1) return t;
          const newSteps = [...t.microSteps];
          newSteps.splice(idx, 1, ...subSteps);
          return { ...t, microSteps: newSteps };
        })
      );
      setDecomposingStepKey(null);
    }, DECOMPOSE_DELAY_MS);
  }

  function handleStuck(taskId: string) {
    console.log("Stuck on task:", taskId);
  }

  function startFocus(taskId: string) {
    setFocusingTaskId(taskId);
  }

  function completeFocusedTask() {
    if (focusingTaskId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === focusingTaskId ? { ...t, done: true } : t))
      );
    }
    setFocusingTaskId(null);
  }

  function skipFocusedTask() {
    setFocusingTaskId(null);
  }

  function cancelFocus() {
    setFocusingTaskId(null);
  }

  function getNextFocusTask(): string | undefined {
    const remaining = mainTasks.filter(
      (t) => !t.done && t.id !== focusingTaskId && t.estimatedMinutes
    );
    return remaining[0]?.name;
  }

  function getDecomposingStepId(taskId: string): string | null {
    if (!decomposingStepKey) return null;
    const sepIdx = decomposingStepKey.indexOf(":");
    const tId = decomposingStepKey.substring(0, sepIdx);
    const sId = decomposingStepKey.substring(sepIdx + 1);
    return tId === taskId ? sId : null;
  }

  return (
    <div>
      {focusingTask && focusingTask.estimatedMinutes ? (
        <FocusTimer
          key={focusingTask.id}
          taskName={focusingTask.name}
          estimatedMinutes={focusingTask.estimatedMinutes}
          nextTaskName={getNextFocusTask()}
          onComplete={completeFocusedTask}
          onSkip={skipFocusedTask}
          onCancel={cancelFocus}
        />
      ) : focusTask ? (
        <FocusNow
          task={focusTask.name}
          estimatedMinutes={focusTask.estimatedMinutes!}
          onStart={() => startFocus(focusTask.id)}
        />
      ) : null}

      <ProgressBar done={doneCount} total={tasks.length} streak={MOCK_STREAK} />

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>
          <span className={styles.priorityIcon}>⚡</span>
          Priorités du jour
        </span>
        <span className={styles.sectionCount}>
          {mainDoneCount}/{mainTasks.length}
        </span>
      </div>

      <div className={styles.taskList}>
        {mainTasks.map((task, i) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={toggleTask}
            onToggleStep={toggleStep}
            onDecompose={decompose}
            onRedecompose={redecompose}
            onDecomposeStep={decomposeStep}
            onEditStep={editStep}
            onStuck={handleStuck}
            onUpdateEstimate={updateEstimate}
            onUpdateStepEstimate={updateStepEstimate}
            isDecomposing={decomposingId === task.id}
            decomposingStepId={getDecomposingStepId(task.id)}
            animDelay={0.08 + i * 0.04}
          />
        ))}
      </div>

      {secondaryTasks.length > 0 && (
        <>
          <div className={`${styles.sectionHeader} ${styles.secondaryHeader}`}>
            <span className={`${styles.sectionTitle} ${styles.secondaryTitle}`}>
              Aussi prévu
            </span>
            <span className={styles.sectionCount}>
              {secondaryDoneCount}/{secondaryTasks.length}
            </span>
          </div>

          <div className={styles.taskList}>
            {secondaryTasks.map((task, i) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={toggleTask}
                onToggleStep={toggleStep}
                onDecompose={decompose}
                onRedecompose={redecompose}
                onDecomposeStep={decomposeStep}
                onEditStep={editStep}
                onStuck={handleStuck}
                onUpdateEstimate={updateEstimate}
                onUpdateStepEstimate={updateStepEstimate}
                isDecomposing={decomposingId === task.id}
                decomposingStepId={getDecomposingStepId(task.id)}
                animDelay={0.12 + i * 0.04}
                isSecondary
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
