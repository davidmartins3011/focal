import { invoke } from "@tauri-apps/api/core";
import type { Task, MicroStep, Tag } from "../types";

export function getTasks(context: string): Promise<Task[]> {
  return invoke<Task[]>("get_tasks", { context });
}

export function getTasksByDate(date: string): Promise<Task[]> {
  return invoke<Task[]>("get_tasks_by_date", { date });
}

export function getTasksByDateRange(startDate: string, endDate: string): Promise<Task[]> {
  return invoke<Task[]>("get_tasks_by_date_range", { startDate, endDate });
}

export function createTask(params: {
  name: string;
  context?: string;
  priority?: string;
  tags?: Tag[];
  estimatedMinutes?: number;
  scheduledDate?: string;
}): Promise<Task> {
  return invoke<Task>("create_task", params);
}

export function updateTask(params: {
  id: string;
  name?: string;
  done?: boolean;
  priority?: string;
  estimatedMinutes?: number;
  aiDecomposed?: boolean;
  scheduledDate?: string;
}): Promise<Task> {
  return invoke<Task>("update_task", params);
}

export function toggleTask(id: string): Promise<Task> {
  return invoke<Task>("toggle_task", { id });
}

export function deleteTask(id: string): Promise<void> {
  return invoke<void>("delete_task", { id });
}

export function reorderTasks(ids: string[]): Promise<void> {
  return invoke<void>("reorder_tasks", { ids });
}

export function setMicroSteps(taskId: string, steps: MicroStep[]): Promise<Task> {
  return invoke<Task>("set_micro_steps", { taskId, steps });
}

export function toggleMicroStep(id: string): Promise<MicroStep> {
  return invoke<MicroStep>("toggle_micro_step", { id });
}

export function getStreak(): Promise<number> {
  return invoke<number>("get_streak");
}
