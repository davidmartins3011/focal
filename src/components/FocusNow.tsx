import styles from "./FocusNow.module.css";

interface Props {
  task: string;
  estimatedMinutes: number;
  onStart: () => void;
}

export default function FocusNow({ task, estimatedMinutes, onStart }: Props) {
  return (
    <div className={styles.focusNow}>
      <div className={styles.label}>🎯 Focus maintenant</div>
      <div className={styles.task}>{task}</div>
      <div className={styles.meta}>
        <span className={styles.time}>⏱ ~{estimatedMinutes} min estimées</span>
        <button className={styles.btn} onClick={onStart}>
          Commencer
        </button>
      </div>
    </div>
  );
}
