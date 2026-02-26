import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import MainPanel from "./components/MainPanel";
import ChatPanel from "./components/ChatPanel";
import CalendarView from "./components/CalendarView";
import IntegrationsView from "./components/IntegrationsView";
import ProfileView from "./components/ProfileView";
import SettingsView from "./components/SettingsView";
import type { ViewTab, SidebarPage, ThemeId, AISettings } from "./types";
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [activePage, setActivePage] = useState<SidebarPage>("main");
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const [aiSettings, setAISettings] = useState<AISettings>(getStoredAISettings);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("focal-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("focal-ai-settings", JSON.stringify(aiSettings));
  }, [aiSettings]);

  const renderPage = () => {
    switch (activePage) {
      case "settings":
        return (
          <SettingsView
            currentTheme={theme}
            onThemeChange={setTheme}
            aiSettings={aiSettings}
            onAISettingsChange={setAISettings}
          />
        );
      case "calendar":
        return <CalendarView />;
      case "integrations":
        return <IntegrationsView />;
      case "profile":
        return <ProfileView />;
      default:
        return <MainPanel activeTab={activeTab} onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className={styles.app}>
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <Sidebar activePage={activePage} onPageChange={setActivePage} />
          {renderPage()}
        </div>
      </div>
      <div className={styles.right}>
        <ChatPanel />
      </div>
    </div>
  );
}
