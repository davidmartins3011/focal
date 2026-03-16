import { useState, useCallback } from "react";
import type { Task, MicroStep, Tag } from "../types";
import {
  toggleTask as toggleTaskSvc,
  toggleMicroStep as toggleStepSvc,
  deleteTask as deleteTaskSvc,
  updateTask as updateTaskSvc,
  setMicroSteps,
  setTaskTags,
} from "../services/tasks";
import { decomposeTask } from "../services/chat";
import { parseDecomposingStepId } from "../utils/taskUtils";

interface UseTaskActionsParams {
  tasks: Task[];
  overdueTasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setOverdueTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onStuck?: (taskId: string, taskName: string) => void;
  tag?: string;
}

export default function useTaskActions({
  tasks,
  overdueTasks,
  setTasks,
  setOverdueTasks,
  onStuck,
  tag = "TaskActions",
}: UseTaskActionsParams) {
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const [decomposingStepKey, setDecomposingStepKey] = useState<string | null>(null);
  const isBusy = !!decomposingId || !!decomposingStepKey;

  function updateTaskState(updater: (prev: Task[]) => Task[]) {
    setTasks(updater);
    setOverdueTasks(updater);
  }

  function findTask(taskId: string): Task | undefined {
    return tasks.find((t) => t.id === taskId) ?? overdueTasks.find((t) => t.id === taskId);
  }

  function toggleTask(id: string) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    toggleTaskSvc(id).catch((err) => console.error(`[${tag}] toggleTask error:`, err));
  }

  function toggleStep(taskId: string, stepId: string) {
    updateTaskState((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.microSteps) return t;
        return { ...t, microSteps: t.microSteps.map((s) => s.id === stepId ? { ...s, done: !s.done } : s) };
      }),
    );
    toggleStepSvc(stepId).catch((err) => console.error(`[${tag}] toggleStep error:`, err));
  }

  function deleteTask(id: string) {
    updateTaskState((prev) => prev.filter((t) => t.id !== id));
    deleteTaskSvc(id).catch((err) => console.error(`[${tag}] deleteTask error:`, err));
  }

  function setPriority(id: string, field: "urgency" | "importance", value: number | undefined) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    updateTaskSvc({ id, [field]: value ?? 0 }).catch((err) => console.error(`[${tag}] setPriority error:`, err));
  }

  function setTagsOnTask(id: string, tags: Tag[]) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, tags } : t)));
    setTaskTags(id, tags).catch((err) => console.error(`[${tag}] setTaskTags error:`, err));
  }

  function renameTask(id: string, name: string) {
    updateTaskState((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    updateTaskSvc({ id, name }).catch((err) => console.error(`[${tag}] renameTask error:`, err));
  }

  function updateEstimate(taskId: string, minutes: number | undefined) {
    updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, estimatedMinutes: minutes } : t));
    updateTaskSvc({ id: taskId, estimatedMinutes: minutes ?? 0 }).catch((err) => console.error(`[${tag}] updateEstimate error:`, err));
  }

  function updateStepEstimate(taskId: string, stepId: string, minutes: number | undefined) {
    const task = findTask(taskId);
    if (!task?.microSteps) return;
    const updated = task.microSteps.map((s) => s.id === stepId ? { ...s, estimatedMinutes: minutes } : s);
    updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, microSteps: updated } : t));
    setMicroSteps(taskId, updated).catch((err) => console.error(`[${tag}] updateStepEstimate error:`, err));
  }

  function editStep(taskId: string, stepId: string, text: string) {
    const task = findTask(taskId);
    if (!task?.microSteps) return;
    const updated = task.microSteps.map((s) => s.id === stepId ? { ...s, text } : s);
    updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, microSteps: updated } : t));
    setMicroSteps(taskId, updated).catch((err) => console.error(`[${tag}] editStep error:`, err));
  }

  function decompose(taskId: string, redo = false) {
    if (isBusy) return;
    const task = findTask(taskId);
    if (!task) return;
    if (redo) {
      updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, microSteps: undefined, aiDecomposed: false } : t));
    }
    setDecomposingId(taskId);
    decomposeTask(task.name)
      .then((result) => {
        const prefix = redo ? "rs" : "s";
        const steps = result.map((s, i) => ({
          id: `${taskId}-${prefix}${i}`,
          text: s.text,
          done: false,
          estimatedMinutes: s.estimatedMinutes,
        }));
        updateTaskState((prev) => prev.map((t) => t.id === taskId ? { ...t, microSteps: steps, aiDecomposed: true } : t));
        setMicroSteps(taskId, steps).catch(() => {});
        setTimeout(() => setDecomposingId(null), steps.length * 300 + 500);
      })
      .catch((err) => {
        console.error(`[${tag}] decompose error:`, err);
        setDecomposingId(null);
      });
  }

  function decomposeStep(taskId: string, stepId: string) {
    if (isBusy) return;
    const task = findTask(taskId);
    const step = task?.microSteps?.find((s) => s.id === stepId);
    if (!task || !step) return;
    setDecomposingStepKey(`${taskId}:${stepId}`);
    decomposeTask(step.text, `Sous-étape de la tâche "${task.name}"`)
      .then((result) => {
        const subSteps = result.map((s, i) => ({
          id: `${stepId}-sub${i}`,
          text: s.text,
          done: false,
          estimatedMinutes: s.estimatedMinutes,
        }));
        let finalSteps: MicroStep[] | undefined;
        updateTaskState((prev) =>
          prev.map((t) => {
            if (t.id !== taskId || !t.microSteps) return t;
            const idx = t.microSteps.findIndex((s) => s.id === stepId);
            if (idx === -1) return t;
            const newSteps = [...t.microSteps];
            newSteps.splice(idx, 1, ...subSteps);
            finalSteps = newSteps;
            return { ...t, microSteps: newSteps };
          }),
        );
        if (finalSteps) setMicroSteps(taskId, finalSteps).catch(() => {});
        setDecomposingStepKey(null);
      })
      .catch((err) => {
        console.error(`[${tag}] decomposeStep error:`, err);
        setDecomposingStepKey(null);
      });
  }

  function getDecomposingStepId(taskId: string): string | null {
    return parseDecomposingStepId(decomposingStepKey, taskId);
  }

  const handleStuck = useCallback((taskId: string) => {
    const allTasks = [...tasks, ...overdueTasks];
    const task = allTasks.find((t) => t.id === taskId);
    if (task && onStuck) onStuck(taskId, task.name);
  }, [tasks, overdueTasks, onStuck]);

  const handleTaskUpdated = useCallback((updated: Task) => {
    updateTaskState((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
  }, []);

  const taskCallbacks = {
    onToggle: toggleTask,
    onToggleStep: toggleStep,
    onDecompose: decompose,
    onRedecompose: (id: string) => decompose(id, true),
    onDecomposeStep: decomposeStep,
    onEditStep: editStep,
    onStuck: handleStuck,
    onUpdateEstimate: updateEstimate,
    onUpdateStepEstimate: updateStepEstimate,
    onDelete: deleteTask,
    onRename: renameTask,
    onSetPriority: setPriority,
    onSetTags: setTagsOnTask,
    onTaskUpdated: handleTaskUpdated,
  };

  return {
    decomposingId,
    isBusy,
    updateTaskState,
    findTask,
    getDecomposingStepId,
    taskCallbacks,
  };
}
