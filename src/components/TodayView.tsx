import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PrepBanner from "./PrepBanner";
import FocusNow from "./FocusNow";
import FocusTimer from "./FocusTimer";
import ProgressBar from "./ProgressBar";
import TaskItem from "./TaskItem";
import type { Task } from "../types";
import { getTasks as fetchTasks, getOverdueTasks, toggleTask as toggleTaskSvc, deleteTask as deleteTaskSvc, updateTask as updateTaskSvc, reorderTasks as reorderTasksSvc, setMicroSteps, getStreak } from "../services/tasks";
import { decomposeTask } from "../services/chat";
import { getSetting, setSetting } from "../services/settings";
import styles from "./TodayView.module.css";

function todayKey(): string {
  return `daily-prep-${new Date().toISOString().slice(0, 10)}`;
}

function SortableTaskItem(props: React.ComponentProps<typeof TaskItem>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

interface TodayViewProps {
  dailyPriorityCount: number;
  onLaunchDailyPrep?: () => void;
  refreshKey?: number;
}

export default function TodayView({ dailyPriorityCount, onLaunchDailyPrep, refreshKey }: TodayViewProps) {
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
      .then(setTasks)
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
  }, [refreshKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const mainTasks = tasks.slice(0, dailyPriorityCount);
  const secondaryTasks = tasks.slice(dailyPriorityCount);
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

  function toggleTask(id: string) {
    updateTaskState((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    toggleTaskSvc(id);
  }

  function deleteTask(id: string) {
    updateTaskState((prev) => prev.filter((t) => t.id !== id));
    deleteTaskSvc(id).catch((err) => console.error("[TodayView] deleteTask error:", err));
  }

  function setScheduledDate(id: string, date: string | undefined) {
    const today = new Date().toISOString().slice(0, 10);
    if (date === today || date === undefined) {
      const overdueTask = overdueTasks.find((t) => t.id === id);
      if (overdueTask) {
        setOverdueTasks((prev) => prev.filter((t) => t.id !== id));
        setTasks((prev) => [...prev, { ...overdueTask, scheduledDate: date }]);
      } else {
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, scheduledDate: date } : t));
      }
    } else {
      updateTaskState((prev) => prev.filter((t) => t.id !== id));
    }
    updateTaskSvc({ id, scheduledDate: date }).catch((err) => console.error("[TodayView] setScheduledDate error:", err));
  }

  function renameTask(id: string, name: string) {
    updateTaskState((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t))
    );
    updateTaskSvc({ id, name }).catch((err) => console.error("[TodayView] renameTask error:", err));
  }

  function toggleStep(taskId: string, stepId: string) {
    updateTaskState((prev) =>
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
    updateTaskState((prev) =>
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
    updateTaskState((prev) =>
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
    updateTaskState((prev) =>
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

  function findTask(taskId: string): Task | undefined {
    return tasks.find((t) => t.id === taskId) ?? overdueTasks.find((t) => t.id === taskId);
  }

  function decompose(taskId: string, redo = false) {
    if (isBusy) return;
    const task = findTask(taskId);
    if (!task) return;

    if (redo) {
      updateTaskState((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, microSteps: undefined, aiDecomposed: false }
            : t
        )
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
          prev.map((t) =>
            t.id === taskId
              ? { ...t, microSteps: steps, aiDecomposed: true }
              : t
          )
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

        let finalSteps: typeof subSteps | undefined;
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

        if (finalSteps) {
          setMicroSteps(taskId, finalSteps).catch(() => {});
        }

        setDecomposingStepKey(null);
      })
      .catch((err) => {
        console.error("[TodayView] decomposeStep error:", err);
        setDecomposingStepKey(null);
      });
  }

  function selectTask(id: string) {
    setSelectedTaskId(id);
  }

  function startTimer(taskId: string) {
    setTimerTaskId(taskId);
  }

  function completeTimerTask() {
    if (timerTaskId) {
      updateTaskState((prev) =>
        prev.map((t) => (t.id === timerTaskId ? { ...t, done: true } : t))
      );
      toggleTaskSvc(timerTaskId);
      if (selectedTaskId === timerTaskId) {
        setSelectedTaskId(null);
      }
    }
    setTimerTaskId(null);
  }

  function stopTimer() {
    setTimerTaskId(null);
  }

  function getNextFocusTask(): string | undefined {
    const remaining = mainTasks.filter(
      (t) => !t.done && t.id !== timerTaskId && t.estimatedMinutes
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

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeInToday = tasks.findIndex((t) => t.id === active.id);
    const activeInOverdue = overdueTasks.findIndex((t) => t.id === active.id);
    const overInToday = tasks.findIndex((t) => t.id === over.id);

    if (activeInOverdue !== -1 && overInToday !== -1) {
      const movedTask = overdueTasks[activeInOverdue];
      const today = new Date().toISOString().slice(0, 10);
      setOverdueTasks((prev) => prev.filter((t) => t.id !== active.id));
      setTasks((prev) => {
        const updated = [...prev];
        updated.splice(overInToday, 0, { ...movedTask, scheduledDate: today });
        return updated;
      });
      updateTaskSvc({ id: movedTask.id, scheduledDate: today }).catch((err) =>
        console.error("[TodayView] move overdue to today error:", err)
      );
      setTasks((current) => {
        reorderTasksSvc(current.map((t) => t.id));
        return current;
      });
    } else if (activeInToday !== -1 && overInToday !== -1) {
      const reordered = arrayMove(tasks, activeInToday, overInToday);
      setTasks(reordered);
      reorderTasksSvc(reordered.map((t) => t.id));
    }
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  const activeTask = activeId
    ? (tasks.find((t) => t.id === activeId) ?? overdueTasks.find((t) => t.id === activeId))
    : null;
  const allSortableIds = [...tasks.map((t) => t.id), ...overdueTasks.map((t) => t.id)];

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
            onSkip={stopTimer}
            onCancel={stopTimer}
          />
        </div>
      )}

      {!showTimerPanel && selectedTask && selectedTask.estimatedMinutes && !selectedTask.done && (
        <FocusNow
          task={selectedTask.name}
          estimatedMinutes={selectedTask.estimatedMinutes}
          onStart={() => startTimer(effectiveSelectedId!)}
        />
      )}

      <ProgressBar done={doneCount} total={tasks.length} streak={streak} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
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
              <SortableTaskItem
                key={task.id}
                task={task}
                onToggle={toggleTask}
                onToggleStep={toggleStep}
                onDecompose={decompose}
                onRedecompose={(id) => decompose(id, true)}
                onDecomposeStep={decomposeStep}
                onEditStep={editStep}
                onUpdateEstimate={updateEstimate}
                onUpdateStepEstimate={updateStepEstimate}
                onDelete={deleteTask}
                onRename={renameTask}
                onSetScheduledDate={setScheduledDate}
                isDecomposing={decomposingId === task.id}
                decomposingStepId={getDecomposingStepId(task.id)}
                animDelay={0.08 + i * 0.04}
                isSelected={effectiveSelectedId === task.id}
                hasRunningTimer={timerTaskId === task.id}
                onSelect={selectTask}
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
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onToggleStep={toggleStep}
                    onDecompose={decompose}
                    onRedecompose={(id) => decompose(id, true)}
                    onDecomposeStep={decomposeStep}
                    onEditStep={editStep}
                    onUpdateEstimate={updateEstimate}
                    onUpdateStepEstimate={updateStepEstimate}
                    onDelete={deleteTask}
                    onRename={renameTask}
                    onSetScheduledDate={setScheduledDate}
                    isDecomposing={decomposingId === task.id}
                    decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.12 + i * 0.04}
                    isSecondary
                    isSelected={effectiveSelectedId === task.id}
                    hasRunningTimer={timerTaskId === task.id}
                    onSelect={selectTask}
                  />
                ))}
              </div>
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

              <div className={styles.taskList}>
                {overdueTasks.map((task, i) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onToggleStep={toggleStep}
                    onDecompose={decompose}
                    onRedecompose={(id) => decompose(id, true)}
                    onDecomposeStep={decomposeStep}
                    onEditStep={editStep}
                    onUpdateEstimate={updateEstimate}
                    onUpdateStepEstimate={updateStepEstimate}
                    onDelete={deleteTask}
                    onRename={renameTask}
                    onSetScheduledDate={setScheduledDate}
                    isDecomposing={decomposingId === task.id}
                    decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.16 + i * 0.04}
                    isSecondary
                  />
                ))}
              </div>
            </>
          )}
        </SortableContext>

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
    </div>
  );
}
