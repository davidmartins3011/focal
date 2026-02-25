import styles from "./ReviewView.module.css";

export default function ReviewView() {
  return (
    <div>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Bilan du jour</span>
      </div>
      <div className={styles.card}>
        <p>
          Clique sur{" "}
          <strong className={styles.accent}>Lancer la revue</strong>{" "}
          pour que focal. t'accompagne dans ton bilan de fin de journée.
        </p>
        <p className={styles.details}>
          Il t'aidera à : capturer ce que tu as accompli, noter les blocages,
          et définir ton top 3 de demain.
        </p>
      </div>
      <button className={styles.btn}>Lancer la revue du soir</button>
    </div>
  );
}
