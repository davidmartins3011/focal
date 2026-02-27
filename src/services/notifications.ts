import { invoke } from "@tauri-apps/api/core";
import type { NotificationHistoryEntry } from "../types";

export function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
  return invoke<NotificationHistoryEntry[]>("get_notification_history");
}

export function addNotificationEntry(params: {
  reminderId: string;
  icon: string;
  label: string;
  description: string;
  scheduledTime: string;
  firedAt: string;
  missed: boolean;
}): Promise<NotificationHistoryEntry> {
  return invoke<NotificationHistoryEntry>("add_notification_entry", params);
}

export function markNotificationRead(id: string): Promise<void> {
  return invoke<void>("mark_notification_read", { id });
}

export function markAllNotificationsRead(): Promise<void> {
  return invoke<void>("mark_all_notifications_read");
}
