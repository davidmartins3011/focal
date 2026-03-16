import { useState, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
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
import DroppableEmptyZone from "./DroppableEmptyZone";
import type { Task } from "../types";
import { getTasks as fetchTasks, getTasksByDate, getOverdueTasks, getOverdueTasksForDate, updateTask as updateTaskSvc, reorderTasks as reorderTasksSvc, getStreak } from "../services/tasks";
import { getSetting, setSetting } from "../services/settings";
import { dayClosedKey, dayPrepKey, toISODate } from "../utils/dateFormat";
import { sortOverdueTasks } from "../utils/taskUtils";
import useTaskActions from "../hooks/useTaskActions";
import styles from "./TodayView.module.css";

const MAIN_DROP_ID = "drop:main";

function initializePriorities(tasks: Task[], maxMain: number): Task[] {
  let mainCount = tasks.filter((t) => t.priority === "main").length;
  return tasks.map((t) => {
    if (t.priority === "main" || t.priority === "secondary") return t;
    const p: "main" | "secondary" = mainCount < maxMain ? "main" : "secondary";
    if (p === "main") mainCount++;
    updateTaskSvc({ id: t.id, priority: p }).catch(() => {});
    return { ...t, priority: p };
  });
}

interface TodayViewProps {
  dailyPriorityCount: number;
  onLaunchDailyPrep?: () => void;
  onStuck?: (taskId: string, taskName: string) => void;
  refreshKey?: number;
  /** ISO date to display (defaults to today). */
  viewDate?: string;
  /** Planning-only mode: no review/close actions, no overdue, no timer. */
  isPlanning?: boolean;
  /** Whether the current day has been marked as done (controls UI in today mode). */
  isDayCompleted?: boolean;
  /** Called when the user marks the day as done. */
  onDayCompleted?: () => void;
  /** Called when the user reopens a completed day. */
  onDayReopened?: () => void;
}

export default function TodayView({ dailyPriorityCount, onLaunchDailyPrep, onStuck, refreshKey, viewDate, isPlanning, isDayCompleted, onDayCompleted, onDayReopened }: TodayViewProps) {
  const [prepDone, setPrepDone] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [streak, setStreak] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [dayKey, setDayKey] = useState(() => toISODate(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      const now = toISODate(new Date());
      if (now !== dayKey) setDayKey(now);
    }, 30_000);
    return () => clearInterval(interval);
  }, [dayKey]);

  const effectiveDate = viewDate ?? dayKey;

  const { decomposingId, updateTaskState, getDecomposingStepId, taskCallbacks } =
    useTaskActions({ tasks, overdueTasks, setTasks, setOverdueTasks, onStuck, tag: "TodayView" });

  useEffect(() => {
    async function load() {
      try {
        const fetched = isPlanning
          ? await getTasksByDate(effectiveDate)
          : await fetchTasks("today");
        setTasks(initializePriorities(fetched, dailyPriorityCount));
      } catch (err) {
        console.error("[TodayView] fetchTasks error:", err);
      }

      if (isPlanning) {
        getOverdueTasksForDate(effectiveDate)
          .then(setOverdueTasks)
          .catch((err) => console.error("[TodayView] getOverdueTasksForDate error:", err));
      } else {
        getOverdueTasks()
          .then(setOverdueTasks)
          .catch((err) => console.error("[TodayView] getOverdueTasks error:", err));
      }

      getStreak().then(setStreak).catch(() => {});
      getSetting(dayPrepKey(effectiveDate))
        .then((val) => setPrepDone(val === "done"))
        .catch(() => {});
    }
    load();
  }, [refreshKey, dayKey, effectiveDate, isPlanning]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const sortedOverdue = useMemo(() => sortOverdueTasks(overdueTasks), [overdueTasks]);

  const defaultFocusId = mainTasks.find((t) => !t.done && t.estimatedMinutes)?.id ?? null;
  const effectiveSelectedId = selectedTaskId ?? defaultFocusId;
  const selectedTask = effectiveSelectedId ? tasks.find((t) => t.id === effectiveSelectedId) : null;
  const timerTask = timerTaskId ? tasks.find((t) => t.id === timerTaskId) : null;
  const showTimerPanel = timerTaskId !== null && effectiveSelectedId === timerTaskId;

  function commitTasks(newMain: Task[], newSec: Task[]) {
    const combined = [...newMain, ...newSec];
    setTasks(combined);
    reorderTasksSvc(combined.map((t) => t.id));
  }

  function setScheduledDate(id: string, date: string | undefined) {
    if (date === effectiveDate || (!isPlanning && date === undefined)) {
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

  async function handleMarkDone() {
    await setSetting(dayClosedKey(dayKey), "true");
    onDayCompleted?.();
  }

  async function handleReopenDay() {
    await Promise.all([
      setSetting(dayClosedKey(dayKey), ""),
      setSetting(dayPrepKey(dayKey), ""),
    ]);
    onDayReopened?.();
  }

  function completeTimerTask() {
    if (timerTaskId) {
      taskCallbacks.onToggle(timerTaskId);
      if (selectedTaskId === timerTaskId) setSelectedTaskId(null);
    }
    setTimerTaskId(null);
  }

  function getNextFocusTask(): string | undefined {
    return mainTasks.find((t) => !t.done && t.id !== timerTaskId && t.estimatedMinutes)?.name;
  }

  // --- Drag & Drop ---

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = over.id as string;

    if (overId === MAIN_DROP_ID) {
      const secIdx = secondaryTasks.findIndex((t) => t.id === active.id);
      const overdueIdx = overdueTasks.findIndex((t) => t.id === active.id);
      if (secIdx !== -1 && mainTasks.length < dailyPriorityCount) {
        const task = secondaryTasks[secIdx];
        commitTasks([{ ...task, priority: "main" as const }], secondaryTasks.filter((t) => t.id !== task.id));
        updateTaskSvc({ id: task.id, priority: "main" }).catch(() => {});
      } else if (overdueIdx !== -1) {
        const movedTask = overdueTasks[overdueIdx];
        const priority: "main" | "secondary" = mainTasks.length < dailyPriorityCount ? "main" : "secondary";
        setOverdueTasks((prev) => prev.filter((t) => t.id !== active.id));
        commitTasks([...mainTasks, { ...movedTask, scheduledDate: effectiveDate, priority }], secondaryTasks);
        updateTaskSvc({ id: movedTask.id, scheduledDate: effectiveDate, priority }).catch(() => {});
      }
      return;
    }

    const activeMainIdx = mainTasks.findIndex((t) => t.id === active.id);
    const activeSecIdx = secondaryTasks.findIndex((t) => t.id === active.id);
    const activeOverdueIdx = overdueTasks.findIndex((t) => t.id === active.id);
    const overMainIdx = mainTasks.findIndex((t) => t.id === over.id);
    const overSecIdx = secondaryTasks.findIndex((t) => t.id === over.id);

    if (activeOverdueIdx !== -1 && (overMainIdx !== -1 || overSecIdx !== -1)) {
      const movedTask = overdueTasks[activeOverdueIdx];
      const toMain = overMainIdx !== -1 && mainTasks.length < dailyPriorityCount;
      const priority: "main" | "secondary" = toMain ? "main" : "secondary";
      setOverdueTasks((prev) => prev.filter((t) => t.id !== active.id));
      const task = { ...movedTask, scheduledDate: effectiveDate, priority };
      if (toMain) {
        const newMain = [...mainTasks];
        newMain.splice(overMainIdx, 0, task);
        commitTasks(newMain, secondaryTasks);
      } else {
        const newSec = [...secondaryTasks];
        newSec.splice(overSecIdx !== -1 ? overSecIdx : newSec.length, 0, task);
        commitTasks(mainTasks, newSec);
      }
      updateTaskSvc({ id: movedTask.id, scheduledDate: effectiveDate, priority }).catch(() => {});
      return;
    }

    if (activeMainIdx !== -1 && overMainIdx !== -1) {
      commitTasks(arrayMove(mainTasks, activeMainIdx, overMainIdx), secondaryTasks);
      return;
    }

    if (activeSecIdx !== -1 && overSecIdx !== -1) {
      commitTasks(mainTasks, arrayMove(secondaryTasks, activeSecIdx, overSecIdx));
      return;
    }

    if (activeMainIdx !== -1 && overSecIdx !== -1) {
      const task = mainTasks[activeMainIdx];
      const newSec = [...secondaryTasks];
      newSec.splice(overSecIdx, 0, { ...task, priority: "secondary" as const });
      commitTasks(mainTasks.filter((t) => t.id !== task.id), newSec);
      updateTaskSvc({ id: task.id, priority: "secondary" }).catch(() => {});
      return;
    }

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

  const allCallbacks = {
    ...taskCallbacks,
    onSetScheduledDate: setScheduledDate,
  };

  const dismissPrep = useCallback(() => {
    setSetting(dayPrepKey(effectiveDate), "done").catch(() => {});
    setPrepDone(true);
  }, [effectiveDate]);

  const launchPrep = useCallback(() => {
    dismissPrep();
    onLaunchDailyPrep?.();
  }, [dismissPrep, onLaunchDailyPrep]);

  return (
    <div>
      {!prepDone && !isDayCompleted && (
        <PrepBanner variant="daily" onLaunch={launchPrep} onDismiss={dismissPrep} />
      )}

      {timerTask && !isPlanning && timerTask.estimatedMinutes && (
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
            {isPlanning ? "Priorités de demain" : "Priorités du jour"}
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
                {...allCallbacks}
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
                    {...allCallbacks}
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

        {sortedOverdue.length > 0 && (
          <>
            <div className={`${styles.sectionHeader} ${styles.overdueHeader}`}>
              <span className={`${styles.sectionTitle} ${styles.overdueTitle}`}>
                <span className={styles.priorityIcon}>📋</span>
                Reliquat des jours précédents
              </span>
              <span className={styles.sectionCount}>
                {sortedOverdue.length}
              </span>
            </div>

            <SortableContext items={sortedOverdue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {sortedOverdue.map((task, i) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    {...allCallbacks}
                    isDecomposing={decomposingId === task.id}
                    decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.16 + i * 0.04}
                    isSecondary
                    isOverdue
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

      {!isPlanning && !isDayCompleted && (
        <div className={styles.reviewSection}>
          <div className={styles.reviewIcon}>🌙</div>
          <div className={styles.reviewContent}>
            <span className={styles.reviewTitle}>Revue du soir</span>
            <span className={styles.reviewDesc}>
              Fais le bilan de ta journée : ce que tu as accompli, les blocages, et ton top 3 de demain.
            </span>
          </div>
          <div className={styles.reviewActions}>
            <button className={styles.reviewBtn}>Lancer la revue</button>
            <button className={styles.closeBtn} onClick={handleMarkDone}>Marquer comme terminée</button>
          </div>
        </div>
      )}

      {!isPlanning && isDayCompleted && (
        <div className={styles.dayCompletedBanner}>
          <span className={styles.dayCompletedIcon}>✓</span>
          <span className={styles.dayCompletedText}>Journée terminée</span>
          <button className={styles.reopenBtn} onClick={handleReopenDay}>Réouvrir</button>
        </div>
      )}

      {!isPlanning && !showTimerPanel && selectedTask && selectedTask.estimatedMinutes && !selectedTask.done && (
        <FocusNow
          task={selectedTask.name}
          estimatedMinutes={selectedTask.estimatedMinutes}
          onStart={() => setTimerTaskId(effectiveSelectedId!)}
        />
      )}
    </div>
  );
}
