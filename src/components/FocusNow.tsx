import styles from "./FocusNow.module.css";

interface Props {
  task: string;
  estimatedMinutes: number;
  onStart: () => void;
}

export default function FocusNow({ task, estimatedMinutes, onStart }: Props) {
  return (
    <div className={styles.focusBar}>
      <span className={styles.indicator} />
      <span className={styles.task}>{task}</span>
      <span className={styles.time}>~{estimatedMinutes} min</span>
      <button className={styles.btn} onClick={onStart}>
        Commencer
      </button>
    </div>
  );
}
