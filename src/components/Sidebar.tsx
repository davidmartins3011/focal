import styles from "./Sidebar.module.css";
import type { SidebarPage } from "../types";
import {
  TasksIcon,
  CalendarIcon,
  SettingsIcon,
  UserIcon,
  IntegrationsIcon,
} from "./icons";

interface SidebarProps {
  activePage: SidebarPage;
  onPageChange: (page: SidebarPage) => void;
}

export default function Sidebar({ activePage, onPageChange }: SidebarProps) {
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
        className={`${styles.icon} ${activePage === "calendar" ? styles.active : ""}`}
        onClick={() => onPageChange("calendar")}
        title="Calendrier"
      >
        <CalendarIcon />
      </button>

      <div className={styles.spacer} />

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
