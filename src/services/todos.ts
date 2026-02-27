import { invoke } from "@tauri-apps/api/core";
import type { TodoItem } from "../types";

export function getTodos(): Promise<TodoItem[]> {
  return invoke<TodoItem[]>("get_todos");
}

export function createTodo(params: {
  text: string;
  urgency?: number;
  importance?: number;
  source?: string;
  scheduledDate?: string;
}): Promise<TodoItem> {
  return invoke<TodoItem>("create_todo", params);
}

export function updateTodo(params: {
  id: string;
  text?: string;
  done?: boolean;
  urgency?: number;
  importance?: number;
  scheduledDate?: string;
}): Promise<TodoItem> {
  return invoke<TodoItem>("update_todo", params);
}

export function toggleTodo(id: string): Promise<TodoItem> {
  return invoke<TodoItem>("toggle_todo", { id });
}

export function deleteTodo(id: string): Promise<void> {
  return invoke<void>("delete_todo", { id });
}
