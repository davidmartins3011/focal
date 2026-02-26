import styles from "./ProgressBar.module.css";

interface Props {
  done: number;
  total: number;
  streak?: number;
}

export default function ProgressBar({ done, total, streak }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        <span>Progression du jour</span>
        <div className={styles.labelRight}>
          {streak != null && streak > 0 && (
            <span className={styles.streak}>
              <span className={styles.streakFire}>🔥</span>
              {streak}j
            </span>
          )}
          <span className={styles.count}>{done} / {total} tâches</span>
        </div>
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
