import styles from "./PrepBanner.module.css";

interface PrepBannerProps {
  variant: "daily" | "weekly";
  onLaunch: () => void;
  onDismiss: () => void;
}

const config = {
  daily: {
    icon: "🌅",
    title: "Prépare ta journée",
    description:
      "Définis tes priorités du jour, estime tes tâches et identifie ta première action. 5 minutes pour une journée plus fluide.",
    button: "Lancer la préparation",
    dismiss: "C'est bon pour aujourd'hui",
  },
  weekly: {
    icon: "📋",
    title: "Prépare ta semaine",
    description:
      "Pose tes objectifs de la semaine, répartis tes tâches sur les jours et identifie les blocages potentiels.",
    button: "Lancer la préparation",
    dismiss: "C'est bon pour cette semaine",
  },
};

export default function PrepBanner({ variant, onLaunch, onDismiss }: PrepBannerProps) {
  const c = config[variant];

  return (
    <div className={styles.banner}>
      <div className={styles.header}>
        <span className={styles.icon}>{c.icon}</span>
        <div className={styles.content}>
          <div className={styles.title}>{c.title}</div>
          <div className={styles.desc}>{c.description}</div>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.launchBtn} onClick={onLaunch}>
          {c.button}
        </button>
        <button className={styles.dismissBtn} onClick={onDismiss}>
          {c.dismiss}
        </button>
      </div>
    </div>
  );
}
