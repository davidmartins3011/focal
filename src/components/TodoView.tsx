import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, Tag, PopoverType } from "../types";
import AddTaskInput from "./AddTaskInput";
import TodoItemRow from "./TodoItemRow";
import TaskDetailModal from "./TaskDetailModal";
import CalendarView from "./CalendarView";
import { getAllTasks, createTask, toggleTask as toggleTaskSvc, deleteTask as deleteTaskSvc, updateTask as updateTaskSvc, reorderTasks, setTaskTags } from "../services/tasks";
import useStrategies from "../hooks/useStrategies";
import styles from "./TodoView.module.css";

type ViewMode = "list" | "calendar";
type Filter = "all" | "done" | "tag" | "strategy";
function SortableTodoItemRow(props: React.ComponentProps<typeof TodoItemRow>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TodoItemRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

interface PopoverState {
  taskId: string;
  type: PopoverType;
}

export default function TodoView() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [tasks, setTasks] = useState<Task[]>([]);

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
  const [strategyFilter, setStrategyFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { getStrategyInfo, pickerObjectives } = useStrategies();

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleAddTask = useCallback((text: string) => {
    createTask({ name: text })
      .then((task) => {
        setTasks((prev) => [task, ...prev]);
      })
      .catch((err) => console.error("[TodoView] createTask error:", err));
  }, []);

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    setTasks((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id);
      const newIndex = prev.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      reorderTasks(reordered.map((t) => t.id)).catch(() => {});
      return reordered;
    });
  }, []);

  const showDone = filter === "done";

  const availableTags = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.done);
    const tagMap = new Map<string, number>();
    for (const t of activeTasks) {
      if (t.tags) {
        for (const tag of t.tags) {
          tagMap.set(tag.label, (tagMap.get(tag.label) ?? 0) + 1);
        }
      }
    }
    return Array.from(tagMap.entries()).map(([label, count]) => ({ label, count }));
  }, [tasks]);

  const availableStrategies = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.done && t.strategyId);
    const idSet = new Set(activeTasks.map((t) => t.strategyId!));
    const options: { id: string; label: string; count: number }[] = [];
    for (const obj of pickerObjectives) {
      if (idSet.has(obj.id)) {
        const count = activeTasks.filter((t) => t.strategyId === obj.id).length;
        options.push({ id: obj.id, label: obj.title, count });
      }
      for (const s of obj.strategies) {
        if (idSet.has(s.id)) {
          const count = activeTasks.filter((t) => t.strategyId === s.id).length;
          options.push({ id: s.id, label: `${obj.title} → ${s.title}`, count });
        }
      }
    }
    return options;
  }, [tasks, pickerObjectives]);

  const doneStrategyOptions = useMemo(() => {
    if (!showDone) return [];
    const doneTasks = tasks.filter((t) => t.done && t.strategyId);
    const idSet = new Set(doneTasks.map((t) => t.strategyId!));
    const options: { id: string; label: string; count: number }[] = [];
    for (const obj of pickerObjectives) {
      if (idSet.has(obj.id)) {
        const count = doneTasks.filter((t) => t.strategyId === obj.id).length;
        options.push({ id: obj.id, label: obj.title, count });
      }
      for (const s of obj.strategies) {
        if (idSet.has(s.id)) {
          const count = doneTasks.filter((t) => t.strategyId === s.id).length;
          options.push({ id: s.id, label: `${obj.title} → ${s.title}`, count });
        }
      }
    }
    return options;
  }, [showDone, tasks, pickerObjectives]);

  const filtered = tasks.filter((t) => {
    const matchesBase = (() => {
      switch (filter) {
        case "done":
          return t.done;
        case "tag":
        case "strategy":
        case "all":
        default:
          return !t.done;
      }
    })();
    if (!matchesBase) return false;
    if (filter === "tag" && tagFilter) {
      if (!t.tags?.some((tag) => tag.label === tagFilter)) return false;
    }
    if (filter === "strategy" && strategyFilter) {
      const info = getStrategyInfo(t.strategyId);
      if (strategyFilter === "__none__") {
        if (t.strategyId) return false;
      } else {
        if (t.strategyId !== strategyFilter && info?.objectiveId !== strategyFilter) return false;
      }
    }
    if (showDone && strategyFilter) {
      const info = getStrategyInfo(t.strategyId);
      if (strategyFilter === "__none__") {
        if (t.strategyId) return false;
      } else {
        if (t.strategyId !== strategyFilter && info?.objectiveId !== strategyFilter) return false;
      }
    }
    if (!searchQuery.trim()) return true;
    return t.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const totalActive = tasks.filter((t) => !t.done).length;
  const totalDone = tasks.filter((t) => t.done).length;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "tag", label: "Tags" },
    { key: "strategy", label: "Objectifs / Stratégies" },
    { key: "done", label: `Terminés (${totalDone})` },
  ];

  const handleTaskUpdated = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
  }, []);

  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) : null;
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const renderTaskList = (items: Task[]) => (
    <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <div className={styles.todoList}>
        {items.map((task) => (
          <SortableTodoItemRow
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
            onOpenDetail={setDetailTaskId}
          />
        ))}
      </div>
    </SortableContext>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.title}>
            <span className={styles.titleIcon}>📝</span>
            ToDo
          </div>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === "list" ? styles.viewToggleActive : ""}`}
              onClick={() => setViewMode("list")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Liste
            </button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === "calendar" ? styles.viewToggleActive : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Calendrier
            </button>
          </div>
        </div>
        {viewMode === "list" && (
          <>
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
            </div>
          </>
        )}
      </div>

      {viewMode === "list" ? (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(e.active.id as string)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className={styles.content}>
              <AddTaskInput onAdd={handleAddTask} />

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
                    onClick={() => { setFilter(f.key); setStrategyFilter(null); setTagFilter(null); }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filter === "tag" && availableTags.length > 0 && (
                <div className={styles.strategyFilters}>
                  <button
                    className={`${styles.strategyFilterBtn} ${tagFilter === null ? styles.strategyFilterActive : ""}`}
                    onClick={() => setTagFilter(null)}
                  >
                    Tous
                  </button>
                  {availableTags.map((t) => (
                    <button
                      key={t.label}
                      className={`${styles.strategyFilterBtn} ${tagFilter === t.label ? styles.strategyFilterActive : ""}`}
                      onClick={() => setTagFilter(t.label)}
                    >
                      {t.label} <span className={styles.strategyFilterCount}>{t.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {filter === "strategy" && availableStrategies.length > 0 && (
                <div className={styles.strategyFilters}>
                  <button
                    className={`${styles.strategyFilterBtn} ${strategyFilter === null ? styles.strategyFilterActive : ""}`}
                    onClick={() => setStrategyFilter(null)}
                  >
                    Tous
                  </button>
                  {availableStrategies.map((opt) => (
                    <button
                      key={opt.id}
                      className={`${styles.strategyFilterBtn} ${strategyFilter === opt.id ? styles.strategyFilterActive : ""}`}
                      onClick={() => setStrategyFilter(opt.id)}
                    >
                      {opt.label} <span className={styles.strategyFilterCount}>{opt.count}</span>
                    </button>
                  ))}
                  <button
                    className={`${styles.strategyFilterBtn} ${strategyFilter === "__none__" ? styles.strategyFilterActive : ""}`}
                    onClick={() => setStrategyFilter("__none__")}
                  >
                    Sans objectif
                  </button>
                </div>
              )}

              {showDone && doneStrategyOptions.length > 0 && (
                <div className={styles.strategyFilters}>
                  <span className={styles.strategyFiltersLabel}>🧭 Filtrer par :</span>
                  <button
                    className={`${styles.strategyFilterBtn} ${strategyFilter === null ? styles.strategyFilterActive : ""}`}
                    onClick={() => setStrategyFilter(null)}
                  >
                    Tous
                  </button>
                  {doneStrategyOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className={`${styles.strategyFilterBtn} ${strategyFilter === opt.id ? styles.strategyFilterActive : ""}`}
                      onClick={() => setStrategyFilter(opt.id)}
                    >
                      {opt.label} <span className={styles.strategyFilterCount}>{opt.count}</span>
                    </button>
                  ))}
                  <button
                    className={`${styles.strategyFilterBtn} ${strategyFilter === "__none__" ? styles.strategyFilterActive : ""}`}
                    onClick={() => setStrategyFilter("__none__")}
                  >
                    Sans stratégie
                  </button>
                </div>
              )}

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

            <DragOverlay>
              {activeTask && (
                <div className={styles.dragOverlay}>
                  <TodoItemRow
                    task={activeTask}
                    onToggle={() => {}}
                    onDelete={() => {}}
                    onSetPriority={() => {}}
                    onSetScheduledDate={() => {}}
                    activePopover={null}
                    onOpenPopover={() => {}}
                    isEditing={false}
                    editText=""
                    onStartEdit={() => {}}
                    onEditChange={() => {}}
                    onConfirmEdit={() => {}}
                    onCancelEdit={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>

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
        </>
      ) : (
        <CalendarView />
      )}
    </div>
  );
}
