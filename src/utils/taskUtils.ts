import type { Task } from "../types";

export function sortOverdueTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aMain = a.priority === "main" ? 1 : 0;
    const bMain = b.priority === "main" ? 1 : 0;
    if (aMain !== bMain) return bMain - aMain;
    const aScore = Math.max(a.urgency ?? 0, a.importance ?? 0);
    const bScore = Math.max(b.urgency ?? 0, b.importance ?? 0);
    return bScore - aScore;
  });
}

export function parseDecomposingStepId(decomposingStepKey: string | null, taskId: string): string | null {
  if (!decomposingStepKey) return null;
  const sepIdx = decomposingStepKey.indexOf(":");
  return decomposingStepKey.substring(0, sepIdx) === taskId
    ? decomposingStepKey.substring(sepIdx + 1)
    : null;
}
