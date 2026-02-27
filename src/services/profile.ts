import { invoke } from "@tauri-apps/api/core";
import type { UserProfile } from "../types";

export function getProfile(): Promise<UserProfile> {
  return invoke<UserProfile>("get_profile");
}

export function updateProfile(profile: UserProfile): Promise<UserProfile> {
  return invoke<UserProfile>("update_profile", {
    data: JSON.stringify(profile),
  });
}
