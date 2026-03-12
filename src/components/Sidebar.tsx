import styles from "./Sidebar.module.css";
import type { SidebarPage } from "../types";
import {
  TasksIcon,
  SuggestionsIcon,
  TodoIcon,
  ToolboxIcon,
  SettingsIcon,
  UserIcon,
  IntegrationsIcon,
  BellIcon,
} from "./icons";

interface SidebarProps {
  activePage: SidebarPage;
  onPageChange: (page: SidebarPage) => void;
  hasUnreadNotifs: boolean;
  onToggleNotifCenter: () => void;
  notifCenterOpen: boolean;
}

export default function Sidebar({
  activePage,
  onPageChange,
  hasUnreadNotifs,
  onToggleNotifCenter,
  notifCenterOpen,
}: SidebarProps) {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>f.</div>

      <button
        className={`${styles.icon} ${activePage === "main" ? styles.active : ""}`}
        onClick={() => onPageChange("main")}
        title="Tâches"
      >
        <TasksIcon />
      </button>
      <button
        className={`${styles.icon} ${activePage === "todos" ? styles.active : ""}`}
        onClick={() => onPageChange("todos")}
        title="ToDo"
      >
        <TodoIcon />
      </button>
      <button
        className={`${styles.icon} ${activePage === "suggestions" ? styles.active : ""}`}
        onClick={() => onPageChange("suggestions")}
        title="Suggestions"
      >
        <SuggestionsIcon />
      </button>
      <button
        className={`${styles.icon} ${activePage === "toolbox" ? styles.active : ""}`}
        onClick={() => onPageChange("toolbox")}
        title="Boîte à outils"
      >
        <ToolboxIcon />
      </button>

      <div className={styles.spacer} />

      <button
        className={`${styles.icon} ${notifCenterOpen ? styles.active : ""}`}
        onClick={onToggleNotifCenter}
        title="Notifications"
      >
        <BellIcon />
        {hasUnreadNotifs && <span className={styles.dot} />}
      </button>
      <button
        className={`${styles.icon} ${activePage === "profile" ? styles.active : ""}`}
        onClick={() => onPageChange("profile")}
        title="Mon profil"
      >
        <UserIcon />
      </button>
      <button
        className={`${styles.icon} ${activePage === "integrations" ? styles.active : ""}`}
        onClick={() => onPageChange("integrations")}
        title="Intégrations"
      >
        <IntegrationsIcon />
      </button>
      <button
        className={`${styles.icon} ${activePage === "settings" ? styles.active : ""}`}
        onClick={() => onPageChange("settings")}
        title="Paramètres"
      >
        <SettingsIcon />
      </button>
    </nav>
  );
}
