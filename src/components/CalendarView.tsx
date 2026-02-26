import { useState, useMemo } from "react";
import type { Task } from "../types";
import TaskItem from "./TaskItem";
import styles from "./CalendarView.module.css";

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

const today = new Date();

const mockTasks: Record<string, Task[]> = (() => {
  const y = today.getFullYear();
  const m = today.getMonth();
  const map: Record<string, Task[]> = {};

  const add = (day: number, tasks: Task[]) => {
    map[toKey(new Date(y, m, day))] = tasks;
  };

  add(today.getDate(), [
    { id: "c1", name: "Finaliser wireframes page pricing", done: false, tags: [{ label: "SaaS", color: "saas" }] },
    { id: "c2", name: "Répondre au mail de Marc", done: true, tags: [{ label: "CRM", color: "crm" }] },
    { id: "c3", name: "Préparer le standup", done: false, tags: [{ label: "Roadmap", color: "roadmap" }] },
  ]);

  add(today.getDate() - 1, [
    { id: "c4", name: "Revue de code PR #42", done: true, tags: [{ label: "Data", color: "data" }] },
    { id: "c5", name: "Rédiger spec notifications", done: true, tags: [{ label: "SaaS", color: "saas" }] },
  ]);

  add(today.getDate() + 1, [
    { id: "c6", name: "Call client Neovision — 14h", done: false, tags: [{ label: "CRM", color: "crm" }] },
  ]);

  add(today.getDate() + 3, [
    { id: "c7", name: "Livraison MVP dashboard", done: false, tags: [{ label: "Roadmap", color: "roadmap" }, { label: "Urgent", color: "urgent" }] },
    { id: "c8", name: "Tests E2E module facturation", done: false, tags: [{ label: "SaaS", color: "saas" }] },
  ]);

  add(today.getDate() + 5, [
    { id: "c9", name: "Webinaire produit — 10h30", done: false, tags: [{ label: "SaaS", color: "saas" }] },
    { id: "c10", name: "Synchro data pipeline", done: false, tags: [{ label: "Data", color: "data" }] },
    { id: "c11", name: "Déjeuner équipe", done: false, tags: [] },
  ]);

  add(today.getDate() - 3, [
    { id: "c12", name: "Intégration API paiement", done: true, tags: [{ label: "SaaS", color: "saas" }] },
  ]);

  add(today.getDate() - 5, [
    { id: "c13", name: "Planifier sprint Q2", done: true, tags: [{ label: "Roadmap", color: "roadmap" }] },
    { id: "c14", name: "Mise à jour documentation", done: true, tags: [{ label: "Data", color: "data" }] },
  ]);

  return map;
})();

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

export default function CalendarView() {
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const selectedTasks = mockTasks[toKey(selectedDate)] ?? [];

  const totalDone = selectedTasks.filter((t) => t.done).length;
  const totalTasks = selectedTasks.length;

  const formatSelectedDate = () => {
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return `${dayNames[selectedDate.getDay()]} ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()].toLowerCase()}`;
  };

  const rows: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    rows.push(calendarDays.slice(i, i + 7));
  }
  const visibleRows = rows.filter((row) =>
    row.some((d) => d.getMonth() === month) || rows.indexOf(row) < 5
  ).slice(0, 6);

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1>Calendrier</h1>
          <button className={styles.todayBtn} onClick={goToday}>Aujourd'hui</button>
        </div>
        <p>Vue d'ensemble de ton mois et tes deadlines</p>
      </div>

      <div className={styles.content}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={prevMonth}>
            <ChevronLeft />
          </button>
          <span className={styles.monthLabel}>
            {MONTHS[month]} {year}
          </span>
          <button className={styles.navBtn} onClick={nextMonth}>
            <ChevronRight />
          </button>
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
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);
              const dayTasks = mockTasks[key] ?? [];
              const doneCount = dayTasks.filter((t) => t.done).length;
              const pendingCount = dayTasks.length - doneCount;

              return (
                <button
                  key={`${ri}-${day.getDate()}-${day.getMonth()}`}
                  className={[
                    styles.cell,
                    !isCurrentMonth && styles.otherMonth,
                    isToday && styles.today,
                    isSelected && styles.selected,
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelectedDate(day)}
                >
                  <span className={styles.cellDate}>{day.getDate()}</span>
                  {dayTasks.length > 0 && (
                    <div className={styles.dots}>
                      {Array.from({ length: Math.min(doneCount, 3) }).map((_, i) => (
                        <span key={`d${i}`} className={`${styles.dot} ${styles.dotDone}`} />
                      ))}
                      {Array.from({ length: Math.min(pendingCount, 3) }).map((_, i) => (
                        <span key={`p${i}`} className={`${styles.dot} ${styles.dotPending}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <span className={styles.detailDate}>{formatSelectedDate()}</span>
            {totalTasks > 0 && (
              <span className={styles.detailCount}>
                {totalDone}/{totalTasks} terminée{totalTasks > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {selectedTasks.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>✦</span>
              <span>Aucune tâche prévue</span>
            </div>
          ) : (
            <div className={styles.taskList}>
              {selectedTasks.map((task, i) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={() => {}}
                  onToggleStep={() => {}}
                  animDelay={0.05 + i * 0.03}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
