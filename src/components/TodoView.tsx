import { useState, useRef, useEffect, useCallback } from "react";
import type { Task, Tag } from "../types";
import TodoItemRow from "./TodoItemRow";
import TaskDetailModal from "./TaskDetailModal";
import { getAllTasks, createTask, toggleTask as toggleTaskSvc, deleteTask as deleteTaskSvc, updateTask as updateTaskSvc, reorderTasks, setTaskTags } from "../services/tasks";
import styles from "./TodoView.module.css";

type Filter = "all" | "done" | "ai" | "prioritized" | "unscheduled";
type PopoverType = "priority" | "schedule";

interface PopoverState {
  taskId: string;
  type: PopoverType;
}

export default function TodoView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newText, setNewText] = useState("");

  useEffect(() => {
    getAllTasks()
      .then(setTasks)
      .catch((err) => console.error("[TodoView] getAllTasks error:", err));
  }, []);

  const [filter, setFilter] = useState<Filter>("all");
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverSide, setDragOverSide] = useState<"top" | "bottom">("bottom");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addTask = () => {
    const text = newText.trim();
    if (!text) return;
    setNewText("");
    createTask({ name: text })
      .then((task) => {
        setTasks((prev) => [task, ...prev]);
      })
      .catch((err) => console.error("[TodoView] createTask error:", err));
  };

  const toggleDone = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    toggleTaskSvc(id).catch((err) => console.error("[TodoView] toggleTask error:", err));
  };

  const deleteItem = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteTaskSvc(id).catch((err) => console.error("[TodoView] deleteTask error:", err));
  };

  const startEditing = (id: string, currentText: string) => {
    setEditingId(id);
    setEditText(currentText);
  };

  const confirmEdit = () => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (trimmed) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, name: trimmed } : t))
      );
      updateTaskSvc({ id: editingId, name: trimmed }).catch((err) =>
        console.error("[TodoView] updateTask error:", err)
      );
    }
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const setPriority = (id: string, field: "urgency" | "importance", value: number | undefined) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
    updateTaskSvc({ id, [field]: value ?? 0 }).catch((err) =>
      console.error("[TodoView] updateTask error:", err)
    );
  };

  const setScheduledDate = (id: string, date: string | undefined) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, scheduledDate: date } : t))
    );
    updateTaskSvc({ id, scheduledDate: date ?? "" }).catch((err) =>
      console.error("[TodoView] updateTask error:", err)
    );
  };

  const openPopover = (taskId: string, type: PopoverType) => {
    setPopover((prev) =>
      prev?.taskId === taskId && prev.type === type ? null : { taskId, type }
    );
  };

  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault();
      if (id === draggedId) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDragOverSide(e.clientY < midY ? "top" : "bottom");
      setDragOverId(id);
    },
    [draggedId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedId || !dragOverId || draggedId === dragOverId) {
        setDraggedId(null);
        setDragOverId(null);
        return;
      }

      setTasks((prev) => {
        const arr = [...prev];
        const fromIdx = arr.findIndex((t) => t.id === draggedId);
        if (fromIdx === -1) return prev;
        const [moved] = arr.splice(fromIdx, 1);
        let toIdx = arr.findIndex((t) => t.id === dragOverId);
        if (toIdx === -1) return prev;
        if (dragOverSide === "bottom") toIdx += 1;
        arr.splice(toIdx, 0, moved);
        reorderTasks(arr.map((t) => t.id)).catch(() => {});
        return arr;
      });

      setDraggedId(null);
      setDragOverId(null);
    },
    [draggedId, dragOverId, dragOverSide]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const showDone = filter === "done";

  const filtered = tasks.filter((t) => {
    const matchesFilter = (() => {
      switch (filter) {
        case "done":
          return t.done;
        case "ai":
          return t.aiDecomposed && !t.done;
        case "prioritized":
          return (t.urgency != null || t.importance != null) && !t.done;
        case "unscheduled":
          return !t.scheduledDate && !t.done;
        default:
          return !t.done;
      }
    })();
    if (!matchesFilter) return false;
    if (!searchQuery.trim()) return true;
    return t.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const totalActive = tasks.filter((t) => !t.done).length;
  const totalDone = tasks.filter((t) => t.done).length;
  const totalAI = tasks.filter((t) => t.aiDecomposed).length;
  const totalUnscheduled = tasks.filter((t) => !t.scheduledDate && !t.done).length;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "unscheduled", label: "Non planifiés" },
    { key: "prioritized", label: "Avec priorité" },
    { key: "ai", label: "Via IA" },
    { key: "done", label: `Terminés (${totalDone})` },
  ];

  const handleTaskUpdated = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
  }, []);

  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) : null;

  const renderTaskList = (items: Task[]) => (
    <div className={styles.todoList}>
      {items.map((task) => (
        <TodoItemRow
          key={task.id}
          task={task}
          onToggle={toggleDone}
          onDelete={deleteItem}
          onSetPriority={setPriority}
          onSetScheduledDate={setScheduledDate}
          activePopover={popover?.taskId === task.id ? popover.type : null}
          onOpenPopover={openPopover}
          popoverRef={popover?.taskId === task.id ? popoverRef : undefined}
          isEditing={editingId === task.id}
          editText={editingId === task.id ? editText : ""}
          onStartEdit={startEditing}
          onEditChange={setEditText}
          onConfirmEdit={confirmEdit}
          onCancelEdit={cancelEdit}
          isDragging={draggedId === task.id}
          isDragOver={dragOverId === task.id && draggedId !== task.id}
          dragOverSide={dragOverId === task.id ? dragOverSide : undefined}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onOpenDetail={setDetailTaskId}
        />
      ))}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>📝</span>
          ToDo
        </div>
        <div className={styles.subtitle}>
          Toutes tes tâches au même endroit — planifie, priorise et avance.
        </div>
        <div className={styles.statsRow}>
          <span className={styles.stat}>
            <strong>{totalActive}</strong> à faire
          </span>
          <span className={styles.stat}>
            <strong>{totalDone}</strong> terminé{totalDone > 1 ? "s" : ""}
          </span>
          <span className={styles.stat}>
            <strong>{totalAI}</strong> via IA
          </span>
          {totalUnscheduled > 0 && (
            <span className={styles.stat}>
              <strong>{totalUnscheduled}</strong> non planifié{totalUnscheduled > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.addArea}>
          <input
            className={styles.addInput}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Ajouter une tâche…"
          />
          <button className={styles.addBtn} onClick={addTask}>
            Ajouter
          </button>
        </div>

        <div className={styles.searchArea}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une tâche…"
          />
          {searchQuery && (
            <button
              className={styles.searchClear}
              onClick={() => setSearchQuery("")}
              aria-label="Effacer la recherche"
            >
              ×
            </button>
          )}
        </div>

        <div className={styles.filters}>
          {filters.map((f) => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.active : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>{showDone ? "🎉" : "✨"}</div>
            <div className={styles.emptyTitle}>
              {searchQuery.trim()
                ? "Aucun résultat"
                : showDone ? "Aucune tâche terminée" : "Rien ici"}
            </div>
            <div className={styles.emptyText}>
              {searchQuery.trim()
                ? `Aucune tâche ne correspond à « ${searchQuery.trim()} ».`
                : filter === "all"
                  ? "Ajoute ta première tâche pour commencer."
                  : filter === "done"
                    ? "Les tâches que tu termines apparaîtront ici."
                    : "Aucune tâche ne correspond à ce filtre."}
            </div>
          </div>
        ) : (
          renderTaskList(filtered)
        )}
      </div>

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
          onToggle={toggleDone}
          onRename={(id, name) => {
            setTasks((prev) => prev.map((t) => t.id === id ? { ...t, name } : t));
            updateTaskSvc({ id, name }).catch(() => {});
          }}
          onSetPriority={setPriority}
          onSetScheduledDate={setScheduledDate}
          onDelete={(id) => { deleteItem(id); setDetailTaskId(null); }}
          onSetTags={(id: string, tags: Tag[]) => {
            setTasks((prev) => prev.map((t) => t.id === id ? { ...t, tags } : t));
            setTaskTags(id, tags).catch(() => {});
          }}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
}
