import { useState, useRef, useEffect, useCallback } from "react";
import type { TodoItem, TodoPriority } from "../types";
import TodoItemRow from "./TodoItemRow";
import * as todoService from "../services/todos";
import styles from "./TodoView.module.css";

type Filter = "all" | "done" | "ai" | "prioritized" | "unscheduled";
type PopoverType = "priority" | "schedule";

interface PopoverState {
  todoId: string;
  type: PopoverType;
}

export default function TodoView() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newText, setNewText] = useState("");

  useEffect(() => {
    todoService.getTodos()
      .then(setTodos)
      .catch((err) => console.error("[TodoView] getTodos error:", err));
  }, []);
  const [filter, setFilter] = useState<Filter>("all");
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

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

  const addTodo = () => {
    const text = newText.trim();
    if (!text) return;
    setNewText("");
    todoService.createTodo({ text })
      .then((todo) => {
        setTodos((prev) => [todo, ...prev]);
      })
      .catch((err) => console.error("[TodoView] createTodo error:", err));
  };

  const toggleDone = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    todoService.toggleTodo(id);
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    todoService.deleteTodo(id);
  };

  const startEditing = (id: string, currentText: string) => {
    setEditingId(id);
    setEditText(currentText);
  };

  const confirmEdit = () => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (trimmed) {
      setTodos((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, text: trimmed } : t))
      );
      todoService.updateTodo({ id: editingId, text: trimmed });
    }
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const setPriority = (
    id: string,
    field: "urgency" | "importance",
    value: TodoPriority | undefined
  ) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
    todoService.updateTodo({ id, [field]: value ?? null });
  };

  const setScheduledDate = (id: string, date: string | undefined) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, scheduledDate: date } : t))
    );
    todoService.updateTodo({ id, scheduledDate: date });
  };

  const openPopover = (todoId: string, type: PopoverType) => {
    setPopover((prev) =>
      prev?.todoId === todoId && prev.type === type ? null : { todoId, type }
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

      setTodos((prev) => {
        const arr = [...prev];
        const fromIdx = arr.findIndex((t) => t.id === draggedId);
        if (fromIdx === -1) return prev;
        const [moved] = arr.splice(fromIdx, 1);
        let toIdx = arr.findIndex((t) => t.id === dragOverId);
        if (toIdx === -1) return prev;
        if (dragOverSide === "bottom") toIdx += 1;
        arr.splice(toIdx, 0, moved);
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

  const filtered = todos.filter((t) => {
    switch (filter) {
      case "done":
        return t.done;
      case "ai":
        return t.source === "ai" && !t.done;
      case "prioritized":
        return (t.urgency !== undefined || t.importance !== undefined) && !t.done;
      case "unscheduled":
        return !t.scheduledDate && !t.done;
      default:
        return !t.done;
    }
  });

  const totalActive = todos.filter((t) => !t.done).length;
  const totalDone = todos.filter((t) => t.done).length;
  const totalAI = todos.filter((t) => t.source === "ai").length;
  const totalUnscheduled = todos.filter((t) => !t.scheduledDate && !t.done).length;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "unscheduled", label: "Non planifiés" },
    { key: "prioritized", label: "Avec priorité" },
    { key: "ai", label: "Via IA" },
    { key: "done", label: `Terminés (${totalDone})` },
  ];

  const renderTodoList = (items: TodoItem[]) => (
    <div className={styles.todoList}>
      {items.map((todo) => (
        <TodoItemRow
          key={todo.id}
          todo={todo}
          onToggle={toggleDone}
          onDelete={deleteTodo}
          onSetPriority={setPriority}
          onSetScheduledDate={setScheduledDate}
          activePopover={popover?.todoId === todo.id ? popover.type : null}
          onOpenPopover={openPopover}
          popoverRef={popover?.todoId === todo.id ? popoverRef : undefined}
          isEditing={editingId === todo.id}
          editText={editingId === todo.id ? editText : ""}
          onStartEdit={startEditing}
          onEditChange={setEditText}
          onConfirmEdit={confirmEdit}
          onCancelEdit={cancelEdit}
          isDragging={draggedId === todo.id}
          isDragOver={dragOverId === todo.id && draggedId !== todo.id}
          dragOverSide={dragOverId === todo.id ? dragOverSide : undefined}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
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
          Capture rapide — note tes idées, tâches et rappels. L'IA peut aussi en ajouter.
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
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="Ajouter un todo…"
          />
          <button className={styles.addBtn} onClick={addTodo}>
            Ajouter
          </button>
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
              {showDone ? "Aucun todo terminé" : "Rien ici"}
            </div>
            <div className={styles.emptyText}>
              {filter === "all"
                ? "Ajoute ton premier todo pour commencer."
                : filter === "done"
                  ? "Les todos que tu termines apparaîtront ici."
                  : "Aucun todo ne correspond à ce filtre."}
            </div>
          </div>
        ) : (
          renderTodoList(filtered)
        )}
      </div>
    </div>
  );
}
