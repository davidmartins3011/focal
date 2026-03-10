import { invoke } from "@tauri-apps/api/core";
import type { Task, MicroStep, Tag } from "../types";

export function getAllTasks(): Promise<Task[]> {
  return invoke<Task[]>("get_all_tasks");
}

export function getTasks(context: string): Promise<Task[]> {
  return invoke<Task[]>("get_tasks", { context });
}

export function getTasksByDate(date: string): Promise<Task[]> {
  return invoke<Task[]>("get_tasks_by_date", { date });
}

export function getOverdueTasks(): Promise<Task[]> {
  return invoke<Task[]>("get_overdue_tasks");
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
  urgency?: number;
  importance?: number;
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
  urgency?: number;
  importance?: number;
  viewContext?: string;
  description?: string;
}): Promise<Task> {
  return invoke<Task>("update_task", params);
}

export function toggleTask(id: string): Promise<Task> {
  return invoke<Task>("toggle_task", { id });
}

export function deleteTask(id: string): Promise<void> {
  return invoke<void>("delete_task", { id });
}

export function clearAllTasks(): Promise<number> {
  return invoke<number>("clear_all_tasks");
}

export function clearTodayTasks(): Promise<number> {
  return invoke<number>("clear_today_tasks");
}

export function reorderTasks(ids: string[]): Promise<void> {
  return invoke<void>("reorder_tasks", { ids });
}

export function getAllTags(): Promise<Tag[]> {
  return invoke<Tag[]>("get_all_tags");
}

export function setTaskTags(taskId: string, tags: Tag[]): Promise<Task> {
  return invoke<Task>("set_task_tags", { taskId, tags });
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
