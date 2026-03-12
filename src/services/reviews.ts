import { invoke } from "@tauri-apps/api/core";
import type { StrategyReview, StrategyGoal, StrategyPeriod, PeriodSummary } from "../types";

export function getStrategyReviews(): Promise<StrategyReview[]> {
  return invoke<StrategyReview[]>("get_strategy_reviews");
}

export function getStrategyPeriods(): Promise<StrategyPeriod[]> {
  return invoke<StrategyPeriod[]>("get_strategy_periods");
}

export function createStrategyPeriod(params: {
  id: string;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  frequency: string;
}): Promise<StrategyPeriod> {
  return invoke<StrategyPeriod>("create_strategy_period", params);
}

export function closeStrategyPeriod(id: string): Promise<void> {
  return invoke("close_strategy_period", { id });
}

export function upsertPeriodReflection(params: {
  id: string;
  periodId: string;
  prompt: string;
  answer: string;
  position: number;
}): Promise<void> {
  return invoke("upsert_period_reflection", params);
}

export function carryOverGoals(sourcePeriodId: string, targetPeriodId: string): Promise<void> {
  return invoke("carry_over_goals", { sourcePeriodId, targetPeriodId });
}

export function getStrategyGoals(periodId?: string): Promise<StrategyGoal[]> {
  return invoke<StrategyGoal[]>("get_strategy_goals", { periodId: periodId ?? null });
}

export function upsertStrategyGoal(params: {
  id: string;
  title: string;
  target: string;
  deadline?: string;
  position: number;
  periodId?: string;
}): Promise<void> {
  return invoke("upsert_strategy_goal", params);
}

export function deleteStrategyGoal(id: string): Promise<void> {
  return invoke("delete_strategy_goal", { id });
}

export function upsertStrategy(params: {
  id: string;
  goalId: string;
  title: string;
  description: string;
  position: number;
}): Promise<void> {
  return invoke("upsert_strategy", params);
}

export function deleteStrategy(id: string): Promise<void> {
  return invoke("delete_strategy", { id });
}

export function getGoalStrategyLinks(periodId?: string): Promise<{ goalId: string; strategyId: string }[]> {
  return invoke("get_goal_strategy_links", { periodId: periodId ?? null });
}

export function toggleGoalStrategyLink(goalId: string, strategyId: string): Promise<boolean> {
  return invoke("toggle_goal_strategy_link", { goalId, strategyId });
}

export function upsertTactic(params: {
  id: string;
  strategyId: string;
  title: string;
  description: string;
  position: number;
}): Promise<void> {
  return invoke("upsert_tactic", params);
}

export function deleteTactic(id: string): Promise<void> {
  return invoke("delete_tactic", { id });
}

export function upsertAction(params: {
  id: string;
  tacticId: string;
  text: string;
  position: number;
}): Promise<void> {
  return invoke("upsert_action", params);
}

export function deleteAction(id: string): Promise<void> {
  return invoke("delete_action", { id });
}

export function toggleAction(id: string): Promise<void> {
  return invoke("toggle_action", { id });
}

export function getPeriodSummary(startDate: string, endDate: string): Promise<PeriodSummary> {
  return invoke<PeriodSummary>("get_period_summary", { startDate, endDate });
}
