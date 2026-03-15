import { invoke } from "@tauri-apps/api/core";

export function checkAndRunAnalysis(): Promise<boolean> {
  return invoke<boolean>("check_and_run_analysis");
}

export function runAnalysisNow(): Promise<boolean> {
  return invoke<boolean>("run_analysis_now");
}
