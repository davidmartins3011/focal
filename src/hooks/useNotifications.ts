import { useState, useEffect, useCallback, useRef } from "react";
import type { NotificationSettings, NotificationHistoryEntry, WeekDayId } from "../types";
import type { ToastData } from "../components/NotificationToast";
import { defaultReminders } from "../data/mockSettings";
import { getSetting, setSetting } from "../services/settings";
import {
  getNotificationHistory,
  addNotificationEntry,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notifications";

const JS_DAY_TO_WEEKDAY: Record<number, WeekDayId> = {
  0: "dim", 1: "lun", 2: "mar", 3: "mer", 4: "jeu", 5: "ven", 6: "sam",
};

const defaultNotifSettings: NotificationSettings = {
  enabled: true,
  reminders: defaultReminders,
};

function detectMissedNotifications(
  settings: NotificationSettings,
  existingHistory: NotificationHistoryEntry[],
  lastActive: string | null,
): NotificationHistoryEntry[] {
  if (!settings.enabled || !lastActive) return [];

  const lastActiveDate = new Date(lastActive);
  const now = new Date();
  const missed: NotificationHistoryEntry[] = [];
  const existingIds = new Set(existingHistory.map((e) => e.id));

  const current = new Date(lastActiveDate);
  current.setSeconds(0, 0);

  while (current <= now) {
    const dateKey = current.toISOString().slice(0, 10);
    const dayId = JS_DAY_TO_WEEKDAY[current.getDay()];
    const hhmm = `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;

    for (const r of settings.reminders) {
      if (!r.enabled) continue;
      if (r.time !== hhmm) continue;
      if (!r.days.includes(dayId)) continue;

      const entryId = `${r.id}-${dateKey}-${hhmm}`;
      if (existingIds.has(entryId)) continue;

      const scheduledDate = new Date(`${dateKey}T${hhmm}:00`);
      if (scheduledDate <= lastActiveDate || scheduledDate > now) continue;

      missed.push({
        id: entryId,
        reminderId: r.id,
        icon: r.icon,
        label: r.label,
        description: r.description,
        scheduledTime: r.time,
        firedAt: scheduledDate.toISOString(),
        missed: true,
        read: false,
      });
      existingIds.add(entryId);
    }

    current.setMinutes(current.getMinutes() + 1);
  }

  return missed;
}

function saveLastActive() {
  setSetting("last-active", new Date().toISOString()).catch(() => {});
}

export function useNotifications() {
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(defaultNotifSettings);
  const [notifHistory, setNotifHistory] = useState<NotificationHistoryEntry[]>([]);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const firedRef = useRef<Set<string>>(new Set());
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([
      getSetting("notification-settings"),
      getNotificationHistory(),
      getSetting("last-active"),
    ])
      .then(([rawSettings, history, lastActive]) => {
        let settings = defaultNotifSettings;
        if (rawSettings) {
          try {
            const parsed = JSON.parse(rawSettings) as NotificationSettings;
            if (parsed.reminders?.length) {
              const storedIds = new Set(parsed.reminders.map((r) => r.id));
              const missing = defaultReminders.filter((r) => !storedIds.has(r.id));
              if (missing.length > 0) parsed.reminders = [...parsed.reminders, ...missing];
              settings = parsed;
            }
          } catch { /* ignore */ }
        }
        setNotifSettings(settings);
        setNotifHistory(history);

        const missed = detectMissedNotifications(settings, history, lastActive);
        if (missed.length > 0) {
          setNotifHistory((prev) => [...prev, ...missed]);
          setNotifCenterOpen(true);
          for (const m of missed) {
            addNotificationEntry({
              reminderId: m.reminderId,
              icon: m.icon,
              label: m.label,
              description: m.description,
              scheduledTime: m.scheduledTime,
              firedAt: m.firedAt,
              missed: true,
            }).catch(() => {});
          }
        }

        saveLastActive();
        loaded.current = true;
      })
      .catch((err) => {
        console.error("[useNotifications] init error:", err);
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (loaded.current) {
      setSetting("notification-settings", JSON.stringify(notifSettings)).catch(() => {});
    }
  }, [notifSettings]);

  useEffect(() => {
    const interval = setInterval(saveLastActive, 60_000);
    const handleBeforeUnload = () => saveLastActive();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const addHistoryEntry = useCallback((entry: NotificationHistoryEntry) => {
    setNotifHistory((prev) => [...prev, entry]);
    addNotificationEntry({
      reminderId: entry.reminderId,
      icon: entry.icon,
      label: entry.label,
      description: entry.description,
      scheduledTime: entry.scheduledTime,
      firedAt: entry.firedAt,
      missed: entry.missed,
    }).catch(() => {});
  }, []);

  const pushToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev, toast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!notifSettings.enabled) return;

    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = JS_DAY_TO_WEEKDAY[now.getDay()];
      const dateKey = now.toISOString().slice(0, 10);

      for (const r of notifSettings.reminders) {
        if (!r.enabled) continue;
        if (r.time !== hhmm) continue;
        if (!r.days.includes(today)) continue;

        const firedKey = `${r.id}-${dateKey}-${hhmm}`;
        if (firedRef.current.has(firedKey)) continue;
        firedRef.current.add(firedKey);

        pushToast({
          id: `${r.id}-${Date.now()}`,
          icon: r.icon,
          label: r.label,
          description: r.description,
          time: hhmm,
          reminderId: r.id,
        });

        addHistoryEntry({
          id: firedKey,
          reminderId: r.id,
          icon: r.icon,
          label: r.label,
          description: r.description,
          scheduledTime: r.time,
          firedAt: now.toISOString(),
          missed: false,
          read: false,
        });
      }
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [notifSettings, pushToast, addHistoryEntry]);

  const handleTestNotification = useCallback(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const samples = notifSettings.reminders.filter((r) => r.enabled);
    const sample = samples.length > 0
      ? samples[Math.floor(Math.random() * samples.length)]
      : notifSettings.reminders[0];

    const toastId = `test-${Date.now()}`;
    pushToast({
      id: toastId,
      icon: sample.icon,
      label: sample.label,
      description: sample.description,
      time: hhmm,
    });

    addHistoryEntry({
      id: toastId,
      reminderId: sample.id,
      icon: sample.icon,
      label: sample.label,
      description: sample.description,
      scheduledTime: hhmm,
      firedAt: now.toISOString(),
      missed: false,
      read: false,
    });
  }, [notifSettings, pushToast, addHistoryEntry]);

  const handleDismissNotif = useCallback((id: string) => {
    setNotifHistory((prev) =>
      prev.map((e) => (e.id === id ? { ...e, read: true } : e))
    );
    markNotificationRead(id).catch(() => {});
  }, []);

  const handleDismissAll = useCallback(() => {
    setNotifHistory((prev) => prev.map((e) => ({ ...e, read: true })));
    markAllNotificationsRead().catch(() => {});
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const hasUnreadNotifs = notifHistory.some(
    (e) => !e.read && e.firedAt.slice(0, 10) === todayStr
  );

  return {
    notifSettings,
    setNotifSettings,
    notifHistory,
    toasts,
    notifCenterOpen,
    setNotifCenterOpen,
    dismissToast,
    handleTestNotification,
    handleDismissNotif,
    handleDismissAll,
    hasUnreadNotifs,
  };
}
