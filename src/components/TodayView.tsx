import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import PrepBanner from "./PrepBanner";
import FocusNow from "./FocusNow";
import FocusTimer from "./FocusTimer";
import ProgressBar from "./ProgressBar";
import SortableTaskItem from "./SortableTaskItem";
import TaskItem from "./TaskItem";
import type { Task, MicroStep } from "../types";
import { getTasks as fetchTasks, getOverdueTasks, toggleTask as toggleTaskSvc, deleteTask as deleteTaskSvc, updateTask as updateTaskSvc, reorderTasks as reorderTasksSvc, setMicroSteps, getStreak } from "../services/tasks";
import { decomposeTask } from "../services/chat";
import { getSetting, setSetting } from "../services/settings";
import styles from "./TodayView.module.css";

const MAIN_DROP_ID = "drop:main";

function DroppableEmptyZone({ id, label }: { id: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${styles.emptyDropZone} ${isOver ? styles.emptyDropZoneOver : ""}`}>
      {label}
    </div>
  );
}

function todayKey(): string {
  return `daily-prep-${new Date().toISOString().slice(0, 10)}`;
}

interface TodayViewProps {
  dailyPriorityCount: number;
  onLaunchDailyPrep?: () => void;
  onStuck?: (taskId: string, taskName: string) => void;
  refreshKey?: number;
}

export default function TodayView({ dailyPriorityCount, onLaunchDailyPrep, onStuck, refreshKey }: TodayViewProps) {
  const [prepDone, setPrepDone] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [streak, setStreak] = useState(0);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const [decomposingStepKey, setDecomposingStepKey] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks("today")
      .then((fetched) => {
        let mainCount = fetched.filter((t) => t.priority === "main").length;
        const initialized = fetched.map((t) => {
          if (t.priority === "main" || t.priority === "secondary") return t;
          const p: "main" | "secondary" = mainCount < dailyPriorityCount ? "main" : "secondary";
          if (p === "main") mainCount++;
          updateTaskSvc({ id: t.id, priority: p }).catch(() => {});
          return { ...t, priority: p };
        });
        setTasks(initialized);
      })
      .catch((err) => console.error("[TodayView] fetchTasks error:", err));
    getOverdueTasks()
      .then(setOverdueTasks)
      .catch((err) => console.error("[TodayView] getOverdueTasks error:", err));
    getStreak()
      .then(setStreak)
      .catch((err) => console.error("[TodayView] getStreak error:", err));
    getSetting(todayKey())
      .then((val) => setPrepDone(val === "done"))
      .catch(() => {});
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTasks((prev) => {
      const main = prev.filter((t) => t.priority === "main");
      if (main.length <= dailyPriorityCount) return prev;
      const excessIds = new Set(main.slice(dailyPriorityCount).map((t) => t.id));
      excessIds.forEach((id) => updateTaskSvc({ id, priority: "secondary" }).catch(() => {}));
      return prev.map((t) => excessIds.has(t.id) ? { ...t, priority: "secondary" as const } : t);
    });
  }, [dailyPriorityCount]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const mainTasks = tasks.filter((t) => t.priority === "main");
  const secondaryTasks = tasks.filter((t) => t.priority !== "main");
  const doneCount = tasks.filter((t) => t.done).length;
  const mainDoneCount = mainTasks.filter((t) => t.done).length;
  const secondaryDoneCount = secondaryTasks.filter((t) => t.done).length;

  const defaultFocusId = mainTasks.find((t) => !t.done && t.estimatedMinutes)?.id ?? null;
  const effectiveSelectedId = selectedTaskId ?? defaultFocusId;
  const selectedTask = effectiveSelectedId ? tasks.find((t) => t.id === effectiveSelectedId) : null;
  const timerTask = timerTaskId ? tasks.find((t) => t.id === timerTaskId) : null;
  const showTimerPanel = timerTaskId !== null && effectiveSelectedId === timerTaskId;
  const isBusy = !!decomposingId || !!decomposingStepKey;

  function updateTaskState(updater: (tasks: Task[]) => Task[]) {
    setTasks(updater);
    setOverdueTasks(updater);
  }

  function commitTasks(newMain: Task[], newSec: Task[]) {
    const combined = [...newMain, ...newSec];
    setTasks(combined);
    reorderTasksSvc(combined.map((t) => t.id));
  }

  function toggleTask(id: string) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    toggleTaskSvc(id);
  }

  function deleteTask(id: string) {
    updateTaskState((prev) => prev.filter((t) => t.id !== id));
    deleteTaskSvc(id).catch((err) => console.error("[TodayView] deleteTask error:", err));
  }

  function setPriority(id: string, field: "urgency" | "importance", value: number | undefined) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    updateTaskSvc({ id, [field]: value ?? 0 }).catch((err) => console.error("[TodayView] setPriority error:", err));
  }

  function setScheduledDate(id: string, date: string | undefined) {
    const today = new Date().toISOString().slice(0, 10);
    if (date === today || date === undefined) {
      const overdueTask = overdueTasks.find((t) => t.id === id);
      if (overdueTask) {
        setOverdueTasks((prev) => prev.filter((t) => t.id !== id));
        const keepPriority = overdueTask.priority ?? "secondary";
        setTasks((prev) => [...prev, { ...overdueTask, scheduledDate: date, priority: keepPriority }]);
        updateTaskSvc({ id, scheduledDate: date }).catch((err) => console.error("[TodayView] setScheduledDate error:", err));
        return;
      }
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, scheduledDate: date } : t));
    } else {
      updateTaskState((prev) => prev.filter((t) => t.id !== id));
    }
    updateTaskSvc({ id, scheduledDate: date }).catch((err) => console.error("[TodayView] setScheduledDate error:", err));
  }

  function renameTask(id: string, name: string) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    updateTaskSvc({ id, name }).catch((err) => console.error("[TodayView] renameTask error:", err));
  }

  function toggleStep(taskId: string, stepId: string) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return { ...t, microSteps: t.microSteps.map((s) => s.id === stepId ? { ...s, done: !s.done } : s) };
      })
    );
  }

  function updateEstimate(taskId: string, minutes: number | undefined) {
    updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, estimatedMinutes: minutes } : t));
  }

  function updateStepEstimate(taskId: string, stepId: string, minutes: number | undefined) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return { ...t, microSteps: t.microSteps.map((s) => s.id === stepId ? { ...s, estimatedMinutes: minutes } : s) };
      })
    );
  }

  function editStep(taskId: string, stepId: string, text: string) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return { ...t, microSteps: t.microSteps.map((s) => s.id === stepId ? { ...s, text } : s) };
      })
    );
  }

  function findTask(taskId: string): Task | undefined {
    return tasks.find((t) => t.id === taskId) ?? overdueTasks.find((t) => t.id === taskId);
  }

  function decompose(taskId: string, redo = false) {
    if (isBusy) return;
    const task = findTask(taskId);
    if (!task) return;

    if (redo) {
      updateTaskState((prev) =>
        prev.map((t) => t.id === taskId ? { ...t, microSteps: undefined, aiDecomposed: false } : t)
      );
    }

    setDecomposingId(taskId);

    decomposeTask(task.name)
      .then((result) => {
        const prefix = redo ? "rs" : "s";
        const steps = result.map((s, i) => ({
          id: `${taskId}-${prefix}${i}`,
          text: s.text,
          done: false,
          estimatedMinutes: s.estimatedMinutes,
        }));
        updateTaskState((prev) =>
          prev.map((t) => t.id === taskId ? { ...t, microSteps: steps, aiDecomposed: true } : t)
        );
        setMicroSteps(taskId, steps).catch(() => {});
        setTimeout(() => setDecomposingId(null), steps.length * 300 + 500);
      })
      .catch((err) => {
        console.error("[TodayView] decompose error:", err);
        setDecomposingId(null);
      });
  }

  function decomposeStep(taskId: string, stepId: string) {
    if (isBusy) return;
    const task = findTask(taskId);
    const step = task?.microSteps?.find((s) => s.id === stepId);
    if (!task || !step) return;

    setDecomposingStepKey(`${taskId}:${stepId}`);

    decomposeTask(step.text, `Sous-étape de la tâche "${task.name}"`)
      .then((result) => {
        const subSteps = result.map((s, i) => ({
          id: `${stepId}-sub${i}`,
          text: s.text,
          done: false,
          estimatedMinutes: s.estimatedMinutes,
        }));
        let finalSteps: MicroStep[] | undefined;
        updateTaskState((prev) =>
          prev.map((t) => {
            if (t.id !== taskId || !t.microSteps) return t;
            const idx = t.microSteps.findIndex((s) => s.id === stepId);
            if (idx === -1) return t;
            const newSteps = [...t.microSteps];
            newSteps.splice(idx, 1, ...subSteps);
            finalSteps = newSteps;
            return { ...t, microSteps: newSteps };
          })
        );
        if (finalSteps) setMicroSteps(taskId, finalSteps).catch(() => {});
        setDecomposingStepKey(null);
      })
      .catch((err) => {
        console.error("[TodayView] decomposeStep error:", err);
        setDecomposingStepKey(null);
      });
  }

  function completeTimerTask() {
    if (timerTaskId) {
      updateTaskState((prev) => prev.map((t) => (t.id === timerTaskId ? { ...t, done: true } : t)));
      toggleTaskSvc(timerTaskId);
      if (selectedTaskId === timerTaskId) setSelectedTaskId(null);
    }
    setTimerTaskId(null);
  }

  function getNextFocusTask(): string | undefined {
    return mainTasks.find((t) => !t.done && t.id !== timerTaskId && t.estimatedMinutes)?.name;
  }

  function getDecomposingStepId(taskId: string): string | null {
    if (!decomposingStepKey) return null;
    const sepIdx = decomposingStepKey.indexOf(":");
    return decomposingStepKey.substring(0, sepIdx) === taskId
      ? decomposingStepKey.substring(sepIdx + 1)
      : null;
  }

  // --- Drag & Drop ---

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = over.id as string;

    // Drop on empty main zone
    if (overId === MAIN_DROP_ID) {
      const secIdx = secondaryTasks.findIndex((t) => t.id === active.id);
      const overdueIdx = overdueTasks.findIndex((t) => t.id === active.id);
      if (secIdx !== -1 && mainTasks.length < dailyPriorityCount) {
        const task = secondaryTasks[secIdx];
        commitTasks([{ ...task, priority: "main" as const }], secondaryTasks.filter((t) => t.id !== task.id));
        updateTaskSvc({ id: task.id, priority: "main" }).catch(() => {});
      } else if (overdueIdx !== -1) {
        const movedTask = overdueTasks[overdueIdx];
        const today = new Date().toISOString().slice(0, 10);
        const priority: "main" | "secondary" = mainTasks.length < dailyPriorityCount ? "main" : "secondary";
        setOverdueTasks((prev) => prev.filter((t) => t.id !== active.id));
        commitTasks([...mainTasks, { ...movedTask, scheduledDate: today, priority }], secondaryTasks);
        updateTaskSvc({ id: movedTask.id, scheduledDate: today, priority }).catch(() => {});
      }
      return;
    }

    const activeMainIdx = mainTasks.findIndex((t) => t.id === active.id);
    const activeSecIdx = secondaryTasks.findIndex((t) => t.id === active.id);
    const activeOverdueIdx = overdueTasks.findIndex((t) => t.id === active.id);
    const overMainIdx = mainTasks.findIndex((t) => t.id === over.id);
    const overSecIdx = secondaryTasks.findIndex((t) => t.id === over.id);

    // Overdue → Today
    if (activeOverdueIdx !== -1 && (overMainIdx !== -1 || overSecIdx !== -1)) {
      const movedTask = overdueTasks[activeOverdueIdx];
      const today = new Date().toISOString().slice(0, 10);
      const toMain = overMainIdx !== -1 && mainTasks.length < dailyPriorityCount;
      const priority: "main" | "secondary" = toMain ? "main" : "secondary";
      setOverdueTasks((prev) => prev.filter((t) => t.id !== active.id));
      const task = { ...movedTask, scheduledDate: today, priority };
      if (toMain) {
        const newMain = [...mainTasks];
        newMain.splice(overMainIdx, 0, task);
        commitTasks(newMain, secondaryTasks);
      } else {
        const newSec = [...secondaryTasks];
        newSec.splice(overSecIdx !== -1 ? overSecIdx : newSec.length, 0, task);
        commitTasks(mainTasks, newSec);
      }
      updateTaskSvc({ id: movedTask.id, scheduledDate: today, priority }).catch(() => {});
      return;
    }

    // Reorder within main
    if (activeMainIdx !== -1 && overMainIdx !== -1) {
      commitTasks(arrayMove(mainTasks, activeMainIdx, overMainIdx), secondaryTasks);
      return;
    }

    // Reorder within secondary
    if (activeSecIdx !== -1 && overSecIdx !== -1) {
      commitTasks(mainTasks, arrayMove(secondaryTasks, activeSecIdx, overSecIdx));
      return;
    }

    // Main → Secondary (demote)
    if (activeMainIdx !== -1 && overSecIdx !== -1) {
      const task = mainTasks[activeMainIdx];
      const newSec = [...secondaryTasks];
      newSec.splice(overSecIdx, 0, { ...task, priority: "secondary" as const });
      commitTasks(mainTasks.filter((t) => t.id !== task.id), newSec);
      updateTaskSvc({ id: task.id, priority: "secondary" }).catch(() => {});
      return;
    }

    // Secondary → Main (promote or swap)
    if (activeSecIdx !== -1 && overMainIdx !== -1) {
      const task = secondaryTasks[activeSecIdx];
      if (mainTasks.length < dailyPriorityCount) {
        const newMain = [...mainTasks];
        newMain.splice(overMainIdx, 0, { ...task, priority: "main" as const });
        commitTasks(newMain, secondaryTasks.filter((t) => t.id !== task.id));
        updateTaskSvc({ id: task.id, priority: "main" }).catch(() => {});
      } else {
        const demoted = mainTasks[overMainIdx];
        const newMain = mainTasks.map((t) =>
          t.id === demoted.id ? { ...task, priority: "main" as const } : t
        );
        const newSec = secondaryTasks.map((t) =>
          t.id === task.id ? { ...demoted, priority: "secondary" as const } : t
        );
        commitTasks(newMain, newSec);
        updateTaskSvc({ id: task.id, priority: "main" }).catch(() => {});
        updateTaskSvc({ id: demoted.id, priority: "secondary" }).catch(() => {});
      }
    }
  }

  const activeTask = activeId
    ? (tasks.find((t) => t.id === activeId) ?? overdueTasks.find((t) => t.id === activeId))
    : null;

  const handleStuck = useCallback((taskId: string) => {
    const allTasks = [...tasks, ...overdueTasks];
    const task = allTasks.find((t) => t.id === taskId);
    if (task && onStuck) onStuck(taskId, task.name);
  }, [tasks, overdueTasks, onStuck]);

  const taskCallbacks = {
    onToggle: toggleTask,
    onToggleStep: toggleStep,
    onDecompose: decompose,
    onRedecompose: (id: string) => decompose(id, true),
    onDecomposeStep: decomposeStep,
    onEditStep: editStep,
    onStuck: handleStuck,
    onUpdateEstimate: updateEstimate,
    onUpdateStepEstimate: updateStepEstimate,
    onDelete: deleteTask,
    onRename: renameTask,
    onSetScheduledDate: setScheduledDate,
    onSetPriority: setPriority,
  };

  const dismissPrep = useCallback(() => {
    setSetting(todayKey(), "done").catch(() => {});
    setPrepDone(true);
  }, []);

  const launchPrep = useCallback(() => {
    dismissPrep();
    onLaunchDailyPrep?.();
  }, [dismissPrep, onLaunchDailyPrep]);

  return (
    <div>
      {!prepDone && (
        <PrepBanner variant="daily" onLaunch={launchPrep} onDismiss={dismissPrep} />
      )}

      {timerTask && timerTask.estimatedMinutes && (
        <div style={{ display: showTimerPanel ? undefined : "none" }}>
          <FocusTimer
            key={timerTask.id}
            taskName={timerTask.name}
            estimatedMinutes={timerTask.estimatedMinutes}
            nextTaskName={getNextFocusTask()}
            onComplete={completeTimerTask}
            onSkip={() => setTimerTaskId(null)}
            onCancel={() => setTimerTaskId(null)}
          />
        </div>
      )}

      <ProgressBar done={doneCount} total={tasks.length} streak={streak} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <span className={styles.priorityIcon}>⚡</span>
            Priorités du jour
          </span>
          <span className={styles.sectionCount}>
            {mainDoneCount}/
            <span className={mainTasks.length > dailyPriorityCount ? styles.sectionCountOverflow : undefined}>
              {mainTasks.length}
            </span>
            {mainTasks.length > dailyPriorityCount && (
              <span className={styles.overflowHint}>
                (max {dailyPriorityCount})
              </span>
            )}
          </span>
        </div>

        <SortableContext items={mainTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.taskList}>
            {mainTasks.length === 0 && (
              <DroppableEmptyZone id={MAIN_DROP_ID} label="Glisse une tâche ici pour la prioriser" />
            )}
            {mainTasks.map((task, i) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                {...taskCallbacks}
                isDecomposing={decomposingId === task.id}
                decomposingStepId={getDecomposingStepId(task.id)}
                animDelay={0.08 + i * 0.04}
                isSelected={effectiveSelectedId === task.id}
                hasRunningTimer={timerTaskId === task.id}
                onSelect={setSelectedTaskId}
              />
            ))}
          </div>
        </SortableContext>

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

            <SortableContext items={secondaryTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {secondaryTasks.map((task, i) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    {...taskCallbacks}
                    isDecomposing={decomposingId === task.id}
                    decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.12 + i * 0.04}
                    isSecondary
                    isSelected={effectiveSelectedId === task.id}
                    hasRunningTimer={timerTaskId === task.id}
                    onSelect={setSelectedTaskId}
                  />
                ))}
              </div>
            </SortableContext>
          </>
        )}

        {overdueTasks.length > 0 && (
          <>
            <div className={`${styles.sectionHeader} ${styles.overdueHeader}`}>
              <span className={`${styles.sectionTitle} ${styles.overdueTitle}`}>
                <span className={styles.priorityIcon}>📋</span>
                Reliquat des jours précédents
              </span>
              <span className={styles.sectionCount}>
                {overdueTasks.length}
              </span>
            </div>

            <SortableContext items={overdueTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {overdueTasks.map((task, i) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    {...taskCallbacks}
                    isDecomposing={decomposingId === task.id}
                    decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.16 + i * 0.04}
                    isSecondary
                  />
                ))}
              </div>
            </SortableContext>
          </>
        )}

        <DragOverlay>
          {activeTask && (
            <div className={styles.dragOverlay}>
              <TaskItem
                task={activeTask}
                onToggle={() => {}}
                onToggleStep={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className={styles.reviewSection}>
        <div className={styles.reviewIcon}>🌙</div>
        <div className={styles.reviewContent}>
          <span className={styles.reviewTitle}>Revue du soir</span>
          <span className={styles.reviewDesc}>
            Fais le bilan de ta journée : ce que tu as accompli, les blocages, et ton top 3 de demain.
          </span>
        </div>
        <button className={styles.reviewBtn}>Lancer la revue</button>
      </div>

      {!showTimerPanel && selectedTask && selectedTask.estimatedMinutes && !selectedTask.done && (
        <FocusNow
          task={selectedTask.name}
          estimatedMinutes={selectedTask.estimatedMinutes}
          onStart={() => setTimerTaskId(effectiveSelectedId!)}
        />
      )}
    </div>
  );
}
