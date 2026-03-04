import { useState, useCallback, useEffect, useMemo } from "react";
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
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import PrepBanner from "./PrepBanner";
import SortableTaskItem from "./SortableTaskItem";
import TaskItem from "./TaskItem";
import type { Task, MicroStep } from "../types";
import {
  getTasks as fetchTasks,
  getTasksByDateRange,
  getOverdueTasks,
  toggleTask as toggleTaskSvc,
  toggleMicroStep as toggleStepSvc,
  updateTask as updateTaskSvc,
  deleteTask as deleteTaskSvc,
  reorderTasks as reorderTasksSvc,
  setMicroSteps,
} from "../services/tasks";
import { decomposeTask } from "../services/chat";
import { getSetting, setSetting } from "../services/settings";
import styles from "./WeekView.module.css";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

function weekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `weekly-prep-${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface WeekViewProps {
  onLaunchWeeklyPrep?: () => void;
  refreshKey?: number;
}

export default function WeekView({ onLaunchWeeklyPrep, refreshKey }: WeekViewProps) {
  const [selectedFilter, setSelectedFilter] = useState<"week" | string>("week");
  const [weekPriorities, setWeekPriorities] = useState<Task[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [prepDone, setPrepDone] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const [decomposingStepKey, setDecomposingStepKey] = useState<string | null>(null);

  const isBusy = !!decomposingId || !!decomposingStepKey;
  const monday = useMemo(() => getMonday(new Date()), []);
  const todayStr = useMemo(() => fmtDate(new Date()), []);
  const isWeekMode = selectedFilter === "week";

  const dayInfos = useMemo(() => {
    return DAY_LABELS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = fmtDate(d);
      const dayTasks = scheduledTasks.filter(
        (t) => t.scheduledDate === dateStr,
      );
      return {
        label,
        dateStr,
        dayNum: d.getDate(),
        isToday: dateStr === todayStr,
        total: dayTasks.length,
        doneCount: dayTasks.filter((t) => t.done).length,
        dots: dayTasks.map((t): "done" | "pending" => t.done ? "done" : "pending"),
      };
    });
  }, [monday, todayStr, scheduledTasks]);

  useEffect(() => {
    fetchTasks("week")
      .then(setWeekPriorities)
      .catch((err) => console.error("[WeekView] fetchTasks error:", err));

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    getTasksByDateRange(fmtDate(monday), fmtDate(friday))
      .then(setScheduledTasks)
      .catch((err) =>
        console.error("[WeekView] getTasksByDateRange error:", err),
      );

    const mondayStr = fmtDate(monday);
    getOverdueTasks()
      .then((tasks) =>
        setOverdueTasks(
          tasks.filter((t) => !t.scheduledDate || t.scheduledDate < mondayStr),
        ),
      )
      .catch((err) =>
        console.error("[WeekView] getOverdueTasks error:", err),
      );

    getSetting(weekKey())
      .then((val) => setPrepDone(val === "done"))
      .catch(() => {});
  }, [monday, refreshKey]);

  const dayTasks = useMemo(() => {
    if (isWeekMode) return [];
    return scheduledTasks.filter((t) => t.scheduledDate === selectedFilter);
  }, [isWeekMode, selectedFilter, scheduledTasks]);

  const prioritiesDone = isWeekMode
    ? weekPriorities.filter((t) => t.done).length
    : 0;
  const secondaryDone = isWeekMode
    ? scheduledTasks.filter((t) => t.done).length
    : dayTasks.filter((t) => t.done).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const allSortableIds = useMemo(() => {
    if (isWeekMode) {
      return [
        ...weekPriorities.map((t) => t.id),
        ...scheduledTasks.map((t) => t.id),
        ...overdueTasks.map((t) => t.id),
      ];
    }
    return [
      ...dayTasks.map((t) => t.id),
      ...overdueTasks.map((t) => t.id),
    ];
  }, [isWeekMode, weekPriorities, scheduledTasks, dayTasks, overdueTasks]);

  function updateTaskState(updater: (tasks: Task[]) => Task[]) {
    setWeekPriorities(updater);
    setScheduledTasks(updater);
    setOverdueTasks(updater);
  }

  function toggleTask(id: string) {
    updateTaskState((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
    toggleTaskSvc(id).catch((err) =>
      console.error("[WeekView] toggleTask error:", err),
    );
  }

  function deleteTask(id: string) {
    updateTaskState((prev) => prev.filter((t) => t.id !== id));
    deleteTaskSvc(id).catch((err) =>
      console.error("[WeekView] deleteTask error:", err),
    );
  }

  function toggleStep(taskId: string, stepId: string) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return {
          ...t,
          microSteps: t.microSteps.map((s) =>
            s.id === stepId ? { ...s, done: !s.done } : s,
          ),
        };
      }),
    );
    toggleStepSvc(stepId).catch((err) =>
      console.error("[WeekView] toggleStep error:", err),
    );
  }

  function setScheduledDate(id: string, date: string | undefined) {
    const mondayStr = fmtDate(monday);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const fridayStr = fmtDate(friday);

    if (date && date >= mondayStr && date <= fridayStr) {
      const overdueTask = overdueTasks.find((t) => t.id === id);
      if (overdueTask) {
        setOverdueTasks((prev) => prev.filter((t) => t.id !== id));
        setScheduledTasks((prev) => [
          ...prev,
          { ...overdueTask, scheduledDate: date },
        ]);
      } else {
        setScheduledTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, scheduledDate: date } : t,
          ),
        );
        setWeekPriorities((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, scheduledDate: date } : t,
          ),
        );
      }
    } else {
      updateTaskState((prev) => prev.filter((t) => t.id !== id));
    }
    updateTaskSvc({ id, scheduledDate: date }).catch((err) =>
      console.error("[WeekView] setScheduledDate error:", err),
    );
  }

  function setPriority(
    id: string,
    field: "urgency" | "importance",
    value: number | undefined,
  ) {
    updateTaskState((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
    updateTaskSvc({ id, [field]: value ?? 0 }).catch((err) =>
      console.error("[WeekView] setPriority error:", err),
    );
  }

  function renameTask(id: string, name: string) {
    updateTaskState((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t)),
    );
    updateTaskSvc({ id, name }).catch((err) =>
      console.error("[WeekView] renameTask error:", err),
    );
  }

  function updateEstimate(taskId: string, minutes: number | undefined) {
    updateTaskState((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, estimatedMinutes: minutes } : t,
      ),
    );
  }

  function updateStepEstimate(
    taskId: string,
    stepId: string,
    minutes: number | undefined,
  ) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return {
          ...t,
          microSteps: t.microSteps.map((s) =>
            s.id === stepId ? { ...s, estimatedMinutes: minutes } : s,
          ),
        };
      }),
    );
  }

  function editStep(taskId: string, stepId: string, text: string) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return {
          ...t,
          microSteps: t.microSteps.map((s) =>
            s.id === stepId ? { ...s, text } : s,
          ),
        };
      }),
    );
  }

  function findTask(taskId: string): Task | undefined {
    return (
      weekPriorities.find((t) => t.id === taskId) ??
      scheduledTasks.find((t) => t.id === taskId) ??
      overdueTasks.find((t) => t.id === taskId)
    );
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
            : t,
        ),
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
              : t,
          ),
        );

        setMicroSteps(taskId, steps).catch(() => {});
        setTimeout(
          () => setDecomposingId(null),
          steps.length * 300 + 500,
        );
      })
      .catch((err) => {
        console.error("[WeekView] decompose error:", err);
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
          }),
        );

        if (finalSteps) {
          setMicroSteps(taskId, finalSteps).catch(() => {});
        }
        setDecomposingStepKey(null);
      })
      .catch((err) => {
        console.error("[WeekView] decomposeStep error:", err);
        setDecomposingStepKey(null);
      });
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

    const activeInPri = weekPriorities.findIndex((t) => t.id === active.id);
    const activeInSched = scheduledTasks.findIndex((t) => t.id === active.id);
    const activeInOverdue = overdueTasks.findIndex((t) => t.id === active.id);

    const overInPri = weekPriorities.findIndex((t) => t.id === over.id);
    const overInSched = scheduledTasks.findIndex((t) => t.id === over.id);

    if (isWeekMode) {
      if (activeInPri !== -1 && overInPri !== -1) {
        const reordered = arrayMove(weekPriorities, activeInPri, overInPri);
        setWeekPriorities(reordered);
        reorderTasksSvc(reordered.map((t) => t.id));
      } else if (activeInSched !== -1 && overInSched !== -1) {
        const reordered = arrayMove(scheduledTasks, activeInSched, overInSched);
        setScheduledTasks(reordered);
        reorderTasksSvc(reordered.map((t) => t.id));
      } else if (activeInOverdue !== -1 && overInPri !== -1) {
        const movedTask = overdueTasks[activeInOverdue];
        setOverdueTasks((prev) => prev.filter((t) => t.id !== active.id));
        setWeekPriorities((prev) => {
          const updated = [...prev];
          updated.splice(overInPri, 0, movedTask);
          return updated;
        });
        updateTaskSvc({ id: movedTask.id, scheduledDate: todayStr });
      } else if (activeInOverdue !== -1 && overInSched !== -1) {
        const movedTask = overdueTasks[activeInOverdue];
        setOverdueTasks((prev) => prev.filter((t) => t.id !== active.id));
        setScheduledTasks((prev) => {
          const updated = [...prev];
          updated.splice(overInSched, 0, {
            ...movedTask,
            scheduledDate: todayStr,
          });
          return updated;
        });
        updateTaskSvc({ id: movedTask.id, scheduledDate: todayStr });
      }
    } else {
      if (activeInSched !== -1 && overInSched !== -1) {
        const reordered = arrayMove(scheduledTasks, activeInSched, overInSched);
        setScheduledTasks(reordered);
        reorderTasksSvc(reordered.map((t) => t.id));
      } else if (activeInOverdue !== -1 && overInSched !== -1) {
        const movedTask = overdueTasks[activeInOverdue];
        setOverdueTasks((prev) => prev.filter((t) => t.id !== active.id));
        setScheduledTasks((prev) => {
          const updated = [...prev];
          updated.splice(overInSched, 0, {
            ...movedTask,
            scheduledDate: selectedFilter as string,
          });
          return updated;
        });
        updateTaskSvc({
          id: movedTask.id,
          scheduledDate: selectedFilter as string,
        });
      }
    }
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  const activeTask = activeId ? findTask(activeId) : null;

  const selectedDayLabel = useMemo(() => {
    if (isWeekMode) return null;
    const info = dayInfos.find((d) => d.dateStr === selectedFilter);
    return info ? `${info.label}. ${info.dayNum}` : null;
  }, [isWeekMode, selectedFilter, dayInfos]);

  const dismissPrep = useCallback(() => {
    setSetting(weekKey(), "done").catch(() => {});
    setPrepDone(true);
  }, []);

  const launchPrep = useCallback(() => {
    dismissPrep();
    onLaunchWeeklyPrep?.();
  }, [dismissPrep, onLaunchWeeklyPrep]);

  const renderTaskItem = (task: Task, i: number, secondary = false) => (
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
      onSetPriority={setPriority}
      isDecomposing={decomposingId === task.id}
      decomposingStepId={getDecomposingStepId(task.id)}
      animDelay={0.08 + i * 0.04}
      isSecondary={secondary}
    />
  );

  return (
    <div>
      {!prepDone && (
        <PrepBanner
          variant="weekly"
          onLaunch={launchPrep}
          onDismiss={dismissPrep}
        />
      )}

      <div className={styles.filterBar}>
        <button
          className={`${styles.filterPill} ${isWeekMode ? styles.filterPillActive : ""}`}
          onClick={() => setSelectedFilter("week")}
        >
          Semaine
        </button>
        {dayInfos.map((day) => (
          <button
            key={day.dateStr}
            className={`${styles.filterPill} ${
              selectedFilter === day.dateStr ? styles.filterPillActive : ""
            } ${day.isToday ? styles.filterPillToday : ""}`}
            onClick={() => setSelectedFilter(day.dateStr)}
          >
            {day.label} {day.dayNum}
          </button>
        ))}
      </div>

      {isWeekMode && (
        <div className={styles.grid}>
          {dayInfos.map((day) => (
            <div
              key={day.dateStr}
              className={`${styles.day} ${day.isToday ? styles.today : ""}`}
              onClick={() => setSelectedFilter(day.dateStr)}
            >
              <div className={styles.dayName}>{day.label}</div>
              <div
                className={`${styles.dayDate} ${day.isToday ? styles.dayDateToday : ""}`}
              >
                {day.dayNum}
              </div>
              <div className={styles.dayTasks}>
                {day.total === 0
                  ? "Aucune tâche"
                  : `${day.total} tâche${day.total > 1 ? "s" : ""}`}
              </div>
              <div className={styles.dots}>
                {day.dots.map((dot, i) => (
                  <div
                    key={i}
                    className={`${styles.dot} ${styles[dot]}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={allSortableIds}
          strategy={verticalListSortingStrategy}
        >
          {isWeekMode ? (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  <span className={styles.priorityIcon}>⚡</span>
                  Priorités de la semaine
                </span>
                <span className={styles.sectionCount}>
                  {prioritiesDone}/{weekPriorities.length}
                </span>
              </div>
              <div className={styles.taskList}>
                {weekPriorities.length === 0 && (
                  <div className={styles.emptyHint}>
                    Aucune priorité définie pour cette semaine.
                  </div>
                )}
                {weekPriorities.map((task, i) => renderTaskItem(task, i))}
              </div>

              {scheduledTasks.length > 0 && (
                <>
                  <div
                    className={`${styles.sectionHeader} ${styles.secondaryHeader}`}
                  >
                    <span
                      className={`${styles.sectionTitle} ${styles.secondaryTitle}`}
                    >
                      Aussi prévu cette semaine
                    </span>
                    <span className={styles.sectionCount}>
                      {secondaryDone}/{scheduledTasks.length}
                    </span>
                  </div>
                  <div className={styles.taskList}>
                    {scheduledTasks.map((task, i) =>
                      renderTaskItem(task, i, true),
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  Tâches — {selectedDayLabel}
                </span>
                <span className={styles.sectionCount}>
                  {secondaryDone}/{dayTasks.length}
                </span>
              </div>
              <div className={styles.taskList}>
                {dayTasks.length === 0 && (
                  <div className={styles.emptyHint}>
                    Aucune tâche prévue pour ce jour.
                  </div>
                )}
                {dayTasks.map((task, i) => renderTaskItem(task, i))}
              </div>
            </>
          )}

          {overdueTasks.length > 0 && (
            <>
              <div
                className={`${styles.sectionHeader} ${styles.overdueHeader}`}
              >
                <span
                  className={`${styles.sectionTitle} ${styles.overdueTitle}`}
                >
                  <span className={styles.priorityIcon}>📋</span>
                  Reliquat de la semaine passée
                </span>
                <span className={styles.sectionCount}>
                  {overdueTasks.length}
                </span>
              </div>
              <div className={styles.taskList}>
                {overdueTasks.map((task, i) =>
                  renderTaskItem(task, i, true),
                )}
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
        <div className={styles.reviewIcon}>📋</div>
        <div className={styles.reviewContent}>
          <span className={styles.reviewTitle}>Revue de la semaine</span>
          <span className={styles.reviewDesc}>
            Fais le point sur ta semaine : objectifs atteints, blocages
            récurrents, et priorités pour la semaine prochaine.
          </span>
        </div>
        <button className={styles.reviewBtn}>Lancer la revue</button>
      </div>
    </div>
  );
}
