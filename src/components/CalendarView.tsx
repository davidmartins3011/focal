import { useState, useMemo, useEffect } from "react";
import type { Task } from "../types";
import { getTasks as fetchTasks, toggleTask as toggleTaskSvc, toggleMicroStep as toggleStepSvc } from "../services/tasks";
import TaskItem from "./TaskItem";
import styles from "./CalendarView.module.css";

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const EMPTY_MESSAGES = [
  "Journée libre — et c'est très bien comme ça.",
  "Rien de prévu. Un bon moment pour souffler.",
  "Pas de tâches ici. Ton cerveau te remercie.",
  "Journée ouverte — tu décideras le moment venu.",
];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function relativeLabel(day: Date, now: Date): string | null {
  const diff = daysDiff(now, day);
  if (diff === 0) return "Auj.";
  if (diff === 1) return "Dem.";
  if (diff === -1) return "Hier";
  if (diff >= 2 && diff <= 6) return `+${diff}j`;
  return null;
}

function loadLevel(count: number): "none" | "light" | "medium" | "heavy" {
  if (count === 0) return "none";
  if (count <= 2) return "light";
  if (count <= 4) return "medium";
  return "heavy";
}

function buildCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  let startDay = first.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const start = new Date(year, month, 1 - startDay);
  const days: Date[] = [];
  const d = new Date(start);
  while (days.length < 42) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12 6 8l4-4" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function getWeekStats(tasks: Record<string, Task[]>, now: Date): { done: number; total: number } {
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

  let done = 0;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = toKey(d);
    const dayTasks = tasks[key] ?? [];
    total += dayTasks.length;
    done += dayTasks.filter((t) => t.done).length;
  }
  return { done, total };
}

const today = new Date();

export default function CalendarView() {
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [taskMap, setTaskMap] = useState<Record<string, Task[]>>({});

  useEffect(() => {
    fetchTasks("calendar")
      .then((tasks) => {
        const map: Record<string, Task[]> = {};
        for (const t of tasks) {
          if (!t.scheduledDate) continue;
          (map[t.scheduledDate] ??= []).push(t);
        }
        setTaskMap(map);
      })
      .catch((err) => console.error("[CalendarView] fetchTasks error:", err));
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  function toggleTask(id: string) {
    setTaskMap((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((t) =>
          t.id === id ? { ...t, done: !t.done } : t
        );
      }
      return next;
    });
    toggleTaskSvc(id).catch((err) => console.error("[CalendarView] toggleTask error:", err));
  }

  function toggleStep(_taskId: string, stepId: string) {
    setTaskMap((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((t) => {
          if (!t.microSteps) return t;
          return {
            ...t,
            microSteps: t.microSteps.map((s) =>
              s.id === stepId ? { ...s, done: !s.done } : s
            ),
          };
        });
      }
      return next;
    });
    toggleStepSvc(stepId).catch((err) => console.error("[CalendarView] toggleStep error:", err));
  }

  const selectedTasks: Task[] = taskMap[toKey(selectedDate)] ?? [];
  const totalDone = selectedTasks.filter((t) => t.done).length;
  const totalTasks = selectedTasks.length;
  const allDone = totalTasks > 0 && totalDone === totalTasks;

  const weekStats = useMemo(() => getWeekStats(taskMap, today), [taskMap]);
  const weekPct = weekStats.total > 0 ? Math.round((weekStats.done / weekStats.total) * 100) : 0;

  const formatSelectedDate = () =>
    `${DAY_NAMES[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()].toLowerCase()}`;

  const emptyMessage = useMemo(
    () => EMPTY_MESSAGES[selectedDate.getDate() % EMPTY_MESSAGES.length],
    [selectedDate]
  );

  const isSelectedToday = isSameDay(selectedDate, today);
  const isOverloaded = totalTasks >= 5;

  const rows: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    rows.push(calendarDays.slice(i, i + 7));
  }
  const visibleRows = rows
    .filter((row) => row.some((d) => d.getMonth() === month) || rows.indexOf(row) < 5)
    .slice(0, 6);

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1>Calendrier</h1>
          <button className={styles.todayBtn} onClick={goToday}>Aujourd'hui</button>
        </div>

        <div className={styles.weekScore}>
          <span>Cette semaine</span>
          <div className={styles.weekScoreBar}>
            <div className={styles.weekScoreFill} style={{ width: `${weekPct}%` }} />
          </div>
          <span className={styles.weekScoreCount}>{weekStats.done}/{weekStats.total}</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={prevMonth}><ChevronLeft /></button>
          <span className={styles.monthLabel}>{MONTHS[month]} {year}</span>
          <button className={styles.navBtn} onClick={nextMonth}><ChevronRight /></button>
        </div>

        <div className={styles.weekDays}>
          {DAYS_SHORT.map((d) => (
            <div key={d} className={styles.weekDay}>{d}</div>
          ))}
        </div>

        <div className={styles.grid}>
          {visibleRows.map((row, ri) =>
            row.map((day) => {
              const key = toKey(day);
              const isCurrentMonth = day.getMonth() === month;
              const isDayToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);
              const dayTasks: Task[] = taskMap[key] ?? [];
              const doneCount = dayTasks.filter((t) => t.done).length;
              const taskCount = dayTasks.length;
              const pct = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : -1;
              const dayAllDone = taskCount > 0 && doneCount === taskCount;
              const load = loadLevel(taskCount);
              const rel = isCurrentMonth ? relativeLabel(day, today) : null;

              return (
                <button
                  key={`${ri}-${day.getDate()}-${day.getMonth()}`}
                  className={[
                    styles.cell,
                    !isCurrentMonth && styles.otherMonth,
                    isDayToday && styles.today,
                    isSelected && styles.selected,
                    dayAllDone && styles.cellDone,
                    load !== "none" && styles[`load_${load}`],
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelectedDate(day)}
                >
                  {rel ? (
                    <span className={`${styles.cellDate} ${styles.cellRelative}`}>{rel}</span>
                  ) : (
                    <span className={styles.cellDate}>{day.getDate()}</span>
                  )}

                  {taskCount > 0 && (
                    <div className={styles.miniBar}>
                      <div
                        className={`${styles.miniFill} ${dayAllDone ? styles.miniFillDone : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className={styles.detail} key={toKey(selectedDate)}>
          <div className={styles.detailHeader}>
            <span className={styles.detailDate}>{formatSelectedDate()}</span>
            {totalTasks > 0 && (
              <span className={`${styles.detailCount} ${allDone ? styles.detailCountDone : ""}`}>
                {allDone ? "✓ Tout terminé" : `${totalDone}/${totalTasks} terminée${totalTasks > 1 ? "s" : ""}`}
              </span>
            )}
          </div>

          {isOverloaded && !allDone && (
            <div className={styles.overloadWarn}>
              <span>⚡</span>
              <span>Journée chargée — {totalTasks} tâches. Pense à redistribuer si besoin.</span>
            </div>
          )}

          {selectedTasks.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>☁</span>
              <span>{emptyMessage}</span>
            </div>
          ) : (
            <div className={styles.taskList}>
              {selectedTasks.map((task, i) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onToggleStep={toggleStep}
                  animDelay={0.05 + i * 0.03}
                />
              ))}
            </div>
          )}

          {totalTasks > 0 && !allDone && (
            <button className={styles.prepareBtn}>
              {isSelectedToday ? "✦ Préparer ma journée" : "✦ Planifier cette journée"}
            </button>
          )}

          {allDone && (
            <div className={styles.allDoneBanner}>
              <span className={styles.allDoneIcon}>✓</span>
              <span>Bravo, tout est bouclé pour cette journée !</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
