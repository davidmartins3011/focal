import TodayView from "./TodayView";
import WeekView from "./WeekView";
import ReviewView from "./ReviewView";
import type { ViewTab } from "../types";
import styles from "./MainPanel.module.css";

interface Props {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

const tabs: { id: ViewTab; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "Cette semaine" },
  { id: "review", label: "Revue" },
];

export default function MainPanel({ activeTab, onTabChange }: Props) {
  return (
    <div className={styles.main}>
      <div className={styles.header}>
        <div className={styles.dateDisplay}>
          <h1>Mercredi 25 fév.</h1>
          <p>Semaine 9 · 4 tâches restantes</p>
        </div>
        <div className={styles.streak}>🔥 5j de suite</div>
      </div>

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === "today" && <TodayView />}
        {activeTab === "week" && <WeekView />}
        {activeTab === "review" && <ReviewView />}
      </div>
    </div>
  );
}
