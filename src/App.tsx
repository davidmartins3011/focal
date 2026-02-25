import { useState } from "react";
import Sidebar from "./components/Sidebar";
import MainPanel from "./components/MainPanel";
import ChatPanel from "./components/ChatPanel";
import IntegrationsView from "./components/IntegrationsView";
import type { ViewTab, SidebarPage } from "./types";
import styles from "./App.module.css";

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [activePage, setActivePage] = useState<SidebarPage>("main");

  return (
    <div className={styles.app}>
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <Sidebar activePage={activePage} onPageChange={setActivePage} />
          {activePage === "main" ? (
            <MainPanel activeTab={activeTab} onTabChange={setActiveTab} />
          ) : (
            <IntegrationsView />
          )}
        </div>
      </div>
      <div className={styles.right}>
        <ChatPanel />
      </div>
    </div>
  );
}
