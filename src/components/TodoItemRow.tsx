import { useRef, useEffect } from "react";
import type { Task } from "../types";
import { formatScheduledDate, formatQuickDateHint, getQuickDates } from "../utils/dateFormat";
import PriorityBadge from "./PriorityBadge";
import styles from "./TodoView.module.css";

type PopoverType = "priority" | "schedule";

type PriorityScore = 1 | 2 | 3 | 4 | 5;

export interface TodoItemRowProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSetPriority: (id: string, field: "urgency" | "importance", value: PriorityScore | undefined) => void;
  onSetScheduledDate: (id: string, date: string | undefined) => void;
  activePopover: PopoverType | null;
  onOpenPopover: (taskId: string, type: PopoverType) => void;
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
  task,
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
    task.done ? styles.done : "",
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
        onDragStart(task.id);
      }}
      onDragOver={(e) => onDragOver(e, task.id)}
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
        className={`${styles.checkbox} ${task.done ? styles.checked : ""}`}
        onClick={() => onToggle(task.id)}
      >
        {task.done && (
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
            onDoubleClick={() => onStartEdit(task.id, task.name)}
          >
            {task.name}
          </div>
        )}
        <div className={styles.todoMeta}>
          {task.urgency != null && (
            <PriorityBadge
              type="urgency"
              score={task.urgency}
              onChange={(v) => onSetPriority(task.id, "urgency", v)}
            />
          )}
          {task.importance != null && (
            <PriorityBadge
              type="importance"
              score={task.importance}
              onChange={(v) => onSetPriority(task.id, "importance", v)}
            />
          )}
          {task.tags && task.tags.length > 0 && task.tags.map((tag) => (
            <span key={tag.label} className={`${styles.badge} ${styles.aiBadge}`}>
              {tag.label}
            </span>
          ))}
          {task.aiDecomposed && (
            <span className={`${styles.badge} ${styles.aiBadge}`}>
              🤖 IA
            </span>
          )}
          {task.scheduledDate ? (
            <button
              className={`${styles.badge} ${styles.scheduledBadge} ${styles.badgeClickable}`}
              onClick={() => onOpenPopover(task.id, "schedule")}
            >
              📅 {formatScheduledDate(task.scheduledDate)}
            </button>
          ) : (
            !task.done && (
              <button
                className={`${styles.badge} ${styles.unscheduledBadge} ${styles.badgeClickable}`}
                onClick={() => onOpenPopover(task.id, "schedule")}
              >
                Non planifié
              </button>
            )
          )}
          {task.estimatedMinutes && (
            <span className={styles.dateBadge}>{task.estimatedMinutes} min</span>
          )}
        </div>
      </div>

      <div className={styles.todoActions}>
        <div style={{ position: "relative" }}>
          <button
            className={`${styles.actionBtn} ${activePopover === "schedule" ? styles.actionBtnActive : ""} ${!task.scheduledDate && !task.done ? styles.actionBtnWarn : ""}`}
            onClick={() => onOpenPopover(task.id, "schedule")}
            title="Planifier"
          >
            📅
          </button>
          {activePopover === "schedule" && (
            <div className={styles.popover} ref={popoverRef}>
              <div className={styles.popoverLabel}>Planifier</div>
              <div className={styles.scheduleOptions}>
                <button
                  className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.today ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(task.id, quickDates.today)}
                >
                  <span className={styles.scheduleOptionIcon}>☀️</span>
                  <span className={styles.scheduleOptionText}>Aujourd'hui</span>
                </button>
                <button
                  className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.tomorrow ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(task.id, quickDates.tomorrow)}
                >
                  <span className={styles.scheduleOptionIcon}>→</span>
                  <span className={styles.scheduleOptionText}>Demain</span>
                </button>
              </div>
              <div className={styles.popoverDivider} />
              <div className={styles.popoverLabel}>Début de semaine</div>
              <div className={styles.scheduleOptions}>
                <button
                  className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.nextMonday ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(task.id, quickDates.nextMonday)}
                >
                  <span className={styles.scheduleOptionIcon}>📆</span>
                  <span className={styles.scheduleOptionText}>
                    Semaine prochaine
                    <span className={styles.scheduleOptionHint}>{formatQuickDateHint(quickDates.nextMonday)}</span>
                  </span>
                </button>
                <button
                  className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.twoWeeksMonday ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(task.id, quickDates.twoWeeksMonday)}
                >
                  <span className={styles.scheduleOptionIcon}>⏩</span>
                  <span className={styles.scheduleOptionText}>
                    Dans 2 semaines
                    <span className={styles.scheduleOptionHint}>{formatQuickDateHint(quickDates.twoWeeksMonday)}</span>
                  </span>
                </button>
                <button
                  className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.oneMonthMonday ? styles.selected : ""}`}
                  onClick={() => onSetScheduledDate(task.id, quickDates.oneMonthMonday)}
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
                value={task.scheduledDate ?? ""}
                onChange={(e) =>
                  onSetScheduledDate(task.id, e.target.value || undefined)
                }
              />
              {task.scheduledDate && (
                <>
                  <div className={styles.popoverDivider} />
                  <button
                    className={styles.popoverClear}
                    onClick={() => onSetScheduledDate(task.id, undefined)}
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
          onClick={() => onDelete(task.id)}
          title="Supprimer"
        >
          ×
        </button>
      </div>
    </div>
  );
}
