import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "./components/Sidebar";
import MainPanel from "./components/MainPanel";
import ChatPanel from "./components/ChatPanel";
import CalendarView from "./components/CalendarView";
import IntegrationsView from "./components/IntegrationsView";
import ProfileView from "./components/ProfileView";
import SettingsView from "./components/SettingsView";
import NotificationToast from "./components/NotificationToast";
import NotificationCenter from "./components/NotificationCenter";
import type { ToastData } from "./components/NotificationToast";
import type {
  ViewTab, SidebarPage, ThemeId, AISettings,
  NotificationSettings, NotificationHistoryEntry, WeekDayId,
} from "./types";
import { defaultReminders } from "./data/mockSettings";
import styles from "./App.module.css";

function getStoredTheme(): ThemeId {
  const stored = localStorage.getItem("focal-theme");
  if (stored && ["default", "clair", "sombre", "zen", "hyperfocus", "aurore", "ocean", "sakura", "nord", "solaire"].includes(stored)) {
    return stored as ThemeId;
  }
  return "default";
}

const defaultAISettings: AISettings = {
  providers: [
    { id: "openai", enabled: false, apiKey: "" },
    { id: "anthropic", enabled: false, apiKey: "" },
    { id: "mistral", enabled: false, apiKey: "" },
  ],
};

function getStoredAISettings(): AISettings {
  try {
    const stored = localStorage.getItem("focal-ai-settings");
    if (stored) {
      const parsed = JSON.parse(stored) as AISettings;
      if (parsed.providers?.length) return parsed;
    }
  } catch { /* ignore */ }
  return defaultAISettings;
}

const DEFAULT_DAILY_PRIORITY_COUNT = 3;

function getStoredDailyPriorityCount(): number {
  const stored = localStorage.getItem("focal-daily-priority-count");
  if (stored) {
    const n = parseInt(stored, 10);
    if (n >= 1 && n <= 7) return n;
  }
  return DEFAULT_DAILY_PRIORITY_COUNT;
}

const defaultNotifSettings: NotificationSettings = {
  enabled: true,
  reminders: defaultReminders,
};

function getStoredNotifSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem("focal-notif-settings");
    if (stored) {
      const parsed = JSON.parse(stored) as NotificationSettings;
      if (parsed.reminders?.length) {
        const storedIds = new Set(parsed.reminders.map((r) => r.id));
        const missing = defaultReminders.filter((r) => !storedIds.has(r.id));
        if (missing.length > 0) {
          parsed.reminders = [...parsed.reminders, ...missing];
        }
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return defaultNotifSettings;
}

const JS_DAY_TO_WEEKDAY: Record<number, WeekDayId> = {
  0: "dim", 1: "lun", 2: "mar", 3: "mer", 4: "jeu", 5: "ven", 6: "sam",
};

function getStoredHistory(): NotificationHistoryEntry[] {
  try {
    const stored = localStorage.getItem("focal-notif-history");
    if (stored) return JSON.parse(stored) as NotificationHistoryEntry[];
  } catch { /* ignore */ }
  return [];
}

function getLastActiveTimestamp(): string | null {
  return localStorage.getItem("focal-last-active");
}

function saveLastActiveTimestamp() {
  localStorage.setItem("focal-last-active", new Date().toISOString());
}

function detectMissedNotifications(
  settings: NotificationSettings,
  existingHistory: NotificationHistoryEntry[],
): NotificationHistoryEntry[] {
  if (!settings.enabled) return [];

  const lastActive = getLastActiveTimestamp();
  if (!lastActive) return [];

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

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [activePage, setActivePage] = useState<SidebarPage>("main");
  const [intResetKey, setIntResetKey] = useState(0);

  const handlePageChange = (page: SidebarPage) => {
    if (page === "integrations") {
      setIntResetKey((k) => k + 1);
    }
    setActivePage(page);
  };
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const [aiSettings, setAISettings] = useState<AISettings>(getStoredAISettings);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(getStoredNotifSettings);
  const [dailyPriorityCount, setDailyPriorityCount] = useState<number>(getStoredDailyPriorityCount);
  const [notifHistory, setNotifHistory] = useState<NotificationHistoryEntry[]>(getStoredHistory);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("focal-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("focal-ai-settings", JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    localStorage.setItem("focal-notif-settings", JSON.stringify(notifSettings));
  }, [notifSettings]);

  useEffect(() => {
    localStorage.setItem("focal-daily-priority-count", String(dailyPriorityCount));
  }, [dailyPriorityCount]);

  useEffect(() => {
    localStorage.setItem("focal-notif-history", JSON.stringify(notifHistory));
  }, [notifHistory]);

  // Detect missed notifications on mount
  useEffect(() => {
    const missed = detectMissedNotifications(notifSettings, notifHistory);
    if (missed.length > 0) {
      setNotifHistory((prev) => [...prev, ...missed]);
      setNotifCenterOpen(true);
    }
    saveLastActiveTimestamp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodically save "last active" timestamp
  useEffect(() => {
    const interval = setInterval(saveLastActiveTimestamp, 60_000);
    const handleBeforeUnload = () => saveLastActiveTimestamp();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const addHistoryEntry = useCallback((entry: NotificationHistoryEntry) => {
    setNotifHistory((prev) => [...prev, entry]);
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
  }, []);

  const handleDismissAll = useCallback(() => {
    setNotifHistory((prev) => prev.map((e) => ({ ...e, read: true })));
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const hasUnreadNotifs = notifHistory.some(
    (e) => !e.read && e.firedAt.slice(0, 10) === todayStr
  );

  const renderPage = () => {
    switch (activePage) {
      case "settings":
        return (
          <SettingsView
            currentTheme={theme}
            onThemeChange={setTheme}
            aiSettings={aiSettings}
            onAISettingsChange={setAISettings}
            notifSettings={notifSettings}
            onNotifSettingsChange={setNotifSettings}
            onTestNotification={handleTestNotification}
            dailyPriorityCount={dailyPriorityCount}
            onDailyPriorityCountChange={setDailyPriorityCount}
          />
        );
      case "calendar":
        return <CalendarView />;
      case "integrations":
        return <IntegrationsView resetSignal={intResetKey} />;
      case "profile":
        return <ProfileView />;
      default:
        return <MainPanel activeTab={activeTab} onTabChange={setActiveTab} dailyPriorityCount={dailyPriorityCount} />;
    }
  };

  return (
    <div className={styles.app}>
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <Sidebar
            activePage={activePage}
            onPageChange={handlePageChange}
            hasUnreadNotifs={hasUnreadNotifs}
            onToggleNotifCenter={() => setNotifCenterOpen((v) => !v)}
            notifCenterOpen={notifCenterOpen}
          />
          {renderPage()}
        </div>
      </div>
      <div className={styles.right}>
        <ChatPanel />
      </div>
      <NotificationToast
        toasts={toasts}
        onDismiss={dismissToast}
      />
      {notifCenterOpen && (
        <NotificationCenter
          history={notifHistory}
          onDismiss={handleDismissNotif}
          onDismissAll={handleDismissAll}
          onClose={() => setNotifCenterOpen(false)}
        />
      )}
    </div>
  );
}
