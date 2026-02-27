import TaskItem from "./TaskItem";
import { weekDays, weekPriorities } from "../data/mockTasks";
import styles from "./WeekView.module.css";

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
