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
import AddTaskInput from "./AddTaskInput";
import PrepBanner from "./PrepBanner";
import SortableTaskItem from "./SortableTaskItem";
import TaskItem from "./TaskItem";
import DroppableEmptyZone from "./DroppableEmptyZone";
import type { Task, WeekDayId } from "../types";
import {
  getTasks as fetchTasks,
  getTasksByDateRange,
  getOverdueTasks,
  getOverdueTasksForDate,
  updateTask as updateTaskSvc,
  reorderTasks as reorderTasksSvc,
  createTask,
} from "../services/tasks";
import { getSetting, setSetting } from "../services/settings";
import { toISODate, weekClosedKey, weekPrepKey, getMondayDate } from "../utils/dateFormat";
import { sortOverdueTasks } from "../utils/taskUtils";
import useTaskActions from "../hooks/useTaskActions";
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

const DAY_DROP_PREFIX = "day:";
const WEEK_PRI_DROP_ID = "drop:weekPriorities";
const DAY_MAIN_DROP_ID = "drop:dayMain";

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
  onLaunchWeeklyReview?: () => void;
  onStuck?: (taskId: string, taskName: string) => void;
  refreshKey?: number;
  workingDays?: WeekDayId[];
  dailyPriorityCount?: number;
  /** ISO monday date to display (defaults to current week's monday). */
  viewMonday?: string;
  /** Planning-only mode: no review/close actions, no overdue tasks. */
  isPlanning?: boolean;
  /** Whether the current week has been marked as done. */
  isWeekCompleted?: boolean;
  /** Called when the user marks the week as done. */
  onWeekCompleted?: () => void;
  /** Called when the user reopens a completed week. */
  onWeekReopened?: () => void;
}

export default function WeekView({ onLaunchWeeklyPrep, onLaunchWeeklyReview, onStuck, refreshKey, workingDays = DEFAULT_WORKING_DAYS, dailyPriorityCount = 3, viewMonday, isPlanning, isWeekCompleted, onWeekCompleted, onWeekReopened }: WeekViewProps) {
  const [selectedFilter, setSelectedFilter] = useState<"week" | string>("week");
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [prepDone, setPrepDone] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const monday = useMemo(() => viewMonday ? new Date(viewMonday + "T12:00:00") : getMondayDate(new Date()), [viewMonday]);
  const todayStr = useMemo(() => toISODate(new Date()), []);
  const isWeekMode = selectedFilter === "week";

  const handleAddTask = useCallback((text: string) => {
    const targetDate = isWeekMode ? todayStr : (selectedFilter as string);
    createTask({ name: text, scheduledDate: targetDate })
      .then((task) => {
        setScheduledTasks((prev) => {
          const dayTasks = prev.filter((t) => t.scheduledDate === targetDate);
          const mainCount = dayTasks.filter((t) => t.priority === "main").length;
          const priority: "main" | "secondary" = mainCount < dailyPriorityCount ? "main" : "secondary";
          updateTaskSvc({ id: task.id, priority }).catch(() => {});
          return [...prev, { ...task, scheduledDate: targetDate, priority }];
        });
      })
      .catch((err) => console.error("[WeekView] createTask error:", err));
  }, [isWeekMode, todayStr, selectedFilter, dailyPriorityCount]);

  const { decomposingId, updateTaskState, findTask, getDecomposingStepId, taskCallbacks } =
    useTaskActions({ tasks: scheduledTasks, overdueTasks, setTasks: setScheduledTasks, setOverdueTasks, onStuck, tag: "WeekView" });

  const activeDays = useMemo(
    () => ALL_DAY_LABELS.filter((d) => workingDays.includes(d.id)),
    [workingDays],
  );

  const weekPriorityLimit = activeDays.length * dailyPriorityCount;

  const dayInfos = useMemo(() => {
    return activeDays.map((day) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + day.offset);
      const dateStr = toISODate(d);
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
    const lastDay = activeDays.length > 0 ? activeDays[activeDays.length - 1] : ALL_DAY_LABELS[4];
    const endDate = new Date(monday);
    endDate.setDate(monday.getDate() + lastDay.offset);
    const mondayStr = toISODate(monday);

    Promise.all([
      isPlanning ? Promise.resolve([]) : fetchTasks("week"),
      getTasksByDateRange(mondayStr, toISODate(endDate)),
      isPlanning ? getOverdueTasksForDate(toISODate(monday)) : getOverdueTasks(),
    ])
      .then(([weekCtxTasks, dateTasks, overdueAll]) => {
        const dateIds = new Set(dateTasks.map((t) => t.id));
        const merged = [...dateTasks];

        for (const t of weekCtxTasks) {
          if (dateIds.has(t.id)) {
            const idx = merged.findIndex((m) => m.id === t.id);
            if (idx !== -1 && merged[idx].priority !== "main") {
              merged[idx] = { ...merged[idx], priority: "main" as const };
              updateTaskSvc({ id: t.id, priority: "main" }).catch(() => {});
            }
          } else {
            merged.push({ ...t, priority: "main" as const, scheduledDate: t.scheduledDate ?? todayStr });
          }
        }

        const byDate = new Map<string, Task[]>();
        for (const t of merged) {
          const date = t.scheduledDate ?? "";
          if (!byDate.has(date)) byDate.set(date, []);
          byDate.get(date)!.push(t);
        }
        const initialized: Task[] = [];
        for (const [, tasks] of byDate) {
          let mainCount = tasks.filter((t) => t.priority === "main").length;
          for (const t of tasks) {
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

        const allIds = new Set(initialized.map((t) => t.id));
        setOverdueTasks(
          overdueAll.filter((t) => (!t.scheduledDate || t.scheduledDate < mondayStr) && !allIds.has(t.id)),
        );
      })
      .catch((err) => console.error("[WeekView] fetch error:", err));

    getSetting(weekPrepKey(toISODate(monday)))
      .then((val) => setPrepDone(val === "done"))
      .catch(() => {});
  }, [monday, refreshKey, activeDays, isPlanning]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setScheduledTasks((prev) => {
      const mainTasks = prev.filter((t) => t.priority === "main");
      if (mainTasks.length <= weekPriorityLimit) return prev;
      const excessIds = new Set(mainTasks.slice(weekPriorityLimit).map((t) => t.id));
      excessIds.forEach((id) => updateTaskSvc({ id, priority: "secondary" }).catch(() => {}));
      return prev.map((t) => excessIds.has(t.id) ? { ...t, priority: "secondary" as const } : t);
    });
  }, [weekPriorityLimit]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const weekMainTasks = useMemo(
    () => scheduledTasks.filter((t) => t.priority === "main"),
    [scheduledTasks],
  );
  const weekSecTasks = useMemo(
    () => scheduledTasks.filter((t) => t.priority !== "main"),
    [scheduledTasks],
  );

  const allDayTasks = useMemo(
    () => isWeekMode ? [] : scheduledTasks.filter((t) => t.scheduledDate === selectedFilter),
    [isWeekMode, selectedFilter, scheduledTasks],
  );
  const dayMainTasks = allDayTasks.filter((t) => t.priority === "main");
  const daySecTasks = allDayTasks.filter((t) => t.priority !== "main");

  const sortedOverdue = useMemo(() => sortOverdueTasks(overdueTasks), [overdueTasks]);

  const prioritiesDone = isWeekMode ? weekMainTasks.filter((t) => t.done).length : dayMainTasks.filter((t) => t.done).length;
  const secondaryDone = isWeekMode ? weekSecTasks.filter((t) => t.done).length : daySecTasks.filter((t) => t.done).length;
  const dayPriorityOverflow = !isWeekMode && dayMainTasks.length > dailyPriorityCount;

  function commitDayTasks(dayDate: string, newMain: Task[], newSec: Task[]) {
    const newDayTasks = [...newMain, ...newSec];
    setScheduledTasks((prev) => [
      ...prev.filter((t) => t.scheduledDate !== dayDate),
      ...newDayTasks,
    ]);
    reorderTasksSvc(newDayTasks.map((t) => t.id));
  }

  function setScheduledDate(id: string, date: string | undefined) {
    const mondayStr = toISODate(monday);
    const lastDay = activeDays.length > 0 ? activeDays[activeDays.length - 1] : ALL_DAY_LABELS[4];
    const lastDayDate = new Date(monday);
    lastDayDate.setDate(monday.getDate() + lastDay.offset);
    const lastDayStr = toISODate(lastDayDate);

    if (date && date >= mondayStr && date <= lastDayStr) {
      const overdueTask = overdueTasks.find((t) => t.id === id);
      if (overdueTask) {
        setOverdueTasks((prev) => prev.filter((t) => t.id !== id));
        const keepPriority = overdueTask.priority ?? "secondary";
        setScheduledTasks((prev) => [...prev, { ...overdueTask, scheduledDate: date, priority: keepPriority }]);
        updateTaskSvc({ id, scheduledDate: date }).catch((err) => console.error("[WeekView] setScheduledDate error:", err));
        return;
      }
      setScheduledTasks((prev) => prev.map((t) => t.id === id ? { ...t, scheduledDate: date } : t));
    } else {
      updateTaskState((prev) => prev.filter((t) => t.id !== id));
    }
    updateTaskSvc({ id, scheduledDate: date }).catch((err) => console.error("[WeekView] setScheduledDate error:", err));
  }

  async function handleMarkWeekDone() {
    await setSetting(weekClosedKey(toISODate(monday)), "true");
    onWeekCompleted?.();
  }

  async function handleReopenWeek() {
    const mondayStr = toISODate(monday);
    await Promise.all([
      setSetting(weekClosedKey(mondayStr), ""),
      setSetting(weekPrepKey(mondayStr), ""),
    ]);
    onWeekReopened?.();
  }

  // --- Drag & Drop ---

  function rescheduleToDay(taskId: string, targetDate: string) {
    const task = findTask(taskId);
    if (!task || task.scheduledDate === targetDate) return;

    const scrollParent = wrapperRef.current?.closest('[class*="content"]') as HTMLElement | null;
    const scrollTop = scrollParent?.scrollTop ?? 0;

    const keepPriority = task.priority ?? "secondary";

    const wasOverdue = overdueTasks.some((t) => t.id === taskId);
    if (wasOverdue) setOverdueTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (scheduledTasks.some((t) => t.id === taskId)) {
      setScheduledTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, scheduledDate: targetDate } : t));
    } else {
      setScheduledTasks((prev) => [...prev, { ...task, scheduledDate: targetDate, priority: keepPriority }]);
    }

    if (scrollParent) requestAnimationFrame(() => { scrollParent.scrollTop = scrollTop; });
    updateTaskSvc({ id: taskId, scheduledDate: targetDate }).catch((err) => console.error("[WeekView] rescheduleToDay error:", err));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = over.id as string;

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
    const scrollParent = wrapperRef.current?.closest('[class*="content"]') as HTMLElement | null;
    const scrollTop = scrollParent?.scrollTop ?? 0;
    const restoreScroll = () => {
      if (scrollParent) requestAnimationFrame(() => { scrollParent.scrollTop = scrollTop; });
    };

    if (overId === WEEK_PRI_DROP_ID) {
      const inSec = weekSecTasks.some((t) => t.id === draggedId);
      const overdueIdx = overdueTasks.findIndex((t) => t.id === draggedId);
      if (inSec && weekMainTasks.length < weekPriorityLimit) {
        setScheduledTasks((prev) => prev.map((t) => t.id === draggedId ? { ...t, priority: "main" as const } : t));
        updateTaskSvc({ id: draggedId, priority: "main" }).catch(() => {});
      } else if (overdueIdx !== -1 && weekMainTasks.length < weekPriorityLimit) {
        const task = overdueTasks[overdueIdx];
        setOverdueTasks((prev) => prev.filter((t) => t.id !== draggedId));
        setScheduledTasks((prev) => [...prev, { ...task, scheduledDate: task.scheduledDate ?? todayStr, priority: "main" as const }]);
        updateTaskSvc({ id: draggedId, scheduledDate: task.scheduledDate ?? todayStr, priority: "main" }).catch(() => {});
      }
      restoreScroll();
      return;
    }

    const activeInMain = weekMainTasks.findIndex((t) => t.id === draggedId);
    const activeInSec = weekSecTasks.findIndex((t) => t.id === draggedId);
    const activeInOverdue = overdueTasks.findIndex((t) => t.id === draggedId);
    const overInMain = weekMainTasks.findIndex((t) => t.id === overId);
    const overInSec = weekSecTasks.findIndex((t) => t.id === overId);

    if (activeInMain !== -1 && overInMain !== -1) {
      const reordered = arrayMove(weekMainTasks, activeInMain, overInMain);
      const nonMain = scheduledTasks.filter((t) => t.priority !== "main");
      setScheduledTasks([...reordered, ...nonMain]);
      reorderTasksSvc(reordered.map((t) => t.id));
      return;
    }

    if (activeInSec !== -1 && overInSec !== -1) {
      const reordered = arrayMove(weekSecTasks, activeInSec, overInSec);
      const mainTasks = scheduledTasks.filter((t) => t.priority === "main");
      setScheduledTasks([...mainTasks, ...reordered]);
      reorderTasksSvc(reordered.map((t) => t.id));
      return;
    }

    if (activeInMain !== -1 && overInSec !== -1) {
      setScheduledTasks((prev) => prev.map((t) => t.id === draggedId ? { ...t, priority: "secondary" as const } : t));
      updateTaskSvc({ id: draggedId, priority: "secondary" }).catch(() => {});
      restoreScroll();
      return;
    }

    if (activeInSec !== -1 && overInMain !== -1) {
      if (weekMainTasks.length < weekPriorityLimit) {
        setScheduledTasks((prev) => prev.map((t) => t.id === draggedId ? { ...t, priority: "main" as const } : t));
        updateTaskSvc({ id: draggedId, priority: "main" }).catch(() => {});
      } else {
        const demotedId = weekMainTasks[overInMain].id;
        setScheduledTasks((prev) => prev.map((t) => {
          if (t.id === draggedId) return { ...t, priority: "main" as const };
          if (t.id === demotedId) return { ...t, priority: "secondary" as const };
          return t;
        }));
        updateTaskSvc({ id: draggedId, priority: "main" }).catch(() => {});
        updateTaskSvc({ id: demotedId, priority: "secondary" }).catch(() => {});
      }
      restoreScroll();
      return;
    }

    if (activeInOverdue !== -1 && overInMain !== -1) {
      const movedTask = overdueTasks[activeInOverdue];
      setOverdueTasks((prev) => prev.filter((t) => t.id !== draggedId));
      if (weekMainTasks.length < weekPriorityLimit) {
        setScheduledTasks((prev) => [...prev, { ...movedTask, scheduledDate: movedTask.scheduledDate ?? todayStr, priority: "main" as const }]);
        updateTaskSvc({ id: movedTask.id, scheduledDate: movedTask.scheduledDate ?? todayStr, priority: "main" }).catch(() => {});
      } else {
        const demotedId = weekMainTasks[overInMain].id;
        setScheduledTasks((prev) => [
          ...prev.map((t) => t.id === demotedId ? { ...t, priority: "secondary" as const } : t),
          { ...movedTask, scheduledDate: movedTask.scheduledDate ?? todayStr, priority: "main" as const },
        ]);
        updateTaskSvc({ id: movedTask.id, scheduledDate: movedTask.scheduledDate ?? todayStr, priority: "main" }).catch(() => {});
        updateTaskSvc({ id: demotedId, priority: "secondary" }).catch(() => {});
      }
      restoreScroll();
      return;
    }

    if (activeInOverdue !== -1 && overInSec !== -1) {
      const movedTask = overdueTasks[activeInOverdue];
      setOverdueTasks((prev) => prev.filter((t) => t.id !== draggedId));
      setScheduledTasks((prev) => [...prev, { ...movedTask, scheduledDate: todayStr, priority: "secondary" as const }]);
      updateTaskSvc({ id: movedTask.id, scheduledDate: todayStr, priority: "secondary" }).catch(() => {});
      restoreScroll();
    }
  }

  function handleDayDragEnd(activeIdStr: string, overId: string) {
    const dayDate = selectedFilter as string;

    if (overId === DAY_MAIN_DROP_ID) {
      const secIdx = daySecTasks.findIndex((t) => t.id === activeIdStr);
      const overdueIdx = overdueTasks.findIndex((t) => t.id === activeIdStr);
      if (secIdx !== -1 && dayMainTasks.length < dailyPriorityCount) {
        const task = daySecTasks[secIdx];
        commitDayTasks(dayDate, [...dayMainTasks, { ...task, priority: "main" as const }], daySecTasks.filter((t) => t.id !== task.id));
        updateTaskSvc({ id: task.id, priority: "main" }).catch(() => {});
      } else if (overdueIdx !== -1) {
        const movedTask = overdueTasks[overdueIdx];
        const priority: "main" | "secondary" = dayMainTasks.length < dailyPriorityCount ? "main" : "secondary";
        setOverdueTasks((prev) => prev.filter((t) => t.id !== activeIdStr));
        const task = { ...movedTask, scheduledDate: dayDate, priority };
        if (priority === "main") {
          commitDayTasks(dayDate, [...dayMainTasks, task], daySecTasks);
        } else {
          commitDayTasks(dayDate, dayMainTasks, [...daySecTasks, task]);
        }
        updateTaskSvc({ id: movedTask.id, scheduledDate: dayDate, priority }).catch(() => {});
      }
      return;
    }

    const activeMainIdx = dayMainTasks.findIndex((t) => t.id === activeIdStr);
    const activeSecIdx = daySecTasks.findIndex((t) => t.id === activeIdStr);
    const activeOverdueIdx = overdueTasks.findIndex((t) => t.id === activeIdStr);
    const overMainIdx = dayMainTasks.findIndex((t) => t.id === overId);
    const overSecIdx = daySecTasks.findIndex((t) => t.id === overId);

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

    if (activeMainIdx !== -1 && overMainIdx !== -1) {
      commitDayTasks(dayDate, arrayMove(dayMainTasks, activeMainIdx, overMainIdx), daySecTasks);
      return;
    }

    if (activeSecIdx !== -1 && overSecIdx !== -1) {
      commitDayTasks(dayDate, dayMainTasks, arrayMove(daySecTasks, activeSecIdx, overSecIdx));
      return;
    }

    if (activeMainIdx !== -1 && overSecIdx !== -1) {
      const task = dayMainTasks[activeMainIdx];
      const newSec = [...daySecTasks];
      newSec.splice(overSecIdx, 0, { ...task, priority: "secondary" as const });
      commitDayTasks(dayDate, dayMainTasks.filter((t) => t.id !== task.id), newSec);
      updateTaskSvc({ id: task.id, priority: "secondary" }).catch(() => {});
      return;
    }

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

  const allCallbacks = {
    ...taskCallbacks,
    onSetScheduledDate: setScheduledDate,
  };

  const dismissPrep = useCallback(() => {
    setSetting(weekPrepKey(toISODate(monday)), "done").catch(() => {});
    setPrepDone(true);
  }, [monday]);

  const launchPrep = useCallback(() => {
    dismissPrep();
    onLaunchWeeklyPrep?.();
  }, [dismissPrep, onLaunchWeeklyPrep]);

  return (
    <div ref={wrapperRef}>
      {!prepDone && !isWeekCompleted && (
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

        <AddTaskInput
          onAdd={handleAddTask}
          placeholder={isWeekMode ? undefined : `Ajouter une tâche pour ${selectedDayLabel}…`}
        />

        {isWeekMode ? (
          <>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <span className={styles.priorityIcon}>⚡</span>
                Priorités de la semaine
              </span>
              <span className={styles.sectionCount}>
                {prioritiesDone}/{weekMainTasks.length}
              </span>
            </div>
            <SortableContext items={weekMainTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {weekMainTasks.length === 0 && (
                  <DroppableEmptyZone id={WEEK_PRI_DROP_ID} label="Glisse une tâche ici pour la prioriser" />
                )}
                {weekMainTasks.map((task, i) => (
                  <SortableTaskItem key={task.id} task={task} {...allCallbacks}
                    isDecomposing={decomposingId === task.id} decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.08 + i * 0.04} />
                ))}
              </div>
            </SortableContext>

            {weekSecTasks.length > 0 && (
              <>
                <div className={`${styles.sectionHeader} ${styles.secondaryHeader}`}>
                  <span className={`${styles.sectionTitle} ${styles.secondaryTitle}`}>Aussi prévu cette semaine</span>
                  <span className={styles.sectionCount}>{secondaryDone}/{weekSecTasks.length}</span>
                </div>
                <SortableContext items={weekSecTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className={styles.taskList}>
                    {weekSecTasks.map((task, i) => (
                      <SortableTaskItem key={task.id} task={task} {...allCallbacks}
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
                {prioritiesDone}/
                <span className={dayPriorityOverflow ? styles.sectionCountOverflow : undefined}>
                  {dayMainTasks.length}
                </span>
                {dayPriorityOverflow && (
                  <span className={styles.overflowHint}>
                    (max {dailyPriorityCount})
                  </span>
                )}
              </span>
            </div>
            <SortableContext items={dayMainTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {dayMainTasks.length === 0 && (
                  <DroppableEmptyZone id={DAY_MAIN_DROP_ID} label={allDayTasks.length === 0 ? "Aucune tâche prévue pour ce jour" : "Glisse une tâche ici pour la prioriser"} />
                )}
                {dayMainTasks.map((task, i) => (
                  <SortableTaskItem key={task.id} task={task} {...allCallbacks}
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
                      <SortableTaskItem key={task.id} task={task} {...allCallbacks}
                        isDecomposing={decomposingId === task.id} decomposingStepId={getDecomposingStepId(task.id)}
                        animDelay={0.08 + i * 0.04} isSecondary />
                    ))}
                  </div>
                </SortableContext>
              </>
            )}
          </>
        )}

        {sortedOverdue.length > 0 && (
          <>
            <div className={`${styles.sectionHeader} ${styles.overdueHeader}`}>
              <span className={`${styles.sectionTitle} ${styles.overdueTitle}`}>
                <span className={styles.priorityIcon}>📋</span>
                Reliquat de la semaine passée
              </span>
              <span className={styles.sectionCount}>{sortedOverdue.length}</span>
            </div>
            <SortableContext items={sortedOverdue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.taskList}>
                {sortedOverdue.map((task, i) => (
                  <SortableTaskItem key={task.id} task={task} {...allCallbacks}
                    isDecomposing={decomposingId === task.id} decomposingStepId={getDecomposingStepId(task.id)}
                    animDelay={0.16 + i * 0.04} isSecondary isOverdue />
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

      {!isPlanning && !isWeekCompleted && (
        <div className={styles.reviewSection}>
          <div className={styles.reviewIcon}>📋</div>
          <div className={styles.reviewContent}>
            <span className={styles.reviewTitle}>Revue de la semaine</span>
            <span className={styles.reviewDesc}>
              Fais le point sur ta semaine : objectifs atteints, blocages récurrents, et priorités pour la semaine prochaine.
            </span>
          </div>
          <div className={styles.reviewActions}>
            <button className={styles.reviewBtn} onClick={onLaunchWeeklyReview}>Lancer la revue</button>
            <button className={styles.closeBtn} onClick={handleMarkWeekDone}>Marquer comme terminée</button>
          </div>
        </div>
      )}

      {!isPlanning && isWeekCompleted && (
        <div className={styles.weekCompletedBanner}>
          <span className={styles.weekCompletedIcon}>✓</span>
          <span className={styles.weekCompletedText}>Semaine terminée</span>
          <button className={styles.reopenBtn} onClick={handleReopenWeek}>Réouvrir</button>
        </div>
      )}
    </div>
  );
}
