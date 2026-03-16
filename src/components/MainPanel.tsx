import { useState, useEffect, useMemo, useCallback } from "react";
import TodayView from "./TodayView";
import WeekView from "./WeekView";
import StrategyView from "./StrategyView";
import { getISOWeekNumber, getNextDay, dayClosedKey, weekClosedKey, getNextMonday, getMondayISO, toISODate } from "../utils/dateFormat";
import { getSetting } from "../services/settings";
import type { ViewTab, StrategyFrequency, WeekDayId } from "../types";
import styles from "./MainPanel.module.css";

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTH_SHORT = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

interface Props {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  dailyPriorityCount: number;
  strategyEnabled: boolean;
  strategyFrequency: StrategyFrequency;
  strategyCycleStart: number;
  onLaunchDailyPrep?: () => void;
  onLaunchWeeklyPrep?: () => void;
  onLaunchPeriodPrep?: (periodId: string) => void;
  onStuck?: (taskId: string, taskName: string) => void;
  taskRefreshKey?: number;
  strategyRefreshKey?: number;
  workingDays?: WeekDayId[];
}

const STATIC_TABS: { id: ViewTab; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "Cette semaine" },
  { id: "strategy", label: "Prise de recul" },
];

export default function MainPanel({ activeTab, onTabChange, dailyPriorityCount, strategyEnabled, strategyFrequency, strategyCycleStart, onLaunchDailyPrep, onLaunchWeeklyPrep, onLaunchPeriodPrep, onStuck, taskRefreshKey, strategyRefreshKey, workingDays }: Props) {
  const [dayClosed, setDayClosed] = useState(false);
  const [weekClosed, setWeekClosed] = useState(false);

  const today = useMemo(() => toISODate(new Date()), []);
  const tomorrowDate = useMemo(() => getNextDay(today), [today]);
  const currentMonday = useMemo(() => getMondayISO(new Date()), []);
  const nextMondayDate = useMemo(() => getNextMonday(currentMonday), [currentMonday]);

  useEffect(() => {
    getSetting(dayClosedKey(today))
      .then((val) => setDayClosed(val === "true"))
      .catch(() => {});
    getSetting(weekClosedKey(currentMonday))
      .then((val) => setWeekClosed(val === "true"))
      .catch(() => {});
  }, [today, currentMonday, taskRefreshKey]);

  const handleDayCompleted = useCallback(() => {
    setDayClosed(true);
    onTabChange("tomorrow");
  }, [onTabChange]);

  const handleDayReopened = useCallback(() => {
    setDayClosed(false);
    onTabChange("today");
  }, [onTabChange]);

  const handleWeekCompleted = useCallback(() => {
    setWeekClosed(true);
    onTabChange("next-week");
  }, [onTabChange]);

  const handleWeekReopened = useCallback(() => {
    setWeekClosed(false);
    onTabChange("week");
  }, [onTabChange]);

  const { dayName, dayNum, monthShort, weekNum } = useMemo(() => {
    const now = new Date();
    return {
      dayName: DAY_NAMES[now.getDay()],
      dayNum: now.getDate(),
      monthShort: MONTH_SHORT[now.getMonth()],
      weekNum: getISOWeekNumber(now),
    };
  }, []);

  const tabs = useMemo(
    () => {
      const base = STATIC_TABS.filter((t) => t.id !== "strategy" || strategyEnabled);
      if (dayClosed) {
        const todayIdx = base.findIndex((t) => t.id === "today");
        base.splice(todayIdx + 1, 0, { id: "tomorrow", label: "Demain" });
      }
      if (weekClosed) {
        const weekIdx = base.findIndex((t) => t.id === "week");
        base.splice(weekIdx + 1, 0, { id: "next-week", label: "Semaine prochaine" });
      }
      return base;
    },
    [strategyEnabled, dayClosed, weekClosed],
  );

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
        {activeTab === "today" && (
          <TodayView
            dailyPriorityCount={dailyPriorityCount}
            onLaunchDailyPrep={onLaunchDailyPrep}
            onStuck={onStuck}
            refreshKey={taskRefreshKey}
            isDayCompleted={dayClosed}
            onDayCompleted={handleDayCompleted}
            onDayReopened={handleDayReopened}
          />
        )}
        {activeTab === "tomorrow" && dayClosed && (
          <TodayView
            dailyPriorityCount={dailyPriorityCount}
            onStuck={onStuck}
            refreshKey={taskRefreshKey}
            viewDate={tomorrowDate}
            isPlanning
          />
        )}
        {activeTab === "week" && (
          <WeekView
            onLaunchWeeklyPrep={onLaunchWeeklyPrep}
            onStuck={onStuck}
            refreshKey={taskRefreshKey}
            workingDays={workingDays}
            dailyPriorityCount={dailyPriorityCount}
            isWeekCompleted={weekClosed}
            onWeekCompleted={handleWeekCompleted}
            onWeekReopened={handleWeekReopened}
          />
        )}
        {activeTab === "next-week" && weekClosed && (
          <WeekView
            onStuck={onStuck}
            refreshKey={taskRefreshKey}
            workingDays={workingDays}
            dailyPriorityCount={dailyPriorityCount}
            viewMonday={nextMondayDate}
            isPlanning
          />
        )}
        {activeTab === "strategy" && (
          <StrategyView frequency={strategyFrequency} cycleStart={strategyCycleStart} onLaunchPeriodPrep={onLaunchPeriodPrep} refreshKey={strategyRefreshKey} />
        )}
      </div>
    </div>
  );
}
