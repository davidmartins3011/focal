import { useState, useEffect, useCallback, useMemo } from "react";
import type { StrategyGoal } from "../types";
import { getStrategyGoals, getStrategyPeriods } from "../services/reviews";

export interface StrategyInfo {
  strategyId: string;
  strategyTitle: string;
  objectiveId: string;
  objectiveTitle: string;
}

export interface PickerObjective {
  id: string;
  title: string;
  strategies: { id: string; title: string }[];
}

async function loadActiveGoals(): Promise<StrategyGoal[]> {
  const periods = await getStrategyPeriods();
  const active = periods.find((p) => p.status === "active");
  return getStrategyGoals(active?.id);
}

export default function useStrategies() {
  const [goals, setGoals] = useState<StrategyGoal[]>([]);
  const [allGoals, setAllGoals] = useState<StrategyGoal[]>([]);

  const fetchAll = useCallback(() => {
    loadActiveGoals()
      .then((g) => setGoals(g))
      .catch((err) => console.error("[useStrategies] loadActiveGoals error:", err));
    getStrategyGoals()
      .then((g) => setAllGoals(g))
      .catch((err) => console.error("[useStrategies] getStrategyGoals error:", err));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pickerObjectives = useMemo<PickerObjective[]>(() => {
    const result: PickerObjective[] = [];
    for (const goal of goals) {
      for (const objective of goal.strategies) {
        result.push({
          id: objective.id,
          title: objective.title,
          strategies: objective.tactics.map((t) => ({ id: t.id, title: t.title })),
        });
      }
    }
    return result;
  }, [goals]);

  const strategyMap = useMemo(() => {
    const map = new Map<string, StrategyInfo>();
    for (const goal of allGoals) {
      for (const objective of goal.strategies) {
        map.set(objective.id, {
          strategyId: objective.id,
          strategyTitle: objective.title,
          objectiveId: objective.id,
          objectiveTitle: objective.title,
        });
        for (const strategy of objective.tactics) {
          map.set(strategy.id, {
            strategyId: strategy.id,
            strategyTitle: strategy.title,
            objectiveId: objective.id,
            objectiveTitle: objective.title,
          });
        }
      }
    }
    return map;
  }, [allGoals]);

  const getStrategyInfo = useCallback(
    (strategyId: string | undefined): StrategyInfo | undefined => {
      if (!strategyId) return undefined;
      return strategyMap.get(strategyId);
    },
    [strategyMap],
  );

  return { pickerObjectives, getStrategyInfo, reload: fetchAll };
}
