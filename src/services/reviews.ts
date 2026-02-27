import { invoke } from "@tauri-apps/api/core";
import type { StrategyReview } from "../types";

export function getStrategyReviews(): Promise<StrategyReview[]> {
  return invoke<StrategyReview[]>("get_strategy_reviews");
}
