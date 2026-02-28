import { useState, useEffect, useCallback, useRef } from "react";
import type { NotificationSettings, NotificationHistoryEntry, WeekDayId, NotificationReminder } from "../types";
import type { ToastData } from "../components/NotificationToast";
import { defaultReminders } from "../data/settingsData";
import { getSetting, setSetting } from "../services/settings";
import {
  getNotificationHistory,
  addNotificationEntry,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notifications";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const JS_DAY_TO_WEEKDAY: Record<number, WeekDayId> = {
  0: "dim", 1: "lun", 2: "mar", 3: "mer", 4: "jeu", 5: "ven", 6: "sam",
};

const defaultNotifSettings: NotificationSettings = {
  enabled: true,
  reminders: defaultReminders,
};

let nativePermissionGranted: boolean | null = null;

async function ensureNativePermission(): Promise<boolean> {
  if (nativePermissionGranted === true) return true;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }
    nativePermissionGranted = granted;
    return granted;
  } catch {
    return false;
  }
}

async function sendNativeNotification(title: string, body: string) {
  const granted = await ensureNativePermission();
  if (!granted) return;
  try {
    sendNotification({ title, body });
  } catch { /* silently ignore — in-app toast is the fallback */ }
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isMonthActiveForFrequency(
  freq: "monthly" | "bimonthly" | "quarterly" | "biannual",
  cycleStart: number,
  month: number,
): boolean {
  const step = freq === "monthly" ? 1 : freq === "bimonthly" ? 2 : freq === "quarterly" ? 3 : 6;
  const start = (cycleStart - 1) % step;
  return month % step === start;
}

function shouldReminderFireOnDate(r: NotificationReminder, date: Date): boolean {
  const dayId = JS_DAY_TO_WEEKDAY[date.getDay()];
  if (!r.days.includes(dayId)) return false;
  if (!r.frequency) return true;
  if (r.frequency === "weekly") return true;

  if (r.frequency === "biweekly") {
    const weekNum = getISOWeekNumber(date);
    const occ = r.frequencyOccurrence ?? "1st";
    return occ === "1st" ? weekNum % 2 === 1 : weekNum % 2 === 0;
  }

  const month = date.getMonth();
  if (!isMonthActiveForFrequency(r.frequency, r.frequencyCycleStart ?? 1, month)) {
    return false;
  }

  const occ = r.frequencyOccurrence ?? "1st";
  const dayOfMonth = date.getDate();
  const nth = Math.ceil(dayOfMonth / 7);

  if (occ === "last") {
    const nextWeek = new Date(date);
    nextWeek.setDate(dayOfMonth + 7);
    return nextWeek.getMonth() !== date.getMonth();
  }

  const occNum = { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4 }[occ] ?? 1;
  return nth === occNum;
}

function detectMissedNotifications(
  settings: NotificationSettings,
  existingHistory: NotificationHistoryEntry[],
  lastActive: string | null,
): NotificationHistoryEntry[] {
  if (!settings.enabled || !lastActive) return [];

  const lastActiveDate = new Date(lastActive);
  const now = new Date();
  if (now <= lastActiveDate) return [];

  const missed: NotificationHistoryEntry[] = [];
  const existingIds = new Set(existingHistory.map((e) => e.id));

  for (const r of settings.reminders) {
    if (!r.enabled) continue;

    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);

    const lowerBound = new Date(lastActiveDate);
    lowerBound.setHours(0, 0, 0, 0);

    while (cursor >= lowerBound) {
      if (!shouldReminderFireOnDate(r, cursor)) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }

      const dateKey = cursor.toISOString().slice(0, 10);
      const scheduledDate = new Date(`${dateKey}T${r.time}:00`);

      if (scheduledDate > lastActiveDate && scheduledDate <= now) {
        const entryId = `${r.id}-${dateKey}-${r.time}`;
        if (existingIds.has(entryId)) break;

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
        break;
      }

      cursor.setDate(cursor.getDate() - 1);
    }
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
            sendNativeNotification(
              `${m.icon} ${m.label} (manqué)`,
              m.description,
            );
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
      const dateKey = now.toISOString().slice(0, 10);

      for (const r of notifSettings.reminders) {
        if (!r.enabled) continue;
        if (r.time !== hhmm) continue;
        if (!shouldReminderFireOnDate(r, now)) continue;

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

        sendNativeNotification(`${r.icon} ${r.label}`, r.description);

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

    sendNativeNotification(`${sample.icon} ${sample.label}`, sample.description);

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
