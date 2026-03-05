import { invoke } from "@tauri-apps/api/core";
import type { MemoryInsight } from "../types";

export function getMemoryInsights(): Promise<MemoryInsight[]> {
  return invoke<MemoryInsight[]>("get_memory_insights");
}

export function deleteMemoryInsight(id: string): Promise<void> {
  return invoke<void>("delete_memory_insight", { id });
}

export function checkAndRunAnalysis(): Promise<boolean> {
  return invoke<boolean>("check_and_run_analysis");
}

export function runAnalysisNow(): Promise<boolean> {
  return invoke<boolean>("run_analysis_now");
}
