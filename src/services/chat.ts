import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, Suggestion, UserProfile, Tag } from "../types";

export interface ChatTaskUpdate {
  id: string;
  name?: string;
  done?: boolean;
  priority?: string;
  scheduledDate?: string;
  estimatedMinutes?: number;
  urgency?: number;
  importance?: number;
  description?: string;
}

export interface TagAction {
  taskId: string;
  tags: Tag[];
}

export interface StepsAction {
  taskId: string;
  steps: string[];
}

export interface AiResponse {
  content: string;
  steps?: string[];
  tasksToAdd?: DailyPrepTask[];
  tasksToRemove?: string[];
  tasksToUpdate?: ChatTaskUpdate[];
  tasksToToggle?: string[];
  tasksToReorder?: string[];
  tagsToSet?: TagAction[];
  stepsToSet?: StepsAction[];
}

export function getChatMessages(): Promise<ChatMessage[]> {
  return invoke<ChatMessage[]>("get_chat_messages");
}

export function clearChat(): Promise<void> {
  return invoke<void>("clear_chat");
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

export interface DailyPrepTask {
  name: string;
  estimatedMinutes?: number;
  priority?: string;
  scheduledDate?: string;
  urgency?: number;
  importance?: number;
  tags?: Tag[];
}

export interface DailyPrepResponse {
  content: string;
  tasksToAdd: DailyPrepTask[];
  tasksToRemove: string[];
  tasksToUpdate: ChatTaskUpdate[];
  tasksToToggle?: string[];
  tasksToReorder?: string[];
  tagsToSet?: TagAction[];
  stepsToSet?: StepsAction[];
  prepComplete: boolean;
}

export function sendDailyPrepMessage(
  userMessage: string,
  history: { role: string; content: string }[],
): Promise<DailyPrepResponse> {
  return invoke<DailyPrepResponse>("send_daily_prep_message", {
    userMessage,
    history: JSON.stringify(history),
  });
}

export function sendWeeklyPrepMessage(
  userMessage: string,
  history: { role: string; content: string }[],
): Promise<DailyPrepResponse> {
  return invoke<DailyPrepResponse>("send_weekly_prep_message", {
    userMessage,
    history: JSON.stringify(history),
  });
}

export function sendPeriodPrepMessage(
  userMessage: string,
  history: { role: string; content: string }[],
  periodId: string,
): Promise<DailyPrepResponse> {
  return invoke<DailyPrepResponse>("send_period_prep_message", {
    userMessage,
    history: JSON.stringify(history),
    periodId,
  });
}

export interface OnboardingResponse {
  content: string;
  profileUpdates: Partial<UserProfile>;
  onboardingComplete: boolean;
}

export interface ProfileAnalysis {
  summary: string;
  sourceUrl: string;
}

export function analyzeProfileUrl(url: string): Promise<ProfileAnalysis> {
  return invoke<ProfileAnalysis>("analyze_profile_url", { url });
}

export function sendOnboardingMessage(
  userMessage: string,
  history: { role: string; content: string }[],
  currentProfile: UserProfile,
): Promise<OnboardingResponse> {
  return invoke<OnboardingResponse>("send_onboarding_message", {
    userMessage,
    history: JSON.stringify(history),
    currentProfile: JSON.stringify(currentProfile),
  });
}
