import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "./components/Sidebar";
import MainPanel from "./components/MainPanel";
import ChatPanel from "./components/ChatPanel";
import IntegrationsView from "./components/IntegrationsView";
import ProfileView from "./components/ProfileView";
import SuggestionsView from "./components/SuggestionsView";
import ToolboxView from "./components/ToolboxView";
import TodoView from "./components/TodoView";
import SettingsView from "./components/SettingsView";
import OnboardingView from "./components/OnboardingView";
import NotificationCenter from "./components/NotificationCenter";
import UpdateNotification from "./components/UpdateNotification";
import type { ViewTab, SidebarPage, ThemeId, AISettings, StrategyFrequency, FrequencyOccurrence, WeekDayId } from "./types";
import { useNotifications } from "./hooks/useNotifications";
import { getAllSettings, setSetting } from "./services/settings";
import { checkAndRunAnalysis } from "./services/memory";
import { checkAndRunSuggestions } from "./services/chat";
import styles from "./App.module.css";

const VALID_THEMES: ThemeId[] = ["default", "clair", "sombre", "zen", "hyperfocus", "aurore", "ocean", "sakura", "nord", "solaire"];
const VALID_STRATEGY_FREQS: StrategyFrequency[] = ["monthly", "bimonthly", "quarterly", "biannual"];
const VALID_OCCURRENCES: FrequencyOccurrence[] = ["1st", "2nd", "3rd", "4th", "last"];
const VALID_DAYS: WeekDayId[] = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

const defaultAISettings: AISettings = {
  providers: [
    { id: "openai", enabled: false, apiKey: "" },
    { id: "anthropic", enabled: false, apiKey: "" },
    { id: "mistral", enabled: false, apiKey: "" },
  ],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [activePage, setActivePage] = useState<SidebarPage>("main");
  const [intResetKey, setIntResetKey] = useState(0);
  const [theme, setTheme] = useState<ThemeId>("default");
  const [aiSettings, setAISettings] = useState<AISettings>(defaultAISettings);
  const [dailyPriorityCount, setDailyPriorityCount] = useState<number>(3);
  const [strategyEnabled, setStrategyEnabled] = useState<boolean>(true);
  const [strategyFrequency, setStrategyFrequency] = useState<StrategyFrequency>("monthly");
  const [strategyCycleStart, setStrategyCycleStart] = useState<number>(1);
  const [strategyOccurrence, setStrategyOccurrence] = useState<FrequencyOccurrence>("last");
  const [strategyDay, setStrategyDay] = useState<WeekDayId>("dim");
  const [workingDays, setWorkingDays] = useState<WeekDayId[]>(["lun", "mar", "mer", "jeu", "ven"]);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [dailyPrepPending, setDailyPrepPending] = useState(false);
  const [weeklyPrepPending, setWeeklyPrepPending] = useState(false);
  const [periodPrepPending, setPeriodPrepPending] = useState<{ periodId: string } | null>(null);
  const [stuckTask, setStuckTask] = useState<{ taskId: string; taskName: string } | null>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [strategyRefreshKey, setStrategyRefreshKey] = useState(0);
  const loaded = useRef(false);

  const notif = useNotifications(workingDays);

  useEffect(() => {
    getAllSettings()
      .then((s) => {
        if (s.theme && VALID_THEMES.includes(s.theme as ThemeId))
          setTheme(s.theme as ThemeId);
        if (s["ai-settings"]) {
          try {
            const p = JSON.parse(s["ai-settings"]) as AISettings;
            if (p.providers?.length) {
              p.providers = p.providers.map((prov) => ({
                ...prov,
                keyStatus: prov.keyStatus === "validating" ? "untested" : prov.keyStatus,
              }));
              setAISettings(p);
            }
          } catch { /* ignore */ }
        }
        if (s["daily-priority-count"]) {
          const n = parseInt(s["daily-priority-count"], 10);
          if (n >= 1 && n <= 7) setDailyPriorityCount(n);
        }
        if (s["strategy-enabled"] !== undefined)
          setStrategyEnabled(s["strategy-enabled"] !== "false");
        if (s["strategy-frequency"] && VALID_STRATEGY_FREQS.includes(s["strategy-frequency"] as StrategyFrequency))
          setStrategyFrequency(s["strategy-frequency"] as StrategyFrequency);
        if (s["strategy-cycle-start"]) {
          const n = parseInt(s["strategy-cycle-start"], 10);
          if (n >= 1 && n <= 12) setStrategyCycleStart(n);
        }
        if (s["strategy-occurrence"] && VALID_OCCURRENCES.includes(s["strategy-occurrence"] as FrequencyOccurrence))
          setStrategyOccurrence(s["strategy-occurrence"] as FrequencyOccurrence);
        if (s["strategy-day"] && VALID_DAYS.includes(s["strategy-day"] as WeekDayId))
          setStrategyDay(s["strategy-day"] as WeekDayId);
        if (s["working-days"]) {
          try {
            const parsed = JSON.parse(s["working-days"]) as WeekDayId[];
            if (Array.isArray(parsed) && parsed.every((d) => VALID_DAYS.includes(d)))
              setWorkingDays(parsed);
          } catch { /* ignore */ }
        }
        if (s["onboarding-completed"] === "true") {
          setOnboardingDone(true);
        } else {
          let isExistingUser = false;
          if (s["ai-settings"]) {
            try {
              const parsed = JSON.parse(s["ai-settings"]) as AISettings;
              isExistingUser = parsed.providers?.some((prov) => prov.enabled && prov.apiKey) ?? false;
            } catch { /* ignore */ }
          }
          setOnboardingDone(isExistingUser);
        }
        loaded.current = true;
      })
      .catch((err) => {
        console.error("[App] getAllSettings error:", err);
        setOnboardingDone(true);
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    checkAndRunAnalysis().catch(() => {});
    checkAndRunSuggestions().catch(() => {});

    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      checkAndRunAnalysis().catch(() => {});
      checkAndRunSuggestions().catch(() => {});
      interval = setInterval(() => {
        checkAndRunAnalysis().catch(() => {});
        checkAndRunSuggestions().catch(() => {});
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  const handlePageChange = (page: SidebarPage) => {
    if (page === "integrations") {
      setIntResetKey((k) => k + 1);
    }
    setActivePage(page);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (loaded.current) setSetting("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (loaded.current) setSetting("ai-settings", JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    if (loaded.current) setSetting("daily-priority-count", String(dailyPriorityCount));
  }, [dailyPriorityCount]);

  useEffect(() => {
    if (loaded.current) setSetting("strategy-enabled", String(strategyEnabled));
    if (!strategyEnabled && activeTab === "strategy") setActiveTab("today");
  }, [strategyEnabled]);

  useEffect(() => {
    if (loaded.current) setSetting("strategy-frequency", strategyFrequency);
  }, [strategyFrequency]);

  useEffect(() => {
    if (loaded.current) setSetting("strategy-cycle-start", String(strategyCycleStart));
  }, [strategyCycleStart]);

  useEffect(() => {
    if (loaded.current) setSetting("strategy-occurrence", strategyOccurrence);
  }, [strategyOccurrence]);

  useEffect(() => {
    if (loaded.current) setSetting("strategy-day", strategyDay);
  }, [strategyDay]);

  useEffect(() => {
    if (loaded.current) setSetting("working-days", JSON.stringify(workingDays));
  }, [workingDays]);

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


  const navigateToReminder = useCallback((reminderId: string) => {
    switch (reminderId) {
      case "morning-plan":
        setActivePage("main");
        setActiveTab("today");
        setDailyPrepPending(true);
        break;
      case "focus-checkin":
      case "lunch-break":
      case "afternoon-boost":
        setActivePage("main");
        setActiveTab("today");
        break;
      case "daily-review":
        setActivePage("main");
        setActiveTab("today");
        break;
      case "weekly-prep":
        setActivePage("main");
        setActiveTab("week");
        setWeeklyPrepPending(true);
        break;
      case "weekly-review":
        setActivePage("main");
        setActiveTab("week");
        break;
      case "strategy-review": {
        setActivePage("main");
        setActiveTab("strategy");
        const pid = localStorage.getItem("focal-active-period-id");
        if (pid) setPeriodPrepPending({ periodId: pid });
        break;
      }
      default:
        setActivePage("main");
        setActiveTab("today");
    }
    notif.setNotifCenterOpen(false);
  }, [notif]);

  useEffect(() => {
    if (notif.pendingNavigation) {
      navigateToReminder(notif.pendingNavigation);
      notif.clearPendingNavigation();
    }
  }, [notif.pendingNavigation, navigateToReminder, notif]);

  const handleStartOnboarding = useCallback(() => {
    setSetting("onboarding-completed", "false").catch(() => {});
    setOnboardingDone(false);
  }, []);

  const handleLaunchDailyPrep = useCallback(() => {
    setDailyPrepPending(true);
  }, []);

  const handleLaunchWeeklyPrep = useCallback(() => {
    setWeeklyPrepPending(true);
  }, []);

  const handleLaunchPeriodPrep = useCallback((periodId: string) => {
    setPeriodPrepPending({ periodId });
  }, []);

  const handleStuck = useCallback((taskId: string, taskName: string) => {
    setStuckTask({ taskId, taskName });
  }, []);

  const handleTasksChanged = useCallback(() => {
    setTaskRefreshKey((k) => k + 1);
  }, []);

  const handleStrategyChanged = useCallback(() => {
    setStrategyRefreshKey((k) => k + 1);
  }, []);

  const handleViewSwitch = useCallback((tab: "today" | "tomorrow" | "week" | "next-week" | "strategy") => {
    setActiveTab(tab as ViewTab);
    setActivePage("main");
  }, []);

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
            strategyEnabled={strategyEnabled}
            onStrategyEnabledChange={setStrategyEnabled}
            strategyFrequency={strategyFrequency}
            onStrategyFrequencyChange={handleStrategyFrequencyChange}
            strategyCycleStart={strategyCycleStart}
            onStrategyCycleStartChange={handleStrategyCycleStartChange}
            workingDays={workingDays}
            onWorkingDaysChange={setWorkingDays}
          />
        );
      case "suggestions":
        return <SuggestionsView />;
      case "toolbox":
        return <ToolboxView />;
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
            strategyEnabled={strategyEnabled}
            strategyFrequency={strategyFrequency}
            strategyCycleStart={strategyCycleStart}
            onLaunchDailyPrep={handleLaunchDailyPrep}
            onLaunchWeeklyPrep={handleLaunchWeeklyPrep}
            onLaunchPeriodPrep={handleLaunchPeriodPrep}
            onStuck={handleStuck}
            taskRefreshKey={taskRefreshKey}
            strategyRefreshKey={strategyRefreshKey}
            workingDays={workingDays}
          />
        );
    }
  };

  if (onboardingDone === null) {
    return null;
  }

  if (!onboardingDone) {
    return (
      <OnboardingView
        currentTheme={theme}
        onThemeChange={setTheme}
        aiSettings={aiSettings}
        onAISettingsChange={setAISettings}
        onComplete={() => setOnboardingDone(true)}
      />
    );
  }

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
        <ChatPanel
          onStartOnboarding={handleStartOnboarding}
          dailyPrepPending={dailyPrepPending}
          onDailyPrepConsumed={() => setDailyPrepPending(false)}
          weeklyPrepPending={weeklyPrepPending}
          onWeeklyPrepConsumed={() => setWeeklyPrepPending(false)}
          periodPrepPending={periodPrepPending}
          onPeriodPrepConsumed={() => setPeriodPrepPending(null)}
          stuckTask={stuckTask}
          onStuckConsumed={() => setStuckTask(null)}
          onTasksChanged={handleTasksChanged}
          onStrategyChanged={handleStrategyChanged}
          onViewSwitch={handleViewSwitch}
        />
      </div>
      <UpdateNotification />
      {notif.notifCenterOpen && (
        <NotificationCenter
          history={notif.notifHistory}
          onDismiss={notif.handleDismissNotif}
          onDismissAll={notif.handleDismissAll}
          onClose={() => notif.setNotifCenterOpen(false)}
          onAction={navigateToReminder}
        />
      )}
    </div>
  );
}
