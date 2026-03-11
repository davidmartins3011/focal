import { invoke } from "@tauri-apps/api/core";
import type { StrategyReview, StrategyGoal, PeriodSummary } from "../types";

export function getStrategyReviews(): Promise<StrategyReview[]> {
  return invoke<StrategyReview[]>("get_strategy_reviews");
}

export function getStrategyGoals(): Promise<StrategyGoal[]> {
  return invoke<StrategyGoal[]>("get_strategy_goals");
}

export function upsertStrategyGoal(params: {
  id: string;
  title: string;
  target: string;
  deadline?: string;
  position: number;
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
