import { useRef, useEffect } from "react";
import type { TodoItem, TodoPriority } from "../types";
import { formatScheduledDate, formatDate, formatQuickDateHint, getQuickDates } from "../utils/dateFormat";
import styles from "./TodoView.module.css";

type PopoverType = "priority" | "schedule";

function urgencyLabel(v: TodoPriority): string {
  return `U${v}`;
}

function importanceLabel(v: TodoPriority): string {
  return `I${v}`;
}

export interface TodoItemRowProps {
  todo: TodoItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSetPriority: (
    id: string,
    field: "urgency" | "importance",
    value: TodoPriority | undefined
  ) => void;
  onSetScheduledDate: (id: string, date: string | undefined) => void;
  activePopover: PopoverType | null;
  onOpenPopover: (todoId: string, type: PopoverType) => void;
  popoverRef?: React.Ref<HTMLDivElement>;
  isEditing: boolean;
  editText: string;
  onStartEdit: (id: string, currentText: string) => void;
  onEditChange: (text: string) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  isDragging: boolean;
  isDragOver: boolean;
  dragOverSide?: "top" | "bottom";
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export default function TodoItemRow({
  todo,
  onToggle,
  onDelete,
  onSetPriority,
  onSetScheduledDate,
  activePopover,
  onOpenPopover,
  popoverRef,
  isEditing,
  editText,
  onStartEdit,
  onEditChange,
  onConfirmEdit,
  onCancelEdit,
  isDragging,
  isDragOver,
  dragOverSide,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TodoItemRowProps) {
  const editRef = useRef<HTMLTextAreaElement>(null);
  const quickDates = getQuickDates();

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  const itemClasses = [
    styles.todoItem,
    todo.done ? styles.done : "",
    isDragging ? styles.dragging : "",
    isDragOver && dragOverSide === "top" ? styles.dragOverTop : "",
    isDragOver && dragOverSide === "bottom" ? styles.dragOverBottom : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={itemClasses}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(todo.id);
      }}
      onDragOver={(e) => onDragOver(e, todo.id)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className={styles.dragHandle} title="Glisser pour réorganiser">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </div>

      <button
        className={`${styles.checkbox} ${todo.done ? styles.checked : ""}`}
        onClick={() => onToggle(todo.id)}
      >
        {todo.done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div className={styles.todoBody}>
        {isEditing ? (
          <textarea
            ref={editRef}
            className={styles.editInput}
            value={editText}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onConfirmEdit();
              }
              if (e.key === "Escape") {
                onCancelEdit();
              }
            }}
            onBlur={onConfirmEdit}
            rows={1}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
          />
        ) : (
          <div
            className={styles.todoText}
            onDoubleClick={() => onStartEdit(todo.id, todo.text)}
          >
            {todo.text}
          </div>
        )}
        <div className={styles.todoMeta}>
          {todo.urgency ? (
            <button
              className={`${styles.badge} ${styles.urgencyBadge} ${styles.badgeClickable}`}
              onClick={() => onOpenPopover(todo.id, "priority")}
            >
              🔥 {urgencyLabel(todo.urgency)}
            </button>
          ) : null}
          {todo.importance ? (
            <button
              className={`${styles.badge} ${styles.importanceBadge} ${styles.badgeClickable}`}
              onClick={() => onOpenPopover(todo.id, "priority")}
            >
              ⭐ {importanceLabel(todo.importance)}
            </button>
          ) : null}
          {todo.source === "ai" && (
            <span className={`${styles.badge} ${styles.aiBadge}`}>
              🤖 IA
            </span>
          )}
          {todo.scheduledDate ? (
            <button
              className={`${styles.badge} ${styles.scheduledBadge} ${styles.badgeClickable}`}
              onClick={() => onOpenPopover(todo.id, "schedule")}
            >
              📅 {formatScheduledDate(todo.scheduledDate)}
            </button>
          ) : (
            !todo.done && (
              <button
                className={`${styles.badge} ${styles.unscheduledBadge} ${styles.badgeClickable}`}
                onClick={() => onOpenPopover(todo.id, "schedule")}
              >
                Non planifié
              </button>
            )
          )}
          <span className={styles.dateBadge}>{formatDate(todo.createdAt)}</span>
        </div>
      </div>

      <div className={styles.todoActions}>
        <div style={{ position: "relative" }}>
          <button
            className={`${styles.actionBtn} ${activePopover === "priority" ? styles.actionBtnActive : ""}`}
            onClick={() => onOpenPopover(todo.id, "priority")}
            title="Urgence & importance"
          >
            ◆
          </button>
          {activePopover === "priority" && (
            <div className={styles.popover} ref={popoverRef}>
              <div className={styles.popoverLabel}>Urgence</div>
              <div className={styles.popoverRow}>
                {([1, 2, 3, 4, 5] as TodoPriority[]).map((v) => (
                  <button
                    key={`u${v}`}
                    className={`${styles.popoverDot} ${todo.urgency === v ? styles.selected : ""}`}
                    onClick={() =>
                      onSetPriority(todo.id, "urgency", todo.urgency === v ? undefined : v)
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className={styles.popoverLabel}>Importance</div>
              <div className={styles.popoverRow}>
                {([1, 2, 3, 4, 5] as TodoPriority[]).map((v) => (
                  <button
                    key={`i${v}`}
                    className={`${styles.popoverDot} ${todo.importance === v ? styles.selected : ""}`}
                    onClick={() =>
                      onSetPriority(todo.id, "importance", todo.importance === v ? undefined : v)
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                className={styles.popoverClear}
                onClick={() => {
                  onSetPriority(todo.id, "urgency", undefined);
                  onSetPriority(todo.id, "importance", undefined);
                }}
              >
                Retirer les priorités
              </button>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <button
            className={`${styles.actionBtn} ${activePopover === "schedule" ? styles.actionBtnActive : ""} ${!todo.scheduledDate && !todo.done ? styles.actionBtnWarn : ""}`}
            onClick={() => onOpenPopover(todo.id, "schedule")}
            title="Planifier"
          >
            📅
          </button>
          {activePopover === "schedule" && (
            <div className={styles.popover} ref={popoverRef}>
              <div className={styles.popoverLabel}>Planifier</div>
              <div className={styles.scheduleOptions}>
                <button
                  className={`${styles.scheduleOption} ${todo.scheduledDate === quickDates.today ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(todo.id, quickDates.today)}
                >
                  <span className={styles.scheduleOptionIcon}>☀️</span>
                  <span className={styles.scheduleOptionText}>Aujourd'hui</span>
                </button>
                <button
                  className={`${styles.scheduleOption} ${todo.scheduledDate === quickDates.tomorrow ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(todo.id, quickDates.tomorrow)}
                >
                  <span className={styles.scheduleOptionIcon}>→</span>
                  <span className={styles.scheduleOptionText}>Demain</span>
                </button>
              </div>
              <div className={styles.popoverDivider} />
              <div className={styles.popoverLabel}>Début de semaine</div>
              <div className={styles.scheduleOptions}>
                <button
                  className={`${styles.scheduleOption} ${todo.scheduledDate === quickDates.nextMonday ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(todo.id, quickDates.nextMonday)}
                >
                  <span className={styles.scheduleOptionIcon}>📆</span>
                  <span className={styles.scheduleOptionText}>
                    Semaine prochaine
                    <span className={styles.scheduleOptionHint}>{formatQuickDateHint(quickDates.nextMonday)}</span>
                  </span>
                </button>
                <button
                  className={`${styles.scheduleOption} ${todo.scheduledDate === quickDates.twoWeeksMonday ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(todo.id, quickDates.twoWeeksMonday)}
                >
                  <span className={styles.scheduleOptionIcon}>⏩</span>
                  <span className={styles.scheduleOptionText}>
                    Dans 2 semaines
                    <span className={styles.scheduleOptionHint}>{formatQuickDateHint(quickDates.twoWeeksMonday)}</span>
                  </span>
                </button>
                <button
                  className={`${styles.scheduleOption} ${todo.scheduledDate === quickDates.oneMonthMonday ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(todo.id, quickDates.oneMonthMonday)}
                >
                  <span className={styles.scheduleOptionIcon}>📅</span>
                  <span className={styles.scheduleOptionText}>
                    Dans 1 mois
                    <span className={styles.scheduleOptionHint}>{formatQuickDateHint(quickDates.oneMonthMonday)}</span>
                  </span>
                </button>
              </div>
              <div className={styles.popoverDivider} />
              <div className={styles.popoverLabel}>Date précise</div>
              <input
                type="date"
                className={styles.dateInput}
                value={todo.scheduledDate ?? ""}
                onChange={(e) =>
                  onSetScheduledDate(todo.id, e.target.value || undefined)
                }
              />
              {todo.scheduledDate && (
                <>
                  <div className={styles.popoverDivider} />
                  <button
                    className={styles.popoverClear}
                    onClick={() => onSetScheduledDate(todo.id, undefined)}
                  >
                    Retirer la planification
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <button
          className={styles.deleteBtn}
          onClick={() => onDelete(todo.id)}
          title="Supprimer"
        >
          ×
        </button>
      </div>
    </div>
  );
}
