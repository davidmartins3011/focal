import styles from "./IntegrationsView.module.css";

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: "urgency" | "importance";
}

export default function ScoreSelector({ label, value, onChange, color }: Props) {
  return (
    <div className={styles.scoreRow}>
      <span className={styles.scoreLabel}>{label}</span>
      <div className={styles.scoreDots}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`${styles.scoreDot} ${n <= value ? styles[`${color}Active`] : ""}`}
            onClick={() => onChange(n)}
            title={`${n}/5`}
          />
        ))}
      </div>
      <span className={styles.scoreValue}>{value}/5</span>
    </div>
  );
}
