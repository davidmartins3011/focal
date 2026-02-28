import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, Suggestion } from "../types";

export interface AiResponse {
  content: string;
  steps?: string[];
}

export function getChatMessages(): Promise<ChatMessage[]> {
  return invoke<ChatMessage[]>("get_chat_messages");
}

export function addChatMessage(
  role: string,
  content: string,
  steps?: string[],
): Promise<ChatMessage> {
  return invoke<ChatMessage>("add_chat_message", { role, content, steps });
}

export function sendMessage(userMessage: string): Promise<AiResponse> {
  return invoke<AiResponse>("send_message", { userMessage });
}

export interface DecompStep {
  text: string;
  estimatedMinutes?: number;
}

export function decomposeTask(
  taskName: string,
  context?: string,
): Promise<DecompStep[]> {
  return invoke<DecompStep[]>("decompose_task", { taskName, context });
}

export function generateSuggestions(): Promise<Suggestion[]> {
  return invoke<Suggestion[]>("generate_suggestions");
}
