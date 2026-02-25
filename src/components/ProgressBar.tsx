import styles from "./ProgressBar.module.css";

interface Props {
  done: number;
  total: number;
}

export default function ProgressBar({ done, total }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        <span>Progression du jour</span>
        <span className={styles.count}>{done} / {total} tâches</span>
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
