import { useMemo } from "react";
import TodayView from "./TodayView";
import WeekView from "./WeekView";
import StrategyView from "./StrategyView";
import { getISOWeekNumber } from "../utils/dateFormat";
import type { ViewTab, StrategyFrequency } from "../types";
import styles from "./MainPanel.module.css";

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTH_SHORT = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

interface Props {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  dailyPriorityCount: number;
  strategyFrequency: StrategyFrequency;
  strategyCycleStart: number;
  onLaunchDailyPrep?: () => void;
  taskRefreshKey?: number;
}

const tabs: { id: ViewTab; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "Cette semaine" },
  { id: "strategy", label: "Prise de recul" },
];

export default function MainPanel({ activeTab, onTabChange, dailyPriorityCount, strategyFrequency, strategyCycleStart, onLaunchDailyPrep, taskRefreshKey }: Props) {
  const { dayName, dayNum, monthShort, weekNum } = useMemo(() => {
    const now = new Date();
    return {
      dayName: DAY_NAMES[now.getDay()],
      dayNum: now.getDate(),
      monthShort: MONTH_SHORT[now.getMonth()],
      weekNum: getISOWeekNumber(now),
    };
  }, []);

  return (
    <div className={styles.main}>
      <div className={styles.header}>
        <div className={styles.dateDisplay}>
          <h1>{dayName} {dayNum} {monthShort}</h1>
          <p>Semaine {weekNum}</p>
        </div>
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
        {activeTab === "today" && <TodayView dailyPriorityCount={dailyPriorityCount} onLaunchDailyPrep={onLaunchDailyPrep} refreshKey={taskRefreshKey} />}
        {activeTab === "week" && <WeekView />}
        {activeTab === "strategy" && (
          <StrategyView frequency={strategyFrequency} cycleStart={strategyCycleStart} />
        )}
      </div>
    </div>
  );
}
