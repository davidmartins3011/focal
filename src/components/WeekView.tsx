import { useState, useCallback, useEffect, useMemo } from "react";
import PrepBanner from "./PrepBanner";
import TaskItem from "./TaskItem";
import { getTasks as fetchTasks, getTasksByDateRange, toggleTask as toggleTaskSvc, toggleMicroStep as toggleStepSvc, updateTask as updateTaskSvc } from "../services/tasks";
import { getSetting, setSetting } from "../services/settings";
import type { Task, WeekDay } from "../types";
import styles from "./WeekView.module.css";

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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

function buildWeekDays(monday: Date, tasksByDate: Map<string, Task[]>): WeekDay[] {
  const today = fmtDate(new Date());
  const days: WeekDay[] = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = fmtDate(d);
    const tasks = tasksByDate.get(key) ?? [];
    const total = tasks.length;
    const doneCount = tasks.filter((t) => t.done).length;

    let taskSummary: string;
    if (total === 0) {
      taskSummary = "Aucune tâche";
    } else if (total === 1) {
      taskSummary = tasks[0].name.length > 24
        ? tasks[0].name.slice(0, 22) + "…"
        : tasks[0].name;
    } else {
      taskSummary = `${total} tâches`;
      if (doneCount > 0 && doneCount < total) {
        taskSummary += ` · ${doneCount} faite${doneCount > 1 ? "s" : ""}`;
      }
    }

    const dots: ("done" | "pending")[] = tasks.map((t) =>
      t.done ? "done" : "pending"
    );

    days.push({
      name: DAY_NAMES[d.getDay()],
      date: d.getDate(),
      isToday: key === today,
      taskSummary,
      dots,
    });
  }

  return days;
}

export default function WeekView() {
  const [prepDone, setPrepDone] = useState(true);
  const [weekPriorities, setWeekPriorities] = useState<Task[]>([]);
  const [calendarTasks, setCalendarTasks] = useState<Task[]>([]);

  const monday = useMemo(() => getMonday(new Date()), []);

  useEffect(() => {
    fetchTasks("week")
      .then(setWeekPriorities)
      .catch((err) => console.error("[WeekView] fetchTasks error:", err));

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    getTasksByDateRange(fmtDate(monday), fmtDate(friday))
      .then(setCalendarTasks)
      .catch((err) => console.error("[WeekView] getTasksByDateRange error:", err));

    getSetting(weekKey())
      .then((val) => setPrepDone(val === "done"))
      .catch(() => {});
  }, [monday]);

  const weekDays = useMemo(() => {
    const byDate = new Map<string, Task[]>();
    for (const task of calendarTasks) {
      if (!task.scheduledDate) continue;
      const list = byDate.get(task.scheduledDate) ?? [];
      list.push(task);
      byDate.set(task.scheduledDate, list);
    }
    return buildWeekDays(monday, byDate);
  }, [monday, calendarTasks]);

  function toggleTask(id: string) {
    setWeekPriorities((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    toggleTaskSvc(id).catch((err) => console.error("[WeekView] toggleTask error:", err));
  }

  function toggleStep(taskId: string, stepId: string) {
    setWeekPriorities((prev) =>
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
    toggleStepSvc(stepId).catch((err) => console.error("[WeekView] toggleStep error:", err));
  }

  function setScheduledDate(id: string, date: string | undefined) {
    setWeekPriorities((prev) =>
      prev.map((t) => t.id === id ? { ...t, scheduledDate: date } : t)
    );
    updateTaskSvc({ id, scheduledDate: date }).catch((err) => console.error("[WeekView] setScheduledDate error:", err));
  }

  const dismissPrep = useCallback(() => {
    setSetting(weekKey(), "done").catch(() => {});
    setPrepDone(true);
  }, []);

  const launchPrep = useCallback(() => {
    dismissPrep();
  }, [dismissPrep]);

  return (
    <div>
      {!prepDone && (
        <PrepBanner variant="weekly" onLaunch={launchPrep} onDismiss={dismissPrep} />
      )}

      <div className={styles.grid}>
        {weekDays.map((day) => (
          <div
            key={day.date}
            className={`${styles.day} ${day.isToday ? styles.today : ""}`}
          >
            <div className={styles.dayName}>{day.name}</div>
            <div className={`${styles.dayDate} ${day.isToday ? styles.dayDateToday : ""}`}>
              {day.date}
            </div>
            <div className={styles.dayTasks}>{day.taskSummary}</div>
            <div className={styles.dots}>
              {day.dots.map((dot, i) => (
                <div key={i} className={`${styles.dot} ${styles[dot]}`} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Priorités de la semaine</span>
      </div>

      <div className={styles.taskList}>
        {weekPriorities.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={toggleTask}
            onToggleStep={toggleStep}
            onSetScheduledDate={setScheduledDate}
          />
        ))}
      </div>

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
