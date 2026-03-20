import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, AISettings, Task, Tag } from "../types";
import { getChatMessages, sendMessage, sendDailyPrepMessage, sendWeeklyPrepMessage, sendPeriodPrepMessage, clearChat, type AiResponse, type DailyPrepResponse, type TagAction, type StepsAction, type GoalAction, type StrategyActionItem, type TacticAction, type ReflectionAction, type GoalStrategyLinkAction } from "../services/chat";
import { getTasks, createTask, deleteTask, updateTask, toggleTask, reorderTasks, setMicroSteps, setTaskTags, clearAllTasks, clearTodayTasks } from "../services/tasks";
import { upsertStrategyGoal, deleteStrategyGoal, upsertStrategy, deleteStrategy, upsertTactic, deleteTactic, upsertPeriodReflection, toggleGoalStrategyLink, getStrategyGoals, getStrategyPeriods } from "../services/reviews";
import { getSetting, setSetting } from "../services/settings";
import { dayClosedKey, dayPrepKey, weekClosedKey, getMondayISO, weekPrepKey, toISODate } from "../utils/dateFormat";
import { runAnalysisNow } from "../services/memory";
import { runSuggestionsNow } from "../services/chat";
import { chatHints, slashCommands } from "../data/chatConstants";
import { providers } from "../data/settingsData";
import styles from "./ChatPanel.module.css";

interface AvailableModel {
  id: string;
  name: string;
  providerName: string;
  providerIcon: string;
  providerIconBg: string;
}

function getAvailableModels(settings: AISettings): AvailableModel[] {
  const result: AvailableModel[] = [];
  for (const provider of providers) {
    const config = settings.providers.find((p) => p.id === provider.id);
    if (config?.enabled && config.apiKey && config.keyStatus === "valid") {
      for (const model of provider.models) {
        result.push({
          id: model.id,
          name: model.name,
          providerName: provider.name,
          providerIcon: provider.icon,
          providerIconBg: provider.iconBg,
        });
      }
    }
  }
  return result;
}

function parseAISettings(raw: string | null): { models: AvailableModel[]; selectedModel: string | null } | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as AISettings;
    const models = getAvailableModels(s);
    const selectedModel = s.selectedModel && models.some((m) => m.id === s.selectedModel) ? s.selectedModel : models[0]?.id ?? null;
    return { models, selectedModel };
  } catch {
    return null;
  }
}

function formatContent(raw: string): string {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const html: string[] = [];
  let listType: "ol" | "ul" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    const ulMatch = olMatch ? null : trimmed.match(/^[-–•]\s+(.+)/);

    if (olMatch) {
      if (listType === "ul") { html.push("</ul>"); listType = null; }
      if (!listType) { html.push("<ol>"); listType = "ol"; }
      html.push(`<li>${inlineMd(olMatch[2])}</li>`);
      continue;
    }

    if (ulMatch) {
      if (listType === "ol") { html.push("</ol>"); listType = null; }
      if (!listType) { html.push("<ul>"); listType = "ul"; }
      html.push(`<li>${inlineMd(ulMatch[1])}</li>`);
      continue;
    }

    if (listType) {
      html.push(listType === "ol" ? "</ol>" : "</ul>");
      listType = null;
    }

    if (trimmed === "") {
      html.push("<br/>");
    } else {
      html.push(`<p>${inlineMd(trimmed)}</p>`);
    }
  }

  if (listType) {
    html.push(listType === "ol" ? "</ol>" : "</ul>");
  }

  return html.join("");
}

function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

const endPrepVariations: Record<string, string[]> = {
  daily: [
    "Le planning du jour est bouclé. Bonne journée ! 💪",
    "C'est tout bon pour aujourd'hui. À toi de jouer ! 🎯",
    "Planning du jour terminé ! Passe une super journée. ✨",
    "Journée bien organisée ! On se retrouve si besoin. 👋",
    "Top, la journée est planifiée. Bonne productivité ! 🚀",
    "Parfait, tout est en place. Bonne journée ! ☀️",
    "La journée est calée ! Tu vas assurer. 🔥",
    "C'est bouclé ! Fonce, et reviens si besoin. 🏃",
    "Plan du jour validé. À toi de briller ! ⭐",
    "Nickel, on est au clair pour aujourd'hui. Go ! 👊",
  ],
  weekly: [
    "Le planning de la semaine est bouclé. Bonne semaine ! 🚀",
    "Semaine bien organisée ! Tu vas tout déchirer. 💪",
    "C'est calé pour la semaine. On avance ! 🎯",
    "Planning hebdo terminé ! Bonne semaine à toi. ✨",
    "La semaine est en place. Tu sais où tu vas ! 👋",
    "Parfait, la semaine est structurée. En avant ! 🔥",
    "Top, tout est réparti. Belle semaine en perspective ! ☀️",
    "Semaine planifiée ! Tu as un bon plan. 📋",
    "C'est bouclé pour la semaine. Tu gères ! 👊",
    "Plan hebdo validé. Bonne semaine productive ! ⭐",
  ],
  daily_review: [
    "La revue du jour est terminée. Bravo pour cette journée ! ✅",
    "Beau bilan de journée ! Repose-toi bien. 🌙",
    "Revue bouclée. Belle journée derrière toi ! 👏",
    "Journée passée en revue. Bien joué ! ✨",
    "C'est tout pour aujourd'hui. Bravo ! 🎯",
    "Bilan du jour fait. Tu peux souffler ! 😌",
    "Revue terminée, belle journée accomplie ! 💪",
    "La journée est derrière toi. Bien joué ! 🌟",
    "Beau récap ! Profite de ta soirée. 🌙",
    "Journée bouclée et analysée. Repos mérité ! 🛋️",
  ],
  weekly_review: [
    "La revue de la semaine est terminée. Bon bilan ! 📊",
    "Belle semaine en rétrospective ! On continue comme ça. 💪",
    "Revue hebdo bouclée. Beau travail cette semaine ! ✅",
    "Semaine bien analysée. En route pour la suivante ! 🚀",
    "Bilan de la semaine fait. Bravo ! 👏",
    "Super rétrospective ! Tu as bien avancé. ⭐",
    "Semaine passée en revue. Belle progression ! 📈",
    "Revue terminée, la semaine prochaine s'annonce bien ! 🔥",
    "Bon bilan hebdo. Tu peux être fier ! 🌟",
    "C'est bouclé pour cette semaine. Bien joué ! 🎯",
  ],
  period: [
    "La période est bien préparée. En avant ! 🧭",
    "Tes caps sont posés. Belle période en perspective ! 🚀",
    "Préparation bouclée ! Tu sais où tu vas. 🎯",
    "Parfait, la période est structurée. Go ! 💪",
    "Top, les priorités sont claires. Bonne période ! ✨",
    "Cap défini, objectifs posés. Tu vas assurer ! 🔥",
    "Période bien cadrée. Tu as un plan solide ! ⭐",
    "Préparation terminée ! Concentre-toi sur tes priorités. 👊",
    "C'est calé pour cette période. En route ! 🌟",
    "Bien joué ! La période est prête, à toi de jouer. ☀️",
  ],
};

function pickEndPrepMessage(mode: string): ChatMessage {
  const pool = endPrepVariations[mode] ?? ["Planification terminée."];
  return {
    id: `ai-${Date.now()}`,
    role: "ai",
    content: pool[Math.floor(Math.random() * pool.length)],
  };
}

interface StuckTaskInfo {
  taskId: string;
  taskName: string;
}

interface ChatPanelProps {
  onStartOnboarding?: () => void;
  dailyPrepPending?: boolean;
  onDailyPrepConsumed?: () => void;
  weeklyPrepPending?: boolean;
  onWeeklyPrepConsumed?: () => void;
  periodPrepPending?: { periodId: string } | null;
  onPeriodPrepConsumed?: () => void;
  stuckTask?: StuckTaskInfo | null;
  onStuckConsumed?: () => void;
  onTasksChanged?: () => void;
  onStrategyChanged?: () => void;
  onViewSwitch?: (tab: "today" | "week" | "strategy") => void;
}

export default function ChatPanel({ onStartOnboarding, dailyPrepPending, onDailyPrepConsumed, weeklyPrepPending, onWeeklyPrepConsumed, periodPrepPending, onPeriodPrepConsumed, stuckTask, onStuckConsumed, onTasksChanged, onStrategyChanged, onViewSwitch }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealingMsgId, setRevealingMsgId] = useState<string | null>(null);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [prepMode, setPrepMode] = useState<"daily" | "weekly" | "daily_review" | "weekly_review" | "period" | null>(null);
  const periodIdRef = useRef<string | null>(null);
  const [rawView, setRawView] = useState(false);
  const [addedStepsMsgIds, setAddedStepsMsgIds] = useState<Set<string>>(new Set());
  const [stepsMsgTargetTask, setStepsMsgTargetTask] = useState<Record<string, string>>({});
  const [stepsDropdownMsgId, setStepsDropdownMsgId] = useState<string | null>(null);
  const [prepHasAiReply, setPrepHasAiReply] = useState(false);
  const pendingPrepExit = useRef<string | null>(null);
  const prepHistory = useRef<{ role: string; content: string }[]>([]);
  const todayTasksRef = useRef(todayTasks);
  todayTasksRef.current = todayTasks;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatMessages()
      .then(setMessages)
      .catch((err) => console.error("[ChatPanel] load error:", err));
    getTasks("today")
      .then(setTodayTasks)
      .catch(() => {});
    getSetting("ai-settings")
      .then((raw) => {
        const parsed = parseAISettings(raw);
        if (!parsed) return;
        setAvailableModels(parsed.models);
        setSelectedModelId(parsed.selectedModel);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      getSetting("ai-settings")
        .then((raw) => {
          const parsed = parseAISettings(raw);
          if (!parsed) return;
          setAvailableModels(parsed.models);
          setSelectedModelId((prev) => {
            if (prev && parsed.models.some((m) => m.id === prev)) return prev;
            return parsed.models[0]?.id ?? null;
          });
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!modelDropdownOpen && !stepsDropdownMsgId) return;
    function handleClickOutside(e: MouseEvent) {
      if (modelDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (stepsDropdownMsgId && !(e.target as Element)?.closest(`.${styles.stepsActions}`)) {
        setStepsDropdownMsgId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modelDropdownOpen, stepsDropdownMsgId]);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    setModelDropdownOpen(false);
    getSetting("ai-settings")
      .then((raw) => {
        if (!raw) return;
        try {
          const s = JSON.parse(raw) as AISettings;
          s.selectedModel = modelId;
          setSetting("ai-settings", JSON.stringify(s));
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, visibleStepCount]);

  const applyTaskActions = useCallback(
    async (actions: {
      tasksToAdd?: { name: string; estimatedMinutes?: number; priority?: string; scheduledDate?: string; urgency?: number; importance?: number; strategyId?: string; tags?: Tag[] }[];
      tasksToRemove?: string[];
      tasksToUpdate?: { id: string; name?: string; done?: boolean; priority?: string; scheduledDate?: string; estimatedMinutes?: number; urgency?: number; importance?: number; description?: string; strategyId?: string }[];
      tasksToToggle?: string[];
      tasksToReorder?: string[];
      tagsToSet?: TagAction[];
      stepsToSet?: StepsAction[];
    }) => {
      const hasActions = (actions.tasksToAdd?.length ?? 0) + (actions.tasksToRemove?.length ?? 0) + (actions.tasksToUpdate?.length ?? 0) + (actions.tasksToToggle?.length ?? 0) + (actions.tasksToReorder?.length ?? 0) + (actions.tagsToSet?.length ?? 0) + (actions.stepsToSet?.length ?? 0);
      if (hasActions > 0) {
        console.log("[ChatPanel] applyTaskActions:", {
          add: actions.tasksToAdd,
          remove: actions.tasksToRemove,
          update: actions.tasksToUpdate,
          toggle: actions.tasksToToggle,
          reorder: actions.tasksToReorder,
          tags: actions.tagsToSet,
          steps: actions.stepsToSet,
        });
      }

      let modified = false;
      const localTasks = [...todayTasksRef.current];

      for (const t of actions.tasksToAdd ?? []) {
        if (localTasks.some((ex) => ex.name.toLowerCase() === t.name.toLowerCase())) continue;
        try {
          const created = await createTask({ name: t.name, context: "today", estimatedMinutes: t.estimatedMinutes, priority: t.priority, scheduledDate: t.scheduledDate, urgency: t.urgency, importance: t.importance, strategyId: t.strategyId, tags: t.tags });
          localTasks.push(created);
          setTodayTasks((prev) => [...prev, created]);
          modified = true;
          console.log("[ChatPanel] task created:", created.id, created.name);
        } catch (err) {
          console.error("[ChatPanel] createTask error:", err);
        }
      }

      for (const taskId of actions.tasksToRemove ?? []) {
        try {
          await deleteTask(taskId);
          const idx = localTasks.findIndex((t) => t.id === taskId);
          if (idx !== -1) localTasks.splice(idx, 1);
          setTodayTasks((prev) => prev.filter((t) => t.id !== taskId));
          modified = true;
          console.log("[ChatPanel] task deleted:", taskId);
        } catch (err) {
          console.error("[ChatPanel] deleteTask error:", err);
        }
      }

      for (const upd of actions.tasksToUpdate ?? []) {
        let resolvedId = upd.id;
        const isInTodayList = localTasks.some((t) => t.id === resolvedId);
        if (!isInTodayList) {
          const byName = upd.name
            ? localTasks.find((t) => t.name.toLowerCase() === upd.name!.toLowerCase())
            : localTasks.find((t) => t.name.toLowerCase().includes(resolvedId.toLowerCase()));
          if (byName) {
            console.log("[ChatPanel] resolved update ID by name:", resolvedId, "→", byName.id);
            resolvedId = byName.id;
          } else {
            console.warn("[ChatPanel] could not resolve update ID:", upd.id, "— no task found in today list");
          }
        }
        const effectiveScheduledDate = upd.scheduledDate
          ?? (!isInTodayList && upd.priority ? toISODate(new Date()) : undefined);
        if (effectiveScheduledDate && !upd.scheduledDate) {
          console.log("[ChatPanel] auto-set scheduledDate to today for overdue task:", resolvedId);
        }
        try {
          const updated = await updateTask({ id: resolvedId, name: upd.name, done: upd.done, priority: upd.priority, scheduledDate: effectiveScheduledDate, estimatedMinutes: upd.estimatedMinutes, urgency: upd.urgency, importance: upd.importance, description: upd.description, strategyId: upd.strategyId });
          const localIdx = localTasks.findIndex((t) => t.id === resolvedId);
          if (localIdx !== -1) {
            localTasks[localIdx] = updated;
          } else {
            localTasks.push(updated);
          }
          setTodayTasks((prev) => {
            const exists = prev.some((t) => t.id === resolvedId);
            if (exists) {
              return effectiveScheduledDate && effectiveScheduledDate !== toISODate(new Date())
                ? prev.filter((t) => t.id !== resolvedId)
                : prev.map((t) => (t.id === resolvedId ? updated : t));
            }
            return [...prev, updated];
          });
          modified = true;
          console.log("[ChatPanel] task updated:", resolvedId, upd);
        } catch (err) {
          console.error("[ChatPanel] updateTask error:", err);
        }
      }

      for (const taskId of actions.tasksToToggle ?? []) {
        try {
          const toggled = await toggleTask(taskId);
          setTodayTasks((prev) => prev.map((t) => (t.id === taskId ? toggled : t)));
          modified = true;
        } catch (err) {
          console.error("[ChatPanel] toggleTask error:", err);
        }
      }

      for (const tagAction of actions.tagsToSet ?? []) {
        let resolvedId = tagAction.taskId;
        if (!localTasks.some((t) => t.id === resolvedId)) {
          const byName = localTasks.find((t) => t.name.toLowerCase().includes(resolvedId.toLowerCase()));
          if (byName) {
            resolvedId = byName.id;
          }
        }
        try {
          const updated = await setTaskTags(resolvedId, tagAction.tags);
          const localIdx = localTasks.findIndex((t) => t.id === resolvedId);
          if (localIdx !== -1) localTasks[localIdx] = updated;
          setTodayTasks((prev) => prev.map((t) => (t.id === resolvedId ? updated : t)));
          modified = true;
          console.log("[ChatPanel] tags set:", resolvedId, tagAction.tags);
        } catch (err) {
          console.error("[ChatPanel] setTaskTags error:", err);
        }
      }

      for (const stepsAction of actions.stepsToSet ?? []) {
        let resolvedId = stepsAction.taskId;
        if (!localTasks.some((t) => t.id === resolvedId)) {
          const byName = localTasks.find((t) => t.name.toLowerCase().includes(resolvedId.toLowerCase()));
          if (byName) {
            resolvedId = byName.id;
          }
        }
        try {
          const microSteps = stepsAction.steps.map((text, i) => ({
            id: `ai-step-${resolvedId}-${i}`,
            text,
            done: false,
          }));
          const updated = await setMicroSteps(resolvedId, microSteps);
          const localIdx = localTasks.findIndex((t) => t.id === resolvedId);
          if (localIdx !== -1) localTasks[localIdx] = updated;
          setTodayTasks((prev) => prev.map((t) => (t.id === resolvedId ? updated : t)));
          modified = true;
          console.log("[ChatPanel] steps set:", resolvedId, stepsAction.steps);
        } catch (err) {
          console.error("[ChatPanel] setMicroSteps error:", err);
        }
      }

      if (actions.tasksToReorder?.length) {
        try {
          await reorderTasks(actions.tasksToReorder);
          const reordered = localTasks.slice().sort((a, b) => {
            const ia = actions.tasksToReorder!.indexOf(a.id);
            const ib = actions.tasksToReorder!.indexOf(b.id);
            return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
          });
          setTodayTasks(reordered);
          modified = true;
        } catch (err) {
          console.error("[ChatPanel] reorderTasks error:", err);
        }
      }

      if (modified) onTasksChanged?.();
    },
    [onTasksChanged],
  );

  const applyPeriodActions = useCallback(
    async (actions: {
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
    }) => {
      const total =
        (actions.goalsToAdd?.length ?? 0) + (actions.goalsToUpdate?.length ?? 0) + (actions.goalsToRemove?.length ?? 0) +
        (actions.strategiesToAdd?.length ?? 0) + (actions.strategiesToUpdate?.length ?? 0) + (actions.strategiesToRemove?.length ?? 0) +
        (actions.tacticsToAdd?.length ?? 0) + (actions.tacticsToUpdate?.length ?? 0) + (actions.tacticsToRemove?.length ?? 0) +
        (actions.reflectionsToUpdate?.length ?? 0) + (actions.goalStrategyLinksToToggle?.length ?? 0);
      if (total === 0) return;
      console.log("[ChatPanel] applyPeriodActions:", actions);

      let modified = false;

      const periods = await getStrategyPeriods();
      const activePeriod = periods.find((p) => p.status === "active");
      const periodId = activePeriod?.id;

      if (!periodId) {
        console.warn("[ChatPanel] no active period found, skipping period actions");
        return;
      }

      const currentGoals = await getStrategyGoals(periodId);

      for (const g of actions.goalsToRemove ?? []) {
        try {
          await deleteStrategyGoal(g);
          modified = true;
          console.log("[ChatPanel] goal deleted:", g);
        } catch (err) { console.error("[ChatPanel] deleteStrategyGoal error:", err); }
      }

      for (const g of actions.goalsToUpdate ?? []) {
        if (!g.id) continue;
        try {
          const existing = currentGoals.find((eg) => eg.id === g.id);
          await upsertStrategyGoal({
            id: g.id,
            title: g.title ?? existing?.title ?? "",
            target: g.target ?? existing?.target ?? "",
            deadline: g.deadline,
            position: existing ? currentGoals.indexOf(existing) : currentGoals.length,
            periodId,
          });
          modified = true;
          console.log("[ChatPanel] goal updated:", g.id);
        } catch (err) { console.error("[ChatPanel] upsertStrategyGoal error:", err); }
      }

      for (const g of actions.goalsToAdd ?? []) {
        try {
          const id = g.id || crypto.randomUUID();
          const updatedGoals = await getStrategyGoals(periodId);
          await upsertStrategyGoal({
            id,
            title: g.title,
            target: g.target ?? "",
            deadline: g.deadline,
            position: updatedGoals.length,
            periodId,
          });
          modified = true;
          console.log("[ChatPanel] goal added:", id, g.title);
        } catch (err) { console.error("[ChatPanel] upsertStrategyGoal (add) error:", err); }
      }

      for (const s of actions.strategiesToRemove ?? []) {
        try {
          await deleteStrategy(s);
          modified = true;
          console.log("[ChatPanel] strategy deleted:", s);
        } catch (err) { console.error("[ChatPanel] deleteStrategy error:", err); }
      }

      for (const s of actions.strategiesToUpdate ?? []) {
        if (!s.id) continue;
        try {
          const foundGoal = currentGoals.find((g) => g.strategies.some((st) => st.id === s.id));
          const goalId = s.goalId || foundGoal?.id || "";
          await upsertStrategy({
            id: s.id,
            goalId,
            title: s.title,
            description: "",
            position: 0,
          });
          modified = true;
          console.log("[ChatPanel] strategy updated:", s.id);
        } catch (err) { console.error("[ChatPanel] upsertStrategy error:", err); }
      }

      for (const s of actions.strategiesToAdd ?? []) {
        if (!s.goalId) { console.warn("[ChatPanel] strategiesToAdd: missing goalId for", s.title); continue; }
        try {
          const id = s.id || crypto.randomUUID();
          const parentGoal = currentGoals.find((g) => g.id === s.goalId);
          await upsertStrategy({
            id,
            goalId: s.goalId,
            title: s.title,
            description: "",
            position: parentGoal?.strategies.length ?? 0,
          });
          modified = true;
          console.log("[ChatPanel] strategy added:", id, s.title);
        } catch (err) { console.error("[ChatPanel] upsertStrategy (add) error:", err); }
      }

      for (const t of actions.tacticsToRemove ?? []) {
        try {
          await deleteTactic(t);
          modified = true;
          console.log("[ChatPanel] tactic deleted:", t);
        } catch (err) { console.error("[ChatPanel] deleteTactic error:", err); }
      }

      for (const t of actions.tacticsToUpdate ?? []) {
        if (!t.id) continue;
        try {
          const strategyId = t.strategyId || (currentGoals.flatMap((g) => g.strategies).find((s) => s.tactics.some((tc) => tc.id === t.id))?.id ?? "");
          await upsertTactic({
            id: t.id,
            strategyId,
            title: t.title,
            description: "",
            position: 0,
          });
          modified = true;
          console.log("[ChatPanel] tactic updated:", t.id);
        } catch (err) { console.error("[ChatPanel] upsertTactic error:", err); }
      }

      for (const t of actions.tacticsToAdd ?? []) {
        if (!t.strategyId) { console.warn("[ChatPanel] tacticsToAdd: missing strategyId for", t.title); continue; }
        try {
          const id = t.id || crypto.randomUUID();
          const parentStrat = currentGoals.flatMap((g) => g.strategies).find((s) => s.id === t.strategyId);
          await upsertTactic({
            id,
            strategyId: t.strategyId,
            title: t.title,
            description: "",
            position: parentStrat?.tactics.length ?? 0,
          });
          modified = true;
          console.log("[ChatPanel] tactic added:", id, t.title);
        } catch (err) { console.error("[ChatPanel] upsertTactic (add) error:", err); }
      }

      for (const r of actions.reflectionsToUpdate ?? []) {
        try {
          const period = activePeriod;
          const existing = period?.reflections.find((ref_) => ref_.id === r.id);
          await upsertPeriodReflection({
            id: r.id,
            periodId,
            prompt: existing?.prompt ?? "",
            answer: r.answer,
            position: existing ? period!.reflections.indexOf(existing) : 0,
          });
          modified = true;
          console.log("[ChatPanel] reflection updated:", r.id);
        } catch (err) { console.error("[ChatPanel] upsertPeriodReflection error:", err); }
      }

      for (const link of actions.goalStrategyLinksToToggle ?? []) {
        try {
          await toggleGoalStrategyLink(link.goalId, link.strategyId);
          modified = true;
          console.log("[ChatPanel] goal-strategy link toggled:", link.goalId, link.strategyId);
        } catch (err) { console.error("[ChatPanel] toggleGoalStrategyLink error:", err); }
      }

      if (modified) onStrategyChanged?.();
    },
    [onStrategyChanged],
  );

  const handleChatResponse = useCallback(
    async (response: AiResponse) => {
      const msgId = `ai-${Date.now()}`;
      const steps = response.steps?.map((s) => ({ text: s }));
      const aiMsg: ChatMessage = { id: msgId, role: "ai", content: response.content, steps };
      setMessages((prev) => [...prev, aiMsg]);

      if (steps && steps.length > 0) {
        setRevealingMsgId(msgId);
        setVisibleStepCount(0);
        steps.forEach((_, i) => {
          setTimeout(() => setVisibleStepCount(i + 1), 350 * (i + 1));
        });
        setTimeout(() => setRevealingMsgId(null), 350 * steps.length + 300);
      }

      await applyTaskActions(response);
      await applyPeriodActions(response);
    },
    [applyTaskActions, applyPeriodActions],
  );

  const handlePrepResponse = useCallback(
    async (response: DailyPrepResponse) => {
      prepHistory.current.push({ role: "ai", content: response.content });

      const msgId = `ai-${Date.now()}`;
      const aiMsg: ChatMessage = { id: msgId, role: "ai", content: response.content };
      setMessages((prev) => [...prev, aiMsg]);
      setPrepHasAiReply(true);

      await applyTaskActions(response);
      await applyPeriodActions(response);

      if (response.prepComplete || pendingPrepExit.current) {
        if (pendingPrepExit.current && !response.prepComplete) {
          const endMsg = pickEndPrepMessage(pendingPrepExit.current);
          setMessages((prev) => [...prev, endMsg]);
        }
        pendingPrepExit.current = null;
        setPrepMode(null);
        prepHistory.current = [];
      }
    },
    [applyTaskActions, applyPeriodActions],
  );

  const sendPrepMessage = useCallback(
    (text: string, mode: "daily" | "weekly" | "daily_review" | "weekly_review" | "period" = "daily") => {
      if (isTyping) return;

      prepHistory.current.push({ role: "user", content: text });

      const userMsg: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setError(null);
      setIsTyping(true);

      let sendPromise: Promise<import("../services/chat").DailyPrepResponse>;
      if (mode === "period" && periodIdRef.current) {
        sendPromise = sendPeriodPrepMessage(text, prepHistory.current.slice(0, -1), periodIdRef.current);
      } else {
        const sendFn = (mode === "weekly" || mode === "weekly_review") ? sendWeeklyPrepMessage : sendDailyPrepMessage;
        sendPromise = sendFn(text, prepHistory.current.slice(0, -1));
      }

      sendPromise
        .then(async (response) => {
          setIsTyping(false);
          await handlePrepResponse(response);
          textareaRef.current?.focus();
        })
        .catch((err) => {
          setIsTyping(false);
          if (pendingPrepExit.current) {
            const endMsg = pickEndPrepMessage(pendingPrepExit.current);
            setMessages((prev) => [...prev, endMsg]);
            pendingPrepExit.current = null;
            setPrepMode(null);
            prepHistory.current = [];
          }
          const errMsg = typeof err === "string" ? err : String(err);
          setError(errMsg || "Erreur inconnue lors de l'appel à l'IA.");
          console.error(`[ChatPanel] ${mode} prep error:`, err);
        });
    },
    [isTyping, handlePrepResponse],
  );

  const startDailyPrep = useCallback(() => {
    if (isTyping) return;
    setPrepMode("daily");
    setPrepHasAiReply(false);
    pendingPrepExit.current = null;
    prepHistory.current = [];
    textareaRef.current?.focus();
    onViewSwitch?.("today");
    const greetings = [
      "C'est parti ! Préparons la journée ensemble.",
      "Salut ! On organise ta journée ?",
      "Hello ! Voyons ce qui t'attend aujourd'hui.",
      "Allez, on prépare la journée !",
      "Prêt à planifier ? C'est parti !",
      "On s'y met ! Qu'est-ce qu'on a aujourd'hui ?",
      "C'est le moment de poser la journée. On y va ?",
      "Hop, on regarde ce qu'il y a au programme !",
      "Let's go ! On structure ta journée.",
      "Allez, on fait le point sur aujourd'hui !",
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    sendPrepMessage(greeting, "daily");
  }, [isTyping, sendPrepMessage, onViewSwitch]);

  const startWeeklyPrep = useCallback(() => {
    if (isTyping) return;
    setPrepMode("weekly");
    setPrepHasAiReply(false);
    pendingPrepExit.current = null;
    prepHistory.current = [];
    textareaRef.current?.focus();
    onViewSwitch?.("week");
    const greetings = [
      "C'est parti ! Préparons la semaine ensemble.",
      "Salut ! On organise ta semaine ?",
      "Hello ! Voyons ce qui t'attend cette semaine.",
      "Allez, on prépare la semaine !",
      "Prêt à planifier ta semaine ? C'est parti !",
      "On s'y met ! Qu'est-ce qu'on a cette semaine ?",
      "C'est le moment de poser la semaine. On y va ?",
      "Hop, on regarde le programme de la semaine !",
      "Let's go ! On structure ta semaine.",
      "Allez, on fait le point sur la semaine !",
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    sendPrepMessage(greeting, "weekly");
  }, [isTyping, sendPrepMessage, onViewSwitch]);

  const startPeriodPrep = useCallback((periodId: string) => {
    if (isTyping) return;
    setPrepMode("period");
    setPrepHasAiReply(false);
    pendingPrepExit.current = null;
    prepHistory.current = [];
    periodIdRef.current = periodId;
    textareaRef.current?.focus();
    onViewSwitch?.("strategy");
    const greetings = [
      "C'est parti ! Préparons cette période ensemble.",
      "Salut ! On organise ta prise de recul ?",
      "Hello ! Voyons tes priorités pour cette période.",
      "Allez, on prépare la période !",
      "Prêt à poser tes caps ? C'est parti !",
      "On s'y met ! Quels sont tes objectifs pour cette période ?",
      "C'est le moment de structurer ta période. On y va ?",
      "Hop, on fait le point sur tes priorités stratégiques !",
      "Let's go ! On clarifie tes caps à tenir.",
      "Allez, on pose les bases de cette période !",
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    sendPrepMessage(greeting, "period");
  }, [isTyping, sendPrepMessage, onViewSwitch]);

  useEffect(() => {
    if (!dailyPrepPending) return;
    onDailyPrepConsumed?.();
    startDailyPrep();
  }, [dailyPrepPending, startDailyPrep, onDailyPrepConsumed]);

  useEffect(() => {
    if (!weeklyPrepPending) return;
    onWeeklyPrepConsumed?.();
    startWeeklyPrep();
  }, [weeklyPrepPending, startWeeklyPrep, onWeeklyPrepConsumed]);

  useEffect(() => {
    if (!periodPrepPending) return;
    onPeriodPrepConsumed?.();
    startPeriodPrep(periodPrepPending.periodId);
  }, [periodPrepPending, startPeriodPrep, onPeriodPrepConsumed]);

  useEffect(() => {
    if (!stuckTask) return;
    onStuckConsumed?.();

    if (isTyping) return;

    const text = `Je bloque sur la tâche "${stuckTask.taskName}". Aide-moi à comprendre ce qui me bloque et à trouver comment avancer.`;
    const userMsg: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setError(null);
    setIsTyping(true);
    setPrepMode(null);

    sendMessage(text)
      .then(async (response) => {
        setIsTyping(false);
        await handleChatResponse(response);
      })
      .catch((err) => {
        setIsTyping(false);
        const errMsg = typeof err === "string" ? err : String(err);
        setError(errMsg || "Erreur inconnue lors de l'appel à l'IA.");
      });
  }, [stuckTask, onStuckConsumed]); // eslint-disable-line react-hooks/exhaustive-deps

  const guessTaskForMessage = useCallback(
    (msgId: string): string | undefined => {
      const tasks = todayTasks.filter((t) => !t.done);
      if (tasks.length === 0) return undefined;

      const msgIdx = messages.findIndex((m) => m.id === msgId);
      if (msgIdx < 0) return tasks[0]?.id;

      const context = messages
        .slice(Math.max(0, msgIdx - 4), msgIdx + 1)
        .map((m) => m.content)
        .join(" ")
        .toLowerCase();

      let bestId = tasks[0]?.id;
      let bestLen = 0;
      for (const t of tasks) {
        const name = t.name.toLowerCase();
        if (context.includes(name) && name.length > bestLen) {
          bestId = t.id;
          bestLen = name.length;
        }
      }
      return bestId;
    },
    [messages, todayTasks],
  );

  const handleAddStepsToTask = useCallback(
    (msgId: string, steps: { text: string }[], taskId: string) => {
      const microSteps = steps.map((s, i) => ({
        id: `chat-${msgId}-${i}`,
        text: s.text,
        done: false,
      }));
      setMicroSteps(taskId, microSteps)
        .then(() => {
          setAddedStepsMsgIds((prev) => new Set(prev).add(msgId));
          onTasksChanged?.();
        })
        .catch((err) => console.error("[ChatPanel] setMicroSteps error:", err));
    },
    [onTasksChanged],
  );

  const resetInput = useCallback(() => {
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    if (text === "/help") {
      resetInput();
      const helpContent = slashCommands
        .map((cmd) => `**${cmd.command}** — ${cmd.description}`)
        .join("\n");
      const helpMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: `Commandes disponibles :\n\n${helpContent}`,
      };
      setMessages((prev) => [...prev, helpMsg]);
      return;
    }

    if (text === "/start-onboarding" && onStartOnboarding) {
      resetInput();
      onStartOnboarding();
      return;
    }

    if (text === "/start-day") {
      resetInput();
      startDailyPrep();
      return;
    }

    if (text === "/start-week") {
      resetInput();
      startWeeklyPrep();
      return;
    }

    if (text === "/start-period") {
      resetInput();
      const activePeriodId = localStorage.getItem("focal-active-period-id");
      if (activePeriodId) {
        startPeriodPrep(activePeriodId);
      } else {
        const noActiveMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: "Aucune période active trouvée. Ouvre l'onglet « Prise de recul » pour créer ou activer une période.",
        };
        setMessages((prev) => [...prev, noActiveMsg]);
      }
      return;
    }

    if (text === "/reset-period") {
      resetInput();
      const activePeriodId = localStorage.getItem("focal-active-period-id");
      if (activePeriodId) {
        localStorage.removeItem(`period-prep-dismissed-${activePeriodId}`);
      }
      const resetMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: "Préparation de la période réinitialisée. Le bandeau « Lancer la préparation » réapparaîtra dans la prise de recul.",
      };
      setMessages((prev) => [...prev, resetMsg]);
      return;
    }

    if (text === "/reset-day") {
      resetInput();
      const todayStr = toISODate(new Date());
      const prepKey = dayPrepKey(todayStr);
      Promise.all([
        setSetting(dayClosedKey(todayStr), ""),
        setSetting(prepKey, ""),
      ]).then(() => {
        onTasksChanged?.();
        const resetMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: "Journée réinitialisée. Le jour n'est plus marqué comme terminé et la préparation quotidienne peut être relancée.",
        };
        setMessages((prev) => [...prev, resetMsg]);
      }).catch((err) => {
        console.error("[ChatPanel] reset-day error:", err);
      });
      return;
    }

    if (text === "/reset-week") {
      resetInput();
      const mondayStr = getMondayISO(new Date());
      Promise.all([
        setSetting(weekClosedKey(mondayStr), ""),
        setSetting(weekPrepKey(mondayStr), ""),
      ]).then(() => {
        onTasksChanged?.();
        const resetMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: "Semaine réinitialisée. La semaine n'est plus marquée comme terminée et la préparation hebdomadaire peut être relancée.",
        };
        setMessages((prev) => [...prev, resetMsg]);
      }).catch((err) => {
        console.error("[ChatPanel] reset-week error:", err);
      });
      return;
    }

    if (text === "/clear") {
      resetInput();
      setMessages([]);
      setPrepMode(null);
      prepHistory.current = [];
      setError(null);
      clearChat().catch((err) => console.error("[ChatPanel] clearChat error:", err));
      return;
    }

    if (text === "/clear-db-tasks") {
      resetInput();
      const sysMsg: ChatMessage = { id: `sys-${Date.now()}`, role: "ai", content: "Suppression de toutes les tâches en cours..." };
      setMessages((prev) => [...prev, sysMsg]);
      setIsTyping(true);
      clearAllTasks()
        .then((count) => {
          setIsTyping(false);
          setTodayTasks([]);
          onTasksChanged?.();
          const resultMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "ai",
            content: `${count} tâche${count > 1 ? "s" : ""} supprimée${count > 1 ? "s" : ""} de la base de données.`,
          };
          setMessages((prev) => [...prev, resultMsg]);
        })
        .catch((err) => {
          setIsTyping(false);
          setError(typeof err === "string" ? err : String(err));
          console.error("[ChatPanel] clear-db-tasks error:", err);
        });
      return;
    }

    if (text === "/clear-db-tasks-today") {
      resetInput();
      const sysMsg: ChatMessage = { id: `sys-${Date.now()}`, role: "ai", content: "Suppression des tâches d'aujourd'hui en cours..." };
      setMessages((prev) => [...prev, sysMsg]);
      setIsTyping(true);
      clearTodayTasks()
        .then((count) => {
          setIsTyping(false);
          setTodayTasks([]);
          onTasksChanged?.();
          const resultMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "ai",
            content: `${count} tâche${count > 1 ? "s" : ""} d'aujourd'hui supprimée${count > 1 ? "s" : ""} de la base de données.`,
          };
          setMessages((prev) => [...prev, resultMsg]);
        })
        .catch((err) => {
          setIsTyping(false);
          setError(typeof err === "string" ? err : String(err));
          console.error("[ChatPanel] clear-db-tasks-today error:", err);
        });
      return;
    }

    if (text === "/analyse-conversations") {
      resetInput();
      const sysMsg: ChatMessage = { id: `sys-${Date.now()}`, role: "ai", content: "Analyse des conversations en cours..." };
      setMessages((prev) => [...prev, sysMsg]);
      setIsTyping(true);
      runAnalysisNow()
        .then((didRun) => {
          setIsTyping(false);
          const resultMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "ai",
            content: didRun
              ? "L'analyse de tes conversations est terminée. Tes observations comportementales ont été mises à jour — tu peux les consulter dans Mon profil."
              : "Aucune nouvelle conversation à analyser (pas de messages aujourd'hui, ou analyse déjà effectuée).",
          };
          setMessages((prev) => [...prev, resultMsg]);
        })
        .catch((err) => {
          setIsTyping(false);
          const errMsg = typeof err === "string" ? err : String(err);
          setError(errMsg);
          console.error("[ChatPanel] analyse-conversations error:", err);
        });
      return;
    }

    if (text === "/run-suggestions") {
      resetInput();
      const sysMsg: ChatMessage = { id: `sys-${Date.now()}`, role: "ai", content: "Génération des suggestions en cours… Cela peut prendre quelques secondes." };
      setMessages((prev) => [...prev, sysMsg]);
      setIsTyping(true);
      runSuggestionsNow()
        .then((didRun) => {
          setIsTyping(false);
          const resultMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "ai",
            content: didRun
              ? "De nouvelles suggestions ont été générées ! Consulte l'onglet Suggestions pour les découvrir."
              : "Pas assez de données pour générer des suggestions. Utilise l'app quelques jours et réessaie.",
          };
          setMessages((prev) => [...prev, resultMsg]);
        })
        .catch((err) => {
          setIsTyping(false);
          const errMsg = typeof err === "string" ? err : String(err);
          setError(errMsg);
          console.error("[ChatPanel] run-suggestions error:", err);
        });
      return;
    }

    resetInput();

    if (prepMode) {
      sendPrepMessage(text, prepMode);
      return;
    }

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setError(null);
    setIsTyping(true);

    sendMessage(text)
      .then(async (response) => {
        setIsTyping(false);
        await handleChatResponse(response);
      })
      .catch((err) => {
        setIsTyping(false);
        const errMsg = typeof err === "string" ? err : String(err);
        setError(errMsg || "Erreur inconnue lors de l'appel à l'IA.");
      });
  }, [input, isTyping, prepMode, onStartOnboarding, startDailyPrep, startWeeklyPrep, startPeriodPrep, sendPrepMessage, resetInput, handleChatResponse]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }

  return (
    <>
      <div className={styles.header}>
        <div className={styles.title}>
          <div className={styles.avatar}>⚡</div>
          <div>
            <h3>focal. assistant</h3>
            <p className={styles.status}>
              <span className={styles.statusDot} />
              En ligne
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.rawToggle} ${rawView ? styles.rawToggleActive : ""}`}
            onClick={() => setRawView((v) => !v)}
            title={rawView ? "Vue formatée" : "Vue brute"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </button>
        {availableModels.length > 0 ? (
          <div className={styles.modelSelectorWrap} ref={dropdownRef}>
            <button
              className={styles.modelSelector}
              onClick={() => setModelDropdownOpen((v) => !v)}
            >
              {(() => {
                const sel = availableModels.find((m) => m.id === selectedModelId);
                if (!sel) return <>Choisir un modèle</>;
                return (
                  <>
                    <span
                      className={styles.modelProviderIcon}
                      style={{ background: sel.providerIconBg }}
                    >
                      {sel.providerIcon}
                    </span>
                    {sel.name}
                    <svg className={`${styles.chevron} ${modelDropdownOpen ? styles.chevronOpen : ""}`} width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </>
                );
              })()}
            </button>
            {modelDropdownOpen && (
              <div className={styles.modelDropdown}>
                {(() => {
                  const groups: Record<string, AvailableModel[]> = {};
                  for (const m of availableModels) {
                    (groups[m.providerName] ??= []).push(m);
                  }
                  return Object.entries(groups).map(([providerName, models]) => (
                    <div key={providerName} className={styles.modelGroup}>
                      <div className={styles.modelGroupLabel}>
                        <span
                          className={styles.modelGroupIcon}
                          style={{ background: models[0].providerIconBg }}
                        >
                          {models[0].providerIcon}
                        </span>
                        {providerName}
                      </div>
                      {models.map((m) => (
                        <button
                          key={m.id}
                          className={`${styles.modelOption} ${m.id === selectedModelId ? styles.modelOptionActive : ""}`}
                          onClick={() => handleSelectModel(m.id)}
                        >
                          {m.name}
                          {m.id === selectedModelId && <span className={styles.modelCheck}>✓</span>}
                        </button>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.modelSelectorEmpty}>
            Aucune IA configurée
          </div>
        )}
        </div>
      </div>

      <div className={styles.messages}>
        {messages.length > 0 && (
          <div className={styles.dayDivider}>
            <span>Conversation</span>
          </div>
        )}

        {messages.length === 0 && !isTyping && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>⚡</span>
            <p>Parle-moi d'une tâche, d'un blocage, ou demande-moi de préparer ta journée.</p>
          </div>
        )}

        {messages.filter((m) => m.content.trim()).map((msg) => {
          const isRevealing = msg.id === revealingMsgId;

          return (
            <div key={msg.id} className={`${styles.msg} ${styles[msg.role]}`}>
              <div className={styles.msgRole}>
                {msg.role === "ai" ? "focal." : "Toi"}
              </div>
              <div
                className={styles.msgBubble}
                dangerouslySetInnerHTML={{
                  __html: rawView
                    ? msg.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")
                    : formatContent(msg.content),
                }}
              />
              {msg.steps && (
                <div className={styles.msgSteps}>
                  {msg.steps.map((step, i) => {
                    const visible = !isRevealing || i < visibleStepCount;
                    return (
                      <div
                        key={i}
                        className={`${styles.msgStep} ${
                          visible ? styles.stepVisible : styles.stepHidden
                        }`}
                      >
                        <div className={styles.stepNum}>{i + 1}</div>
                        <div
                          className={styles.stepContent}
                          dangerouslySetInnerHTML={{ __html: step.text }}
                        />
                      </div>
                    );
                  })}
                  {!isRevealing && !addedStepsMsgIds.has(msg.id) && todayTasks.some((t) => !t.done) && (() => {
                    const activeTasks = todayTasks.filter((t) => !t.done);
                    const selectedId = stepsMsgTargetTask[msg.id] ?? guessTaskForMessage(msg.id) ?? activeTasks[0]?.id;
                    const selectedTask = activeTasks.find((t) => t.id === selectedId);
                    const isOpen = stepsDropdownMsgId === msg.id;
                    return (
                      <div className={styles.stepsActions}>
                        <div className={styles.taskSelectWrap}>
                          <button
                            className={styles.taskSelectBtn}
                            onClick={() => setStepsDropdownMsgId(isOpen ? null : msg.id)}
                          >
                            <span className={styles.taskSelectLabel}>{selectedTask?.name ?? "Choisir..."}</span>
                            <svg className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          {isOpen && (
                            <div className={styles.taskDropdown}>
                              {activeTasks.map((task) => (
                                <button
                                  key={task.id}
                                  className={`${styles.taskDropdownItem} ${task.id === selectedId ? styles.taskDropdownItemActive : ""}`}
                                  onClick={() => {
                                    setStepsMsgTargetTask((prev) => ({ ...prev, [msg.id]: task.id }));
                                    setStepsDropdownMsgId(null);
                                  }}
                                >
                                  {task.name}
                                  {task.id === selectedId && <span className={styles.taskDropdownCheck}>✓</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          className={styles.addStepsBtn}
                          onClick={() => {
                            if (selectedId) handleAddStepsToTask(msg.id, msg.steps!, selectedId);
                          }}
                        >
                          Ajouter
                        </button>
                      </div>
                    );
                  })()}
                  {addedStepsMsgIds.has(msg.id) && (
                    <div className={styles.stepsAdded}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Étapes ajoutées
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className={`${styles.msg} ${styles.ai}`}>
            <div className={styles.msgRole}>focal.</div>
            <div className={styles.typingIndicator}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        {prepMode && prepHasAiReply && (
          <button
            className={styles.endPrepBtn}
            onClick={() => {
              if (isTyping) {
                pendingPrepExit.current = prepMode;
                return;
              }
              const endMsg = pickEndPrepMessage(prepMode);
              setMessages((prev) => [...prev, endMsg]);
              setPrepMode(null);
              prepHistory.current = [];
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ daily: "Finir le planning du jour", weekly: "Finir le planning de la semaine", daily_review: "Finir la revue du jour", weekly_review: "Finir la revue de la semaine", period: "Finir la préparation de la période" }[prepMode]}
          </button>
        )}
        <div className={styles.inputBox}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Parle-moi d'une tâche bloquante, de ta journée..."
            rows={1}
          />
          <button className={styles.sendBtn} onClick={send} disabled={isTyping}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className={styles.hints}>
          {chatHints.map((hint) => (
            <button
              key={hint.label}
              className={styles.hintPill}
              onClick={() => {
                setInput(hint.text);
                textareaRef.current?.focus();
              }}
            >
              {hint.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
