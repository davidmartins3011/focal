import { useState, useCallback, useEffect } from "react";
import PrepBanner from "./PrepBanner";
import TaskItem from "./TaskItem";
import { weekDays } from "../data/mockTasks";
import { getTasks as fetchTasks } from "../services/tasks";
import type { Task } from "../types";
import styles from "./WeekView.module.css";

function weekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `focal-weekly-prep-${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function isWeeklyPrepDone(): boolean {
  return localStorage.getItem(weekKey()) === "done";
}

export default function WeekView() {
  const [prepDone, setPrepDone] = useState(isWeeklyPrepDone);
  const [weekPriorities, setWeekPriorities] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasks("week")
      .then(setWeekPriorities)
      .catch((err) => console.error("[WeekView] fetchTasks error:", err));
  }, []);

  const dismissPrep = useCallback(() => {
    localStorage.setItem(weekKey(), "done");
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
            onToggle={() => {}}
            onToggleStep={() => {}}
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
