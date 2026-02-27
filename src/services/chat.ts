import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage } from "../types";

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
