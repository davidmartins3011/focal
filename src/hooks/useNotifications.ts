import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { NotificationSettings, NotificationHistoryEntry, WeekDayId, NotificationReminder } from "../types";
import { defaultReminders } from "../data/settingsData";
import { getSetting, setSetting } from "../services/settings";
import { getISOWeekNumber, toISODate } from "../utils/dateFormat";
import {
  getNotificationHistory,
  addNotificationEntry,
  markNotificationRead,
  markAllNotificationsRead,
  updateBadgeCount,
} from "../services/notifications";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const JS_DAY_TO_WEEKDAY: Record<number, WeekDayId> = {
  0: "dim", 1: "lun", 2: "mar", 3: "mer", 4: "jeu", 5: "ven", 6: "sam",
};

const defaultNotifSettings: NotificationSettings = {
  enabled: true,
  reminders: defaultReminders,
};

async function sendNativeNotification(title: string, body: string, reminderId?: string) {
  try {
    await invoke("send_clickable_notification", {
      title,
      body,
      reminderId: reminderId ?? "",
    });
  } catch { /* silently ignore */ }
}

function isMonthActiveForFrequency(
  freq: "monthly" | "bimonthly" | "quarterly" | "biannual",
  cycleStart: number,
  month: number,
): boolean {
  if (freq === "monthly") return true;
  const step = freq === "bimonthly" ? 2 : freq === "quarterly" ? 3 : 6;
  const s0 = cycleStart - 1; // 0-indexed cycle start
  // Build active months from cycle start, matching computeCurrentPeriod logic
  for (let m = s0; m < 12; m += step) {
    if (month === m) return true;
  }
  return false;
}

function shouldReminderFireOnDate(r: NotificationReminder, date: Date, workingDays: WeekDayId[]): boolean {
  const dayId = JS_DAY_TO_WEEKDAY[date.getDay()];
  if (!workingDays.includes(dayId)) return false;
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
  workingDays: WeekDayId[],
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
      if (!shouldReminderFireOnDate(r, cursor, workingDays)) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }

      const dateKey = toISODate(cursor);
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

export function useNotifications(workingDays: WeekDayId[]) {
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(defaultNotifSettings);
  const [notifHistory, setNotifHistory] = useState<NotificationHistoryEntry[]>([]);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const firedRef = useRef<Set<string>>(new Set());
  const lastTickRef = useRef<number>(Date.now());
  const loaded = useRef(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("notification-clicked", (event) => {
      const reminderId = event.payload;
      setPendingNavigation(reminderId);
      setNotifHistory((prev) => {
        for (const e of prev) {
          if (e.reminderId === reminderId && !e.read) {
            markNotificationRead(e.id).catch(() => {});
          }
        }
        return prev.map((e) =>
          e.reminderId === reminderId && !e.read ? { ...e, read: true } : e
        );
      });
    }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, []);

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
              const defaultIds = new Set(defaultReminders.map((r) => r.id));
              parsed.reminders = parsed.reminders.filter((r) => defaultIds.has(r.id));
              const storedIds = new Set(parsed.reminders.map((r) => r.id));
              const missing = defaultReminders.filter((r) => !storedIds.has(r.id));
              if (missing.length > 0) parsed.reminders = [...parsed.reminders, ...missing];
              settings = parsed;
            }
          } catch { /* ignore */ }
        }
        setNotifSettings(settings);
        setNotifHistory(history);

        const missed = detectMissedNotifications(settings, history, lastActive, workingDays);
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
              m.reminderId,
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

  useEffect(() => {
    if (!notifSettings.enabled) return;

    const check = () => {
      const now = new Date();
      const nowMs = now.getTime();
      const previousTick = lastTickRef.current;
      lastTickRef.current = nowMs;
      const elapsed = nowMs - previousTick;

      if (elapsed > 120_000) {
        const lastActive = new Date(previousTick).toISOString();
        getNotificationHistory().then((history) => {
          const missed = detectMissedNotifications(notifSettings, history, lastActive, workingDays);
          if (missed.length > 0) {
            setNotifHistory((prev) => {
              const existingIds = new Set(prev.map((e) => e.id));
              const newMissed = missed.filter((m) => !existingIds.has(m.id));
              return newMissed.length > 0 ? [...prev, ...newMissed] : prev;
            });
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
                m.reminderId,
              );
            }
          }
          saveLastActive();
        }).catch(() => {});
        return;
      }

      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const dateKey = toISODate(now);

      for (const r of notifSettings.reminders) {
        if (!r.enabled) continue;
        if (r.time !== hhmm) continue;
        if (!shouldReminderFireOnDate(r, now, workingDays)) continue;

        const firedKey = `${r.id}-${dateKey}-${hhmm}`;
        if (firedRef.current.has(firedKey)) continue;
        firedRef.current.add(firedKey);

        sendNativeNotification(`${r.icon} ${r.label}`, r.description, r.id);

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
  }, [notifSettings, addHistoryEntry, workingDays]);

  const handleTestNotification = useCallback(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const samples = notifSettings.reminders.filter((r) => r.enabled);
    const sample = samples.length > 0
      ? samples[Math.floor(Math.random() * samples.length)]
      : notifSettings.reminders[0];

    const testId = `test-${Date.now()}`;

    sendNativeNotification(`${sample.icon} ${sample.label}`, sample.description, sample.id);

    addHistoryEntry({
      id: testId,
      reminderId: sample.id,
      icon: sample.icon,
      label: sample.label,
      description: sample.description,
      scheduledTime: hhmm,
      firedAt: now.toISOString(),
      missed: false,
      read: false,
    });
  }, [notifSettings, addHistoryEntry]);

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

  const clearPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  const todayStr = toISODate(new Date());
  const unreadNotifs = useMemo(() => {
    const all = notifHistory
      .filter((e) => !e.read && (e.firedAt.slice(0, 10) === todayStr || e.missed))
      .sort((a, b) => b.firedAt.localeCompare(a.firedAt));
    // Deduplicate missed: keep only the most recent per reminderId
    const seenMissed = new Set<string>();
    const result: NotificationHistoryEntry[] = [];
    for (const e of all) {
      if (e.missed) {
        if (seenMissed.has(e.reminderId)) continue;
        seenMissed.add(e.reminderId);
      }
      result.push(e);
    }
    return result;
  }, [notifHistory, todayStr]);
  const hasUnreadNotifs = unreadNotifs.length > 0;
  const unreadCount = unreadNotifs.length;

  useEffect(() => {
    updateBadgeCount(unreadCount).catch(() => {});
  }, [unreadCount]);

  return {
    notifSettings,
    setNotifSettings,
    notifHistory,
    notifCenterOpen,
    setNotifCenterOpen,
    handleTestNotification,
    handleDismissNotif,
    handleDismissAll,
    hasUnreadNotifs,
    unreadCount,
    pendingNavigation,
    clearPendingNavigation,
  };
}
