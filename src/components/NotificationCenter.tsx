import type { NotificationHistoryEntry } from "../types";
import styles from "./NotificationCenter.module.css";

interface NotificationCenterProps {
  history: NotificationHistoryEntry[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationCenter({
  history,
  onDismiss,
  onDismissAll,
  onClose,
}: NotificationCenterProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const todayEntries = history
    .filter((e) => !e.read && (e.firedAt.slice(0, 10) === todayStr || e.missed))
    .sort((a, b) => b.firedAt.localeCompare(a.firedAt))
    .slice(0, 8);

  const missedEntries = todayEntries.filter((e) => e.missed);
  const liveEntries = todayEntries.filter((e) => !e.missed);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>Rappels du jour</span>
          {todayEntries.length > 0 && (
            <button className={styles.clearBtn} onClick={onDismissAll}>
              Tout vu
            </button>
          )}
        </div>

        <div className={styles.list}>
          {todayEntries.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>✨</span>
              <span className={styles.emptyText}>Rien de nouveau pour l'instant.</span>
              <span className={styles.emptyHint}>Tes prochains rappels apparaîtront ici.</span>
            </div>
          ) : (
            <>
              {missedEntries.length > 0 && (
                <div className={styles.catchupCard}>
                  <div className={styles.catchupHeader}>
                    <span className={styles.catchupIcon}>👋</span>
                    <span className={styles.catchupTitle}>
                      Pendant ton absence
                    </span>
                  </div>
                  <div className={styles.catchupBody}>
                    {missedEntries.length === 1 ? (
                      <span>
                        Tu avais un rappel prévu : <strong>{missedEntries[0].label}</strong> à {missedEntries[0].scheduledTime}.
                        {" "}Pas de souci, on reprend là où tu en es.
                      </span>
                    ) : (
                      <span>
                        Tu avais {missedEntries.length} rappels prévus
                        ({missedEntries.map((e) => e.scheduledTime).join(", ")}).
                        {" "}C'est ok, l'important c'est maintenant.
                      </span>
                    )}
                  </div>
                  <div className={styles.catchupItems}>
                    {missedEntries.map((entry) => (
                      <div key={entry.id} className={styles.catchupItem}>
                        <span className={styles.catchupItemIcon}>{entry.icon}</span>
                        <span className={styles.catchupItemLabel}>{entry.label}</span>
                        <span className={styles.catchupItemTime}>{entry.scheduledTime}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className={styles.catchupDismiss}
                    onClick={() => missedEntries.forEach((e) => onDismiss(e.id))}
                  >
                    C'est noté, merci
                  </button>
                </div>
              )}

              {liveEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={styles.item}
                  onClick={() => onDismiss(entry.id)}
                >
                  <span className={styles.itemIcon}>{entry.icon}</span>
                  <div className={styles.itemBody}>
                    <div className={styles.itemLabel}>{entry.label}</div>
                    <div className={styles.itemDesc}>{entry.description}</div>
                  </div>
                  <span className={styles.itemTime}>{formatTime(entry.firedAt)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
