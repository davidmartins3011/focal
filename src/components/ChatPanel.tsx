import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, AISettings, Task, Tag } from "../types";
import { getChatMessages, sendMessage, sendDailyPrepMessage, sendWeeklyPrepMessage, clearChat, type AiResponse, type DailyPrepResponse, type TagAction, type StepsAction } from "../services/chat";
import { getTasks, createTask, deleteTask, updateTask, toggleTask, reorderTasks, setMicroSteps, setTaskTags, clearAllTasks, clearTodayTasks } from "../services/tasks";
import { getSetting, setSetting } from "../services/settings";
import { runAnalysisNow } from "../services/memory";
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
  ],
  weekly: [
    "Le planning de la semaine est bouclé. Bonne semaine ! 🚀",
    "Semaine bien organisée ! Tu vas tout déchirer. 💪",
    "C'est calé pour la semaine. On avance ! 🎯",
    "Planning hebdo terminé ! Bonne semaine à toi. ✨",
    "La semaine est en place. Tu sais où tu vas ! 👋",
  ],
  daily_review: [
    "La revue du jour est terminée. Bravo pour cette journée ! ✅",
    "Beau bilan de journée ! Repose-toi bien. 🌙",
    "Revue bouclée. Belle journée derrière toi ! 👏",
    "Journée passée en revue. Bien joué ! ✨",
    "C'est tout pour aujourd'hui. Bravo ! 🎯",
  ],
  weekly_review: [
    "La revue de la semaine est terminée. Bon bilan ! 📊",
    "Belle semaine en rétrospective ! On continue comme ça. 💪",
    "Revue hebdo bouclée. Beau travail cette semaine ! ✅",
    "Semaine bien analysée. En route pour la suivante ! 🚀",
    "Bilan de la semaine fait. Bravo ! 👏",
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
  stuckTask?: StuckTaskInfo | null;
  onStuckConsumed?: () => void;
  onTasksChanged?: () => void;
}

export default function ChatPanel({ onStartOnboarding, dailyPrepPending, onDailyPrepConsumed, weeklyPrepPending, onWeeklyPrepConsumed, stuckTask, onStuckConsumed, onTasksChanged }: ChatPanelProps) {
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
  const [prepMode, setPrepMode] = useState<"daily" | "weekly" | "daily_review" | "weekly_review" | null>(null);
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
      tasksToAdd?: { name: string; estimatedMinutes?: number; priority?: string; scheduledDate?: string; urgency?: number; importance?: number; tags?: Tag[] }[];
      tasksToRemove?: string[];
      tasksToUpdate?: { id: string; name?: string; done?: boolean; priority?: string; scheduledDate?: string; estimatedMinutes?: number; urgency?: number; importance?: number; description?: string }[];
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
          const created = await createTask({ name: t.name, context: "today", estimatedMinutes: t.estimatedMinutes, priority: t.priority, scheduledDate: t.scheduledDate, urgency: t.urgency, importance: t.importance, tags: t.tags });
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
          ?? (!isInTodayList && upd.priority ? new Date().toISOString().slice(0, 10) : undefined);
        if (effectiveScheduledDate && !upd.scheduledDate) {
          console.log("[ChatPanel] auto-set scheduledDate to today for overdue task:", resolvedId);
        }
        try {
          const updated = await updateTask({ id: resolvedId, name: upd.name, done: upd.done, priority: upd.priority, scheduledDate: effectiveScheduledDate, estimatedMinutes: upd.estimatedMinutes, urgency: upd.urgency, importance: upd.importance, description: upd.description });
          const localIdx = localTasks.findIndex((t) => t.id === resolvedId);
          if (localIdx !== -1) {
            localTasks[localIdx] = updated;
          } else {
            localTasks.push(updated);
          }
          setTodayTasks((prev) => {
            const exists = prev.some((t) => t.id === resolvedId);
            if (exists) {
              return effectiveScheduledDate && effectiveScheduledDate !== new Date().toISOString().slice(0, 10)
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
    },
    [applyTaskActions],
  );

  const handlePrepResponse = useCallback(
    async (response: DailyPrepResponse) => {
      prepHistory.current.push({ role: "ai", content: response.content });

      const msgId = `ai-${Date.now()}`;
      const aiMsg: ChatMessage = { id: msgId, role: "ai", content: response.content };
      setMessages((prev) => [...prev, aiMsg]);
      setPrepHasAiReply(true);

      await applyTaskActions(response);

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
    [applyTaskActions],
  );

  const sendPrepMessage = useCallback(
    (text: string, mode: "daily" | "weekly" | "daily_review" | "weekly_review" = "daily") => {
      if (isTyping) return;

      prepHistory.current.push({ role: "user", content: text });

      const userMsg: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setError(null);
      setIsTyping(true);

      const sendFn = (mode === "weekly" || mode === "weekly_review") ? sendWeeklyPrepMessage : sendDailyPrepMessage;
      sendFn(text, prepHistory.current.slice(0, -1))
        .then((response) => {
          setIsTyping(false);
          handlePrepResponse(response);
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
          setError(errMsg);
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
  }, [isTyping, sendPrepMessage]);

  const startWeeklyPrep = useCallback(() => {
    if (isTyping) return;
    setPrepMode("weekly");
    setPrepHasAiReply(false);
    pendingPrepExit.current = null;
    prepHistory.current = [];
    textareaRef.current?.focus();
    sendPrepMessage("C'est parti ! Fais-moi un résumé de ce qui est prévu pour cette semaine, et on organise ensemble.", "weekly");
  }, [isTyping, sendPrepMessage]);

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
        setError(typeof err === "string" ? err : String(err));
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
        setError(typeof err === "string" ? err : String(err));
      });
  }, [input, isTyping, prepMode, onStartOnboarding, startDailyPrep, startWeeklyPrep, sendPrepMessage, resetInput, handleChatResponse]);

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
            {{ daily: "Finir le planning du jour", weekly: "Finir le planning de la semaine", daily_review: "Finir la revue du jour", weekly_review: "Finir la revue de la semaine" }[prepMode]}
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
