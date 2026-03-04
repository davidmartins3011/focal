import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type CollisionDetection,
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
import type { Task, MicroStep, WeekDayId } from "../types";
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

const ALL_DAY_LABELS: { id: WeekDayId; label: string; offset: number }[] = [
  { id: "lun", label: "Lun", offset: 0 },
  { id: "mar", label: "Mar", offset: 1 },
  { id: "mer", label: "Mer", offset: 2 },
  { id: "jeu", label: "Jeu", offset: 3 },
  { id: "ven", label: "Ven", offset: 4 },
  { id: "sam", label: "Sam", offset: 5 },
  { id: "dim", label: "Dim", offset: 6 },
];

const DEFAULT_WORKING_DAYS: WeekDayId[] = ["lun", "mar", "mer", "jeu", "ven"];

function weekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
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

const DAY_DROP_PREFIX = "day:";

function DroppableDayCard({
  dateStr, isToday, isSelected, isDragging, label, dayNum, total, dots, onClick,
}: {
  dateStr: string; isToday: boolean; isSelected: boolean; isDragging: boolean;
  label: string; dayNum: number; total: number; dots: ("done" | "pending")[]; onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${DAY_DROP_PREFIX}${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.day} ${isToday ? styles.today : ""} ${isSelected ? styles.daySelected : ""} ${isOver && isDragging ? styles.dayDropTarget : ""}`}
      onClick={onClick}
    >
      <div className={styles.dayName}>{label}</div>
      <div className={`${styles.dayDate} ${isToday ? styles.dayDateToday : ""}`}>{dayNum}</div>
      <div className={styles.dayTasks}>{total === 0 ? "Aucune tâche" : `${total} tâche${total > 1 ? "s" : ""}`}</div>
      <div className={styles.dots}>
        {dots.map((dot, i) => <div key={i} className={`${styles.dot} ${styles[dot]}`} />)}
      </div>
    </div>
  );
}

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCenter(args);
};

interface WeekViewProps {
  onLaunchWeeklyPrep?: () => void;
  refreshKey?: number;
  workingDays?: WeekDayId[];
  dailyPriorityCount?: number;
}

export default function WeekView({ onLaunchWeeklyPrep, refreshKey, workingDays = DEFAULT_WORKING_DAYS, dailyPriorityCount = 3 }: WeekViewProps) {
  const [selectedFilter, setSelectedFilter] = useState<"week" | string>("week");
  const [weekPriorities, setWeekPriorities] = useState<Task[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [prepDone, setPrepDone] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const [decomposingStepKey, setDecomposingStepKey] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isBusy = !!decomposingId || !!decomposingStepKey;
  const monday = useMemo(() => getMonday(new Date()), []);
  const todayStr = useMemo(() => fmtDate(new Date()), []);
  const isWeekMode = selectedFilter === "week";

  const activeDays = useMemo(
    () => ALL_DAY_LABELS.filter((d) => workingDays.includes(d.id)),
    [workingDays],
  );

  const weekPriorityLimit = activeDays.length * dailyPriorityCount;

  const dayInfos = useMemo(() => {
    return activeDays.map((day) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + day.offset);
      const dateStr = fmtDate(d);
      const dayTasks = scheduledTasks.filter((t) => t.scheduledDate === dateStr);
      return {
        label: day.label,
        dateStr,
        dayNum: d.getDate(),
        isToday: dateStr === todayStr,
        total: dayTasks.length,
        doneCount: dayTasks.filter((t) => t.done).length,
        dots: dayTasks.map((t): "done" | "pending" => t.done ? "done" : "pending"),
      };
    });
  }, [monday, todayStr, scheduledTasks, activeDays]);

  useEffect(() => {
    fetchTasks("week")
      .then(setWeekPriorities)
      .catch((err) => console.error("[WeekView] fetchTasks error:", err));

    const lastDay = activeDays.length > 0 ? activeDays[activeDays.length - 1] : ALL_DAY_LABELS[4];
    const endDate = new Date(monday);
    endDate.setDate(monday.getDate() + lastDay.offset);
    getTasksByDateRange(fmtDate(monday), fmtDate(endDate))
      .then((fetched) => {
        const byDate = new Map<string, Task[]>();
        for (const t of fetched) {
          const date = t.scheduledDate ?? "";
          if (!byDate.has(date)) byDate.set(date, []);
          byDate.get(date)!.push(t);
        }
        const initialized: Task[] = [];
        for (const [, dateTasks] of byDate) {
          let mainCount = dateTasks.filter((t) => t.priority === "main").length;
          for (const t of dateTasks) {
            if (t.priority === "main" || t.priority === "secondary") {
              initialized.push(t);
              continue;
            }
            const p: "main" | "secondary" = mainCount < dailyPriorityCount ? "main" : "secondary";
            if (p === "main") mainCount++;
            updateTaskSvc({ id: t.id, priority: p }).catch(() => {});
            initialized.push({ ...t, priority: p });
          }
        }
        setScheduledTasks(initialized);
      })
      .catch((err) => console.error("[WeekView] getTasksByDateRange error:", err));

    const mondayStr = fmtDate(monday);
    getOverdueTasks()
      .then((tasks) => setOverdueTasks(tasks.filter((t) => !t.scheduledDate || t.scheduledDate < mondayStr)))
      .catch((err) => console.error("[WeekView] getOverdueTasks error:", err));

    getSetting(weekKey())
      .then((val) => setPrepDone(val === "done"))
      .catch(() => {});
  }, [monday, refreshKey, activeDays]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setScheduledTasks((prev) => {
      const byDate = new Map<string, Task[]>();
      for (const t of prev) {
        const date = t.scheduledDate ?? "";
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(t);
      }
      const demoteIds = new Set<string>();
      for (const [, dateTasks] of byDate) {
        const main = dateTasks.filter((t) => t.priority === "main");
        if (main.length > dailyPriorityCount) {
          main.slice(dailyPriorityCount).forEach((t) => demoteIds.add(t.id));
        }
      }
      if (demoteIds.size === 0) return prev;
      demoteIds.forEach((id) => updateTaskSvc({ id, priority: "secondary" }).catch(() => {}));
      return prev.map((t) => demoteIds.has(t.id) ? { ...t, priority: "secondary" as const } : t);
    });
  }, [dailyPriorityCount]);

  useEffect(() => {
    setWeekPriorities((prev) => {
      if (prev.length <= weekPriorityLimit) return prev;
      const kept = prev.slice(0, weekPriorityLimit);
      const excess = prev.slice(weekPriorityLimit);
      excess.forEach((t) => {
        updateTaskSvc({ id: t.id, viewContext: "calendar", scheduledDate: todayStr, priority: "secondary" }).catch(() => {});
      });
      setScheduledTasks((s) => [...s, ...excess.map((t) => ({ ...t, scheduledDate: todayStr, priority: "secondary" as const }))]);
      return kept;
    });
  }, [weekPriorityLimit]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Day mode derived lists
  const allDayTasks = useMemo(
    () => isWeekMode ? [] : scheduledTasks.filter((t) => t.scheduledDate === selectedFilter),
    [isWeekMode, selectedFilter, scheduledTasks],
  );
  const dayMainTasks = allDayTasks.filter((t) => t.priority === "main");
  const daySecTasks = allDayTasks.filter((t) => t.priority !== "main");

  const prioritiesDone = isWeekMode ? weekPriorities.filter((t) => t.done).length : dayMainTasks.filter((t) => t.done).length;
  const secondaryDone = isWeekMode ? scheduledTasks.filter((t) => t.done).length : daySecTasks.filter((t) => t.done).length;

  function updateTaskState(updater: (tasks: Task[]) => Task[]) {
    setWeekPriorities(updater);
    setScheduledTasks(updater);
    setOverdueTasks(updater);
  }

  function commitDayTasks(dayDate: string, newMain: Task[], newSec: Task[]) {
    const newDayTasks = [...newMain, ...newSec];
    setScheduledTasks((prev) => [
      ...prev.filter((t) => t.scheduledDate !== dayDate),
      ...newDayTasks,
    ]);
    reorderTasksSvc(newDayTasks.map((t) => t.id));
  }

  function toggleTask(id: string) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    toggleTaskSvc(id).catch((err) => console.error("[WeekView] toggleTask error:", err));
  }

  function deleteTask(id: string) {
    updateTaskState((prev) => prev.filter((t) => t.id !== id));
    deleteTaskSvc(id).catch((err) => console.error("[WeekView] deleteTask error:", err));
  }

  function toggleStep(taskId: string, stepId: string) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return { ...t, microSteps: t.microSteps.map((s) => s.id === stepId ? { ...s, done: !s.done } : s) };
      }),
    );
    toggleStepSvc(stepId).catch((err) => console.error("[WeekView] toggleStep error:", err));
  }

  function setScheduledDate(id: string, date: string | undefined) {
    const mondayStr = fmtDate(monday);
    const lastDay = activeDays.length > 0 ? activeDays[activeDays.length - 1] : ALL_DAY_LABELS[4];
    const lastDayDate = new Date(monday);
    lastDayDate.setDate(monday.getDate() + lastDay.offset);
    const lastDayStr = fmtDate(lastDayDate);

    if (date && date >= mondayStr && date <= lastDayStr) {
      const overdueTask = overdueTasks.find((t) => t.id === id);
      if (overdueTask) {
        setOverdueTasks((prev) => prev.filter((t) => t.id !== id));
        setScheduledTasks((prev) => [...prev, { ...overdueTask, scheduledDate: date, priority: "secondary" as const }]);
        updateTaskSvc({ id, scheduledDate: date, priority: "secondary" }).catch((err) => console.error("[WeekView] setScheduledDate error:", err));
        return;
      }
      setScheduledTasks((prev) => prev.map((t) => t.id === id ? { ...t, scheduledDate: date } : t));
      setWeekPriorities((prev) => prev.map((t) => t.id === id ? { ...t, scheduledDate: date } : t));
    } else {
      updateTaskState((prev) => prev.filter((t) => t.id !== id));
    }
    updateTaskSvc({ id, scheduledDate: date }).catch((err) => console.error("[WeekView] setScheduledDate error:", err));
  }

  function setPriority(id: string, field: "urgency" | "importance", value: number | undefined) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    updateTaskSvc({ id, [field]: value ?? 0 }).catch((err) => console.error("[WeekView] setPriority error:", err));
  }

  function renameTask(id: string, name: string) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    updateTaskSvc({ id, name }).catch((err) => console.error("[WeekView] renameTask error:", err));
  }

  function updateEstimate(taskId: string, minutes: number | undefined) {
    updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, estimatedMinutes: minutes } : t));
  }

  function updateStepEstimate(taskId: string, stepId: string, minutes: number | undefined) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return { ...t, microSteps: t.microSteps.map((s) => s.id === stepId ? { ...s, estimatedMinutes: minutes } : s) };
      }),
    );
  }

  function editStep(taskId: string, stepId: string, text: string) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return { ...t, microSteps: t.microSteps.map((s) => s.id === stepId ? { ...s, text } : s) };
      }),
    );
  }

  function findTask(taskId: string): Task | undefined {
    return weekPriorities.find((t) => t.id === taskId) ?? scheduledTasks.find((t) => t.id === taskId) ?? overdueTasks.find((t) => t.id === taskId);
  }

  function decompose(taskId: string, redo = false) {
    if (isBusy) return;
    const task = findTask(taskId);
    if (!task) return;
    if (redo) {
      updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, microSteps: undefined, aiDecomposed: false } : t));
    }
    setDecomposingId(taskId);
    decomposeTask(task.name)
      .then((result) => {
        const prefix = redo ? "rs" : "s";
        const steps = result.map((s, i) => ({ id: `${taskId}-${prefix}${i}`, text: s.text, done: false, estimatedMinutes: s.estimatedMinutes }));
        updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, microSteps: steps, aiDecomposed: true } : t));
        setMicroSteps(taskId, steps).catch(() => {});
        setTimeout(() => setDecomposingId(null), steps.length * 300 + 500);
      })
      .catch((err) => { console.error("[WeekView] decompose error:", err); setDecomposingId(null); });
  }

  function decomposeStep(taskId: string, stepId: string) {
    if (isBusy) return;
    const task = findTask(taskId);
    const step = task?.microSteps?.find((s) => s.id === stepId);
    if (!task || !step) return;
    setDecomposingStepKey(`${taskId}:${stepId}`);
    decomposeTask(step.text, `Sous-étape de la tâche "${task.name}"`)
      .then((result) => {
        const subSteps = result.map((s, i) => ({ id: `${stepId}-sub${i}`, text: s.text, done: false, estimatedMinutes: s.estimatedMinutes }));
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
        if (finalSteps) setMicroSteps(taskId, finalSteps).catch(() => {});
        setDecomposingStepKey(null);
      })
      .catch((err) => { console.error("[WeekView] decomposeStep error:", err); setDecomposingStepKey(null); });
  }

  function getDecomposingStepId(taskId: string): string | null {
    if (!decomposingStepKey) return null;
    const sepIdx = decomposingStepKey.indexOf(":");
    return decomposingStepKey.substring(0, sepIdx) === taskId ? decomposingStepKey.substring(sepIdx + 1) : null;
  }

  // --- Drag & Drop ---

  function rescheduleToDay(taskId: string, targetDate: string) {
    const task = findTask(taskId);
    if (!task || task.scheduledDate === targetDate) return;

    const scrollParent = wrapperRef.current?.closest('[class*="content"]') as HTMLElement | null;
    const scrollTop = scrollParent?.scrollTop ?? 0;

    const wasOverdue = overdueTasks.some((t) => t.id === taskId);
    if (wasOverdue) setOverdueTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (scheduledTasks.some((t) => t.id === taskId)) {
      setScheduledTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, scheduledDate: targetDate, priority: "secondary" as const } : t));
    } else {
      setScheduledTasks((prev) => [...prev, { ...task, scheduledDate: targetDate, priority: "secondary" as const }]);
    }
    setWeekPriorities((prev) => prev.map((t) => t.id === taskId ? { ...t, scheduledDate: targetDate } : t));

    if (scrollParent) requestAnimationFrame(() => { scrollParent.scrollTop = scrollTop; });
    updateTaskSvc({ id: taskId, scheduledDate: targetDate, priority: "secondary" }).catch((err) => console.error("[WeekView] rescheduleToDay error:", err));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = over.id as string;

    // Drop on a day card
    if (overId.startsWith(DAY_DROP_PREFIX)) {
      rescheduleToDay(active.id as string, overId.slice(DAY_DROP_PREFIX.length));
      return;
    }

    if (isWeekMode) {
      handleWeekDragEnd(active.id as string, overId);
    } else {
      handleDayDragEnd(active.id as string, overId);
    }
  }

  function handleWeekDragEnd(draggedId: string, overId: string) {
    const activeInPri = weekPriorities.findIndex((t) => t.id === draggedId);
    const activeInSched = scheduledTasks.findIndex((t) => t.id === draggedId);
    const activeInOverdue = overdueTasks.findIndex((t) => t.id === draggedId);
    const overInPri = weekPriorities.findIndex((t) => t.id === overId);
    const overInSched = scheduledTasks.findIndex((t) => t.id === overId);

    // Within week priorities
    if (activeInPri !== -1 && overInPri !== -1) {
      const reordered = arrayMove(weekPriorities, activeInPri, overInPri);
      setWeekPriorities(reordered);
      reorderTasksSvc(reordered.map((t) => t.id));
      return;
    }

    // Within scheduled
    if (activeInSched !== -1 && overInSched !== -1) {
      const reordered = arrayMove(scheduledTasks, activeInSched, overInSched);
      setScheduledTasks(reordered);
      reorderTasksSvc(reordered.map((t) => t.id));
      return;
    }

    // Week priorities → scheduled (demote)
    if (activeInPri !== -1 && overInSched !== -1) {
      const task = weekPriorities[activeInPri];
      setWeekPriorities((prev) => prev.filter((t) => t.id !== task.id));
      setScheduledTasks((prev) => {
        const updated = [...prev];
        updated.splice(overInSched, 0, { ...task, scheduledDate: task.scheduledDate ?? todayStr, priority: "secondary" as const });
        return updated;
      });
      updateTaskSvc({ id: task.id, viewContext: "calendar", scheduledDate: task.scheduledDate ?? todayStr, priority: "secondary" }).catch(() => {});
      return;
    }

    // Scheduled → week priorities (promote or swap)
    if (activeInSched !== -1 && overInPri !== -1) {
      const task = scheduledTasks[activeInSched];
      if (weekPriorities.length < weekPriorityLimit) {
        setScheduledTasks((prev) => prev.filter((t) => t.id !== task.id));
        setWeekPriorities((prev) => {
          const updated = [...prev];
          updated.splice(overInPri, 0, task);
          return updated;
        });
        updateTaskSvc({ id: task.id, viewContext: "week" }).catch(() => {});
      } else {
        const demoted = weekPriorities[overInPri];
        setWeekPriorities((prev) => prev.map((t) => t.id === demoted.id ? task : t));
        setScheduledTasks((prev) => prev.map((t) => t.id === task.id
          ? { ...demoted, scheduledDate: demoted.scheduledDate ?? todayStr, priority: "secondary" as const }
          : t
        ));
        updateTaskSvc({ id: task.id, viewContext: "week" }).catch(() => {});
        updateTaskSvc({ id: demoted.id, viewContext: "calendar", scheduledDate: demoted.scheduledDate ?? todayStr, priority: "secondary" }).catch(() => {});
      }
      return;
    }

    // Overdue → week priorities (promote or swap)
    if (activeInOverdue !== -1 && overInPri !== -1) {
      const movedTask = overdueTasks[activeInOverdue];
      setOverdueTasks((prev) => prev.filter((t) => t.id !== draggedId));
      if (weekPriorities.length < weekPriorityLimit) {
        setWeekPriorities((prev) => {
          const updated = [...prev];
          updated.splice(overInPri, 0, movedTask);
          return updated;
        });
        updateTaskSvc({ id: movedTask.id, viewContext: "week", scheduledDate: todayStr }).catch(() => {});
      } else {
        const demoted = weekPriorities[overInPri];
        setWeekPriorities((prev) => prev.map((t) => t.id === demoted.id ? movedTask : t));
        setScheduledTasks((prev) => [...prev, { ...demoted, scheduledDate: demoted.scheduledDate ?? todayStr, priority: "secondary" as const }]);
        updateTaskSvc({ id: movedTask.id, viewContext: "week", scheduledDate: todayStr }).catch(() => {});
        updateTaskSvc({ id: demoted.id, viewContext: "calendar", scheduledDate: demoted.scheduledDate ?? todayStr, priority: "secondary" }).catch(() => {});
      }
      return;
    }

    // Overdue → scheduled
    if (activeInOverdue !== -1 && overInSched !== -1) {
      const movedTask = overdueTasks[activeInOverdue];
      setOverdueTasks((prev) => prev.filter((t) => t.id !== draggedId));
      setScheduledTasks((prev) => {
        const updated = [...prev];
        updated.splice(overInSched, 0, { ...movedTask, scheduledDate: todayStr, priority: "secondary" as const });
        return updated;
      });
      updateTaskSvc({ id: movedTask.id, scheduledDate: todayStr, priority: "secondary" }).catch(() => {});
    }
  }

  function handleDayDragEnd(activeIdStr: string, overId: string) {
    const dayDate = selectedFilter as string;

    const activeMainIdx = dayMainTasks.findIndex((t) => t.id === activeIdStr);
    const activeSecIdx = daySecTasks.findIndex((t) => t.id === activeIdStr);
    const activeOverdueIdx = overdueTasks.findIndex((t) => t.id === activeIdStr);
    const overMainIdx = dayMainTasks.findIndex((t) => t.id === overId);
    const overSecIdx = daySecTasks.findIndex((t) => t.id === overId);

    // Overdue → day tasks
    if (activeOverdueIdx !== -1 && (overMainIdx !== -1 || overSecIdx !== -1)) {
      const movedTask = overdueTasks[activeOverdueIdx];
      const toMain = overMainIdx !== -1 && dayMainTasks.length < dailyPriorityCount;
      const priority: "main" | "secondary" = toMain ? "main" : "secondary";
      setOverdueTasks((prev) => prev.filter((t) => t.id !== activeIdStr));
      const task = { ...movedTask, scheduledDate: dayDate, priority };
      if (toMain) {
        const newMain = [...dayMainTasks];
        newMain.splice(overMainIdx, 0, task);
        commitDayTasks(dayDate, newMain, daySecTasks);
      } else {
        const newSec = [...daySecTasks];
        newSec.splice(overSecIdx !== -1 ? overSecIdx : newSec.length, 0, task);
        commitDayTasks(dayDate, dayMainTasks, newSec);
      }
      updateTaskSvc({ id: movedTask.id, scheduledDate: dayDate, priority }).catch(() => {});
      return;
    }

    // Reorder within main
    if (activeMainIdx !== -1 && overMainIdx !== -1) {
      commitDayTasks(dayDate, arrayMove(dayMainTasks, activeMainIdx, overMainIdx), daySecTasks);
      return;
    }

    // Reorder within secondary
    if (activeSecIdx !== -1 && overSecIdx !== -1) {
      commitDayTasks(dayDate, dayMainTasks, arrayMove(daySecTasks, activeSecIdx, overSecIdx));
      return;
    }

    // Main → Secondary (demote)
    if (activeMainIdx !== -1 && overSecIdx !== -1) {
      const task = dayMainTasks[activeMainIdx];
      const newSec = [...daySecTasks];
      newSec.splice(overSecIdx, 0, { ...task, priority: "secondary" as const });
      commitDayTasks(dayDate, dayMainTasks.filter((t) => t.id !== task.id), newSec);
      updateTaskSvc({ id: task.id, priority: "secondary" }).catch(() => {});
      return;
    }

    // Secondary → Main (promote or swap)
    if (activeSecIdx !== -1 && overMainIdx !== -1) {
      const task = daySecTasks[activeSecIdx];
      if (dayMainTasks.length < dailyPriorityCount) {
        const newMain = [...dayMainTasks];
        newMain.splice(overMainIdx, 0, { ...task, priority: "main" as const });
        commitDayTasks(dayDate, newMain, daySecTasks.filter((t) => t.id !== task.id));
        updateTaskSvc({ id: task.id, priority: "main" }).catch(() => {});
      } else {
        const demoted = dayMainTasks[overMainIdx];
        const newMain = dayMainTasks.map((t) => t.id === demoted.id ? { ...task, priority: "main" as const } : t);
        const newSec = daySecTasks.map((t) => t.id === task.id ? { ...demoted, priority: "secondary" as const } : t);
        commitDayTasks(dayDate, newMain, newSec);
        updateTaskSvc({ id: task.id, priority: "main" }).catch(() => {});
        updateTaskSvc({ id: demoted.id, priority: "secondary" }).catch(() => {});
      }
    }
  }

  const activeTask = activeId ? findTask(activeId) : null;

  const selectedDayLabel = useMemo(() => {
    if (isWeekMode) return null;
    const info = dayInfos.find((d) => d.dateStr === selectedFilter);
    return info ? `${info.label}. ${info.dayNum}` : null;
  }, [isWeekMode, selectedFilter, dayInfos]);

  const taskCallbacks = {
    onToggle: toggleTask,
    onToggleStep: toggleStep,
    onDecompose: decompose,
    onRedecompose: (id: string) => decompose(id, true),
    onDecomposeStep: decomposeStep,
    onEditStep: editStep,
    onUpdateEstimate: updateEstimate,
    onUpdateStepEstimate: updateStepEstimate,
    onDelete: deleteTask,
    onRename: renameTask,
    onSetScheduledDate: setScheduledDate,
    onSetPriority: setPriority,
  };

  const dismissPrep = useCallback(() => {
    setSetting(weekKey(), "done").catch(() => {});
    setPrepDone(true);
  }, []);

  const launchPrep = useCallback(() => {
    dismissPrep();
    onLaunchWeeklyPrep?.();
  }, [dismissPrep, onLaunchWeeklyPrep]);

  return (
    <div ref={wrapperRef}>
      {!prepDone && (
        <PrepBanner variant="weekly" onLaunch={launchPrep} onDismiss={dismissPrep} />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className={styles.grid} style={{ '--day-count': dayInfos.length } as React.CSSProperties}>
          {dayInfos.map((day) => (
            <DroppableDayCard
              key={day.dateStr}
              dateStr={day.dateStr}
              isToday={day.isToday}
              isSelected={selectedFilter === day.dateStr}
              isDragging={activeId !== null}
              label={day.label}
              dayNum={day.dayNum}
              total={day.total}
              dots={day.dots}
              onClick={() => setSelectedFilter(selectedFilter === day.dateStr ? "week" : day.dateStr)}
            />
          ))}
        </div>

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
            <SortableContext items={weekPriorities.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {weekPriorities.length === 0 && (
                  <div className={styles.emptyHint}>Aucune priorité définie pour cette semaine.</div>
                )}
                {weekPriorities.map((task, i) => (
                  <SortableTaskItem key={task.id} task={task} {...taskCallbacks}
                    isDecomposing={decomposingId === task.id} decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.08 + i * 0.04} />
                ))}
              </div>
            </SortableContext>

            {scheduledTasks.length > 0 && (
              <>
                <div className={`${styles.sectionHeader} ${styles.secondaryHeader}`}>
                  <span className={`${styles.sectionTitle} ${styles.secondaryTitle}`}>Aussi prévu cette semaine</span>
                  <span className={styles.sectionCount}>{secondaryDone}/{scheduledTasks.length}</span>
                </div>
                <SortableContext items={scheduledTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className={styles.taskList}>
                    {scheduledTasks.map((task, i) => (
                      <SortableTaskItem key={task.id} task={task} {...taskCallbacks}
                        isDecomposing={decomposingId === task.id} decomposingStepId={getDecomposingStepId(task.id)}
                        animDelay={0.08 + i * 0.04} isSecondary />
                    ))}
                  </div>
                </SortableContext>
              </>
            )}
          </>
        ) : (
          <>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <span className={styles.priorityIcon}>⚡</span>
                Priorités — {selectedDayLabel}
              </span>
              <span className={styles.sectionCount}>
                {prioritiesDone}/{dayMainTasks.length}
              </span>
            </div>
            <SortableContext items={dayMainTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {allDayTasks.length === 0 && (
                  <div className={styles.emptyHint}>Aucune tâche prévue pour ce jour.</div>
                )}
                {dayMainTasks.map((task, i) => (
                  <SortableTaskItem key={task.id} task={task} {...taskCallbacks}
                    isDecomposing={decomposingId === task.id} decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.08 + i * 0.04} />
                ))}
              </div>
            </SortableContext>

            {daySecTasks.length > 0 && (
              <>
                <div className={`${styles.sectionHeader} ${styles.secondaryHeader}`}>
                  <span className={`${styles.sectionTitle} ${styles.secondaryTitle}`}>Aussi prévu ce jour</span>
                  <span className={styles.sectionCount}>{secondaryDone}/{daySecTasks.length}</span>
                </div>
                <SortableContext items={daySecTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className={styles.taskList}>
                    {daySecTasks.map((task, i) => (
                      <SortableTaskItem key={task.id} task={task} {...taskCallbacks}
                        isDecomposing={decomposingId === task.id} decomposingStepId={getDecomposingStepId(task.id)}
                        animDelay={0.08 + i * 0.04} isSecondary />
                    ))}
                  </div>
                </SortableContext>
              </>
            )}
          </>
        )}

        {overdueTasks.length > 0 && (
          <>
            <div className={`${styles.sectionHeader} ${styles.overdueHeader}`}>
              <span className={`${styles.sectionTitle} ${styles.overdueTitle}`}>
                <span className={styles.priorityIcon}>📋</span>
                Reliquat de la semaine passée
              </span>
              <span className={styles.sectionCount}>{overdueTasks.length}</span>
            </div>
            <SortableContext items={overdueTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {overdueTasks.map((task, i) => (
                  <SortableTaskItem key={task.id} task={task} {...taskCallbacks}
                    isDecomposing={decomposingId === task.id} decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.16 + i * 0.04} isSecondary />
                ))}
              </div>
            </SortableContext>
          </>
        )}

        <DragOverlay>
          {activeTask && (
            <div className={styles.dragOverlay}>
              <TaskItem task={activeTask} onToggle={() => {}} onToggleStep={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className={styles.reviewSection}>
        <div className={styles.reviewIcon}>📋</div>
        <div className={styles.reviewContent}>
          <span className={styles.reviewTitle}>Revue de la semaine</span>
          <span className={styles.reviewDesc}>
            Fais le point sur ta semaine : objectifs atteints, blocages récurrents, et priorités pour la semaine prochaine.
          </span>
        </div>
        <button className={styles.reviewBtn}>Lancer la revue</button>
      </div>
    </div>
  );
}
