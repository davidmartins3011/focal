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

export interface GoalAction {
  id?: string;
  title: string;
  target?: string;
  deadline?: string;
}

export interface StrategyActionItem {
  id?: string;
  title: string;
  goalId?: string;
}

export interface TacticAction {
  id?: string;
  title: string;
  strategyId?: string;
}

export interface ReflectionAction {
  id: string;
  answer: string;
}

export interface GoalStrategyLinkAction {
  goalId: string;
  strategyId: string;
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
  goalsToAdd?: GoalAction[];
  goalsToUpdate?: GoalAction[];
  goalsToRemove?: string[];
  strategiesToAdd?: StrategyActionItem[];
  strategiesToUpdate?: StrategyActionItem[];
  strategiesToRemove?: string[];
  tacticsToAdd?: TacticAction[];
  tacticsToUpdate?: TacticAction[];
  tacticsToRemove?: string[];
  reflectionsToUpdate?: ReflectionAction[];
  goalStrategyLinksToToggle?: GoalStrategyLinkAction[];
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

export function getSuggestions(): Promise<Suggestion[]> {
  return invoke<Suggestion[]>("get_suggestions");
}

export function getLastSuggestionsRun(): Promise<string | null> {
  return invoke<string | null>("get_last_suggestions_run");
}

export function respondToSuggestion(id: string, status: "accepted" | "rejected" | "later"): Promise<void> {
  return invoke<void>("respond_to_suggestion", { id, status });
}

export function checkAndRunSuggestions(): Promise<boolean> {
  return invoke<boolean>("check_and_run_suggestions");
}

export function runSuggestionsNow(): Promise<boolean> {
  return invoke<boolean>("run_suggestions_now");
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
  goalsToAdd?: GoalAction[];
  goalsToUpdate?: GoalAction[];
  goalsToRemove?: string[];
  strategiesToAdd?: StrategyActionItem[];
  strategiesToUpdate?: StrategyActionItem[];
  strategiesToRemove?: string[];
  tacticsToAdd?: TacticAction[];
  tacticsToUpdate?: TacticAction[];
  tacticsToRemove?: string[];
  reflectionsToUpdate?: ReflectionAction[];
  goalStrategyLinksToToggle?: GoalStrategyLinkAction[];
}

export function sendDailyPrepMessage(
  userMessage: string,
  history: { role: string; content: string }[],
  targetDate?: string,
): Promise<DailyPrepResponse> {
  return invoke<DailyPrepResponse>("send_daily_prep_message", {
    userMessage,
    history: JSON.stringify(history),
    targetDate: targetDate ?? null,
  });
}

export function sendDailyReviewMessage(
  userMessage: string,
  history: { role: string; content: string }[],
): Promise<DailyPrepResponse> {
  return invoke<DailyPrepResponse>("send_daily_review_message", {
    userMessage,
    history: JSON.stringify(history),
  });
}

export function sendWeeklyReviewMessage(
  userMessage: string,
  history: { role: string; content: string }[],
): Promise<DailyPrepResponse> {
  return invoke<DailyPrepResponse>("send_weekly_review_message", {
    userMessage,
    history: JSON.stringify(history),
  });
}

export function sendWeeklyPrepMessage(
  userMessage: string,
  history: { role: string; content: string }[],
  targetMonday?: string,
): Promise<DailyPrepResponse> {
  return invoke<DailyPrepResponse>("send_weekly_prep_message", {
    userMessage,
    history: JSON.stringify(history),
    targetMonday: targetMonday ?? null,
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

export function sendPeriodReviewMessage(
  userMessage: string,
  history: { role: string; content: string }[],
  periodId: string,
): Promise<DailyPrepResponse> {
  return invoke<DailyPrepResponse>("send_period_review_message", {
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
