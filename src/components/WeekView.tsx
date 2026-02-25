import type { WeekDay, Task } from "../types";
import TaskItem from "./TaskItem";
import styles from "./WeekView.module.css";

const weekDays: WeekDay[] = [
  { name: "Lun", date: 23, isToday: false, taskSummary: "5 tâches", dots: ["done", "done", "done", "done", "done"] },
  { name: "Mar", date: 24, isToday: false, taskSummary: "4 tâches", dots: ["done", "done", "done", "pending"] },
  { name: "Mer", date: 25, isToday: true, taskSummary: "7 tâches · 3 faites", dots: ["done", "done", "done", "pending", "pending"] },
  { name: "Jeu", date: 26, isToday: false, taskSummary: "3 tâches", dots: ["empty", "empty", "empty"] },
  { name: "Ven", date: 27, isToday: false, taskSummary: "Sprint review", dots: ["empty", "empty"] },
];

const weekPriorities: Task[] = [
  { id: "w1", name: "Finaliser la roadmap Q1 avec l'équipe", done: true, tags: [{ label: "Roadmap", color: "roadmap" }] },
  { id: "w2", name: "Livrer la revue de sprint vendredi", done: false, tags: [{ label: "Roadmap", color: "roadmap" }] },
  { id: "w3", name: "Corriger le bug pipeline dbt en prod", done: false, tags: [{ label: "Data Platform", color: "data" }] },
  { id: "w4", name: "Valider le concept SaaS TDAH avec 3 personnes", done: false, tags: [{ label: "SaaS", color: "saas" }] },
];

export default function WeekView() {
  return (
    <div>
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
    </div>
  );
}
