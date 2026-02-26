import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import MainPanel from "./components/MainPanel";
import ChatPanel from "./components/ChatPanel";
import CalendarView from "./components/CalendarView";
import IntegrationsView from "./components/IntegrationsView";
import ProfileView from "./components/ProfileView";
import SettingsView from "./components/SettingsView";
import NotificationToast from "./components/NotificationToast";
import NotificationCenter from "./components/NotificationCenter";
import type { ViewTab, SidebarPage, ThemeId, AISettings } from "./types";
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [activePage, setActivePage] = useState<SidebarPage>("main");
  const [intResetKey, setIntResetKey] = useState(0);
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const [aiSettings, setAISettings] = useState<AISettings>(getStoredAISettings);
  const [dailyPriorityCount, setDailyPriorityCount] = useState<number>(getStoredDailyPriorityCount);

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
