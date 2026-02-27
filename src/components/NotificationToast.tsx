import { useState, useEffect, useCallback } from "react";
import styles from "./NotificationToast.module.css";

export interface ToastData {
  id: string;
  icon: string;
  label: string;
  description: string;
  time: string;
  reminderId?: string;
}

interface NotificationToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  onAction?: (id: string) => void;
}

function ToastItem({
  toast,
  onDismiss,
  onAction,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
  onAction?: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 250);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  return (
    <div
      className={`${styles.toast} ${exiting ? styles.exiting : ""}`}
      onClick={() => {
        onAction?.(toast.id);
        dismiss();
      }}
    >
      <span className={styles.icon}>{toast.icon}</span>
      <div className={styles.body}>
        <div className={styles.label}>{toast.label}</div>
        <div className={styles.description}>{toast.description}</div>
        <div className={styles.time}>{toast.time}</div>
        <div className={styles.actionHint}>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Voir
        </div>
      </div>
      <button
        className={styles.close}
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function NotificationToast({
  toasts,
  onDismiss,
  onAction,
}: NotificationToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.overlay}>
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          toast={t}
          onDismiss={onDismiss}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
