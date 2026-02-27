import { invoke } from "@tauri-apps/api/core";

export async function getSetting<T>(key: string): Promise<T | null> {
  const raw = await invoke<string | null>("get_setting", { key });
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await invoke<void>("set_setting", { key, value: JSON.stringify(value) });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("get_all_settings");
}
