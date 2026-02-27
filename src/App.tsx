import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import MainPanel from "./components/MainPanel";
import ChatPanel from "./components/ChatPanel";
import CalendarView from "./components/CalendarView";
import IntegrationsView from "./components/IntegrationsView";
import ProfileView from "./components/ProfileView";
import SuggestionsView from "./components/SuggestionsView";
import TodoView from "./components/TodoView";
import SettingsView from "./components/SettingsView";
import NotificationToast from "./components/NotificationToast";
import NotificationCenter from "./components/NotificationCenter";
import type { ViewTab, SidebarPage, ThemeId, AISettings, StrategyFrequency, FrequencyOccurrence, WeekDayId } from "./types";
import { useNotifications } from "./hooks/useNotifications";
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

function getStoredDailyPriorityCount(): number {
  const stored = localStorage.getItem("focal-daily-priority-count");
  if (stored) {
    const n = parseInt(stored, 10);
    if (n >= 1 && n <= 7) return n;
  }
  return 3;
}

const VALID_STRATEGY_FREQS: StrategyFrequency[] = ["monthly", "bimonthly", "quarterly", "biannual"];

function getStoredStrategyFrequency(): StrategyFrequency {
  const stored = localStorage.getItem("focal-strategy-frequency");
  if (stored && VALID_STRATEGY_FREQS.includes(stored as StrategyFrequency)) {
    return stored as StrategyFrequency;
  }
  return "monthly";
}

function getStoredStrategyCycleStart(): number {
  const stored = localStorage.getItem("focal-strategy-cycle-start");
  if (stored) {
    const n = parseInt(stored, 10);
    if (n >= 1 && n <= 12) return n;
  }
  return 1;
}

const VALID_OCCURRENCES: FrequencyOccurrence[] = ["1st", "2nd", "3rd", "4th", "last"];
const VALID_DAYS: WeekDayId[] = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

function getStoredStrategyOccurrence(): FrequencyOccurrence {
  const stored = localStorage.getItem("focal-strategy-occurrence");
  if (stored && VALID_OCCURRENCES.includes(stored as FrequencyOccurrence)) {
    return stored as FrequencyOccurrence;
  }
  return "last";
}

function getStoredStrategyDay(): WeekDayId {
  const stored = localStorage.getItem("focal-strategy-day");
  if (stored && VALID_DAYS.includes(stored as WeekDayId)) {
    return stored as WeekDayId;
  }
  return "dim";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [activePage, setActivePage] = useState<SidebarPage>("main");
  const [intResetKey, setIntResetKey] = useState(0);
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const [aiSettings, setAISettings] = useState<AISettings>(getStoredAISettings);
  const [dailyPriorityCount, setDailyPriorityCount] = useState<number>(getStoredDailyPriorityCount);
  const [strategyFrequency, setStrategyFrequency] = useState<StrategyFrequency>(getStoredStrategyFrequency);
  const [strategyCycleStart, setStrategyCycleStart] = useState<number>(getStoredStrategyCycleStart);
  const [strategyOccurrence, setStrategyOccurrence] = useState<FrequencyOccurrence>(getStoredStrategyOccurrence);
  const [strategyDay, setStrategyDay] = useState<WeekDayId>(getStoredStrategyDay);

  const notif = useNotifications();

  const handlePageChange = (page: SidebarPage) => {
    if (page === "integrations") {
      setIntResetKey((k) => k + 1);
    }
    setActivePage(page);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("focal-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("focal-ai-settings", JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    localStorage.setItem("focal-daily-priority-count", String(dailyPriorityCount));
  }, [dailyPriorityCount]);

  useEffect(() => {
    localStorage.setItem("focal-strategy-frequency", strategyFrequency);
  }, [strategyFrequency]);

  useEffect(() => {
    localStorage.setItem("focal-strategy-cycle-start", String(strategyCycleStart));
  }, [strategyCycleStart]);

  useEffect(() => {
    localStorage.setItem("focal-strategy-occurrence", strategyOccurrence);
  }, [strategyOccurrence]);

  useEffect(() => {
    localStorage.setItem("focal-strategy-day", strategyDay);
  }, [strategyDay]);

  const handleStrategyFrequencyChange = useCallback((freq: StrategyFrequency) => {
    setStrategyFrequency(freq);
    notif.setNotifSettings((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === "strategy-review" ? { ...r, frequency: freq } : r
      ),
    }));
  }, [notif]);

  const handleStrategyCycleStartChange = useCallback((start: number) => {
    setStrategyCycleStart(start);
    notif.setNotifSettings((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === "strategy-review" ? { ...r, frequencyCycleStart: start } : r
      ),
    }));
  }, [notif]);

  const handleStrategyOccurrenceChange = useCallback((occ: FrequencyOccurrence) => {
    setStrategyOccurrence(occ);
    notif.setNotifSettings((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === "strategy-review" ? { ...r, frequencyOccurrence: occ } : r
      ),
    }));
  }, [notif]);

  const handleStrategyDayChange = useCallback((day: WeekDayId) => {
    setStrategyDay(day);
    notif.setNotifSettings((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === "strategy-review" ? { ...r, days: [day] } : r
      ),
    }));
  }, [notif]);

  const handleToastAction = useCallback((toastId: string) => {
    const toast = notif.toasts.find((t) => t.id === toastId);
    if (!toast?.reminderId) return;

    const rid = toast.reminderId;
    if (rid === "morning-plan") {
      setActivePage("main");
      setActiveTab("today");
    } else if (rid === "weekly-prep" || rid === "weekly-review") {
      setActivePage("main");
      setActiveTab("week");
    } else if (rid === "daily-review") {
      setActivePage("main");
      setActiveTab("today");
    } else if (rid === "strategy-review") {
      setActivePage("main");
      setActiveTab("strategy");
    }
  }, [notif.toasts]);

  const renderPage = () => {
    switch (activePage) {
      case "settings":
        return (
          <SettingsView
            currentTheme={theme}
            onThemeChange={setTheme}
            aiSettings={aiSettings}
            onAISettingsChange={setAISettings}
            notifSettings={notif.notifSettings}
            onNotifSettingsChange={notif.setNotifSettings}
            onTestNotification={notif.handleTestNotification}
            dailyPriorityCount={dailyPriorityCount}
            onDailyPriorityCountChange={setDailyPriorityCount}
            strategyFrequency={strategyFrequency}
            onStrategyFrequencyChange={handleStrategyFrequencyChange}
            strategyCycleStart={strategyCycleStart}
            onStrategyCycleStartChange={handleStrategyCycleStartChange}
            strategyOccurrence={strategyOccurrence}
            onStrategyOccurrenceChange={handleStrategyOccurrenceChange}
            strategyDay={strategyDay}
            onStrategyDayChange={handleStrategyDayChange}
          />
        );
      case "calendar":
        return <CalendarView />;
      case "suggestions":
        return <SuggestionsView />;
      case "todos":
        return <TodoView />;
      case "integrations":
        return <IntegrationsView resetSignal={intResetKey} />;
      case "profile":
        return <ProfileView />;
      default:
        return (
          <MainPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            dailyPriorityCount={dailyPriorityCount}
            strategyFrequency={strategyFrequency}
            strategyCycleStart={strategyCycleStart}
          />
        );
    }
  };

  return (
    <div className={styles.app}>
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <Sidebar
            activePage={activePage}
            onPageChange={handlePageChange}
            hasUnreadNotifs={notif.hasUnreadNotifs}
            onToggleNotifCenter={() => notif.setNotifCenterOpen((v) => !v)}
            notifCenterOpen={notif.notifCenterOpen}
          />
          {renderPage()}
        </div>
      </div>
      <div className={styles.right}>
        <ChatPanel />
      </div>
      <NotificationToast
        toasts={notif.toasts}
        onDismiss={notif.dismissToast}
        onAction={handleToastAction}
      />
      {notif.notifCenterOpen && (
        <NotificationCenter
          history={notif.notifHistory}
          onDismiss={notif.handleDismissNotif}
          onDismissAll={notif.handleDismissAll}
          onClose={() => notif.setNotifCenterOpen(false)}
        />
      )}
    </div>
  );
}
