import { useState } from "react";
import styles from "./Sidebar.module.css";
import type { SidebarPage } from "../types";

const navItems = [
  { icon: "📅", label: "Planning", id: "planning" },
  { icon: "✓", label: "Tâches", id: "tasks" },
  { icon: "👤", label: "Personnes", id: "people" },
  { icon: "◈", label: "Projets", id: "projects" },
];

interface SidebarProps {
  activePage: SidebarPage;
  onPageChange: (page: SidebarPage) => void;
}

function IntegrationsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export default function Sidebar({ activePage, onPageChange }: SidebarProps) {
  const [activeNav, setActiveNav] = useState("planning");

  const handleNavClick = (id: string) => {
    setActiveNav(id);
    onPageChange("main");
  };

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>f.</div>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.icon} ${activePage === "main" && activeNav === item.id ? styles.active : ""}`}
          onClick={() => handleNavClick(item.id)}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
      <div className={styles.spacer} />
      <button
        className={`${styles.icon} ${activePage === "integrations" ? styles.active : ""}`}
        onClick={() => onPageChange("integrations")}
        title="Intégrations"
      >
        <IntegrationsIcon />
      </button>
      <button className={styles.icon} title="Paramètres">⚙</button>
    </nav>
  );
}
