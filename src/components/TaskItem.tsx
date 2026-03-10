import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Task, Tag } from "../types";
import { getAllTags } from "../services/tasks";
import EditableEstimate from "./EditableEstimate";
import PriorityBadge from "./PriorityBadge";
import TaskDetailModal from "./TaskDetailModal";
import { getQuickDates, formatQuickDateHint } from "../utils/dateFormat";
import styles from "./TaskItem.module.css";

const TAG_COLORS = [
  { id: "crm" as const, label: "Vert", css: "var(--green)" },
  { id: "data" as const, label: "Bleu", css: "var(--blue)" },
  { id: "roadmap" as const, label: "Accent", css: "var(--accent)" },
  { id: "saas" as const, label: "Violet", css: "var(--purple)" },
  { id: "urgent" as const, label: "Rouge", css: "var(--red)" },
];

const CELEBRATIONS = [
  "Bien joué ! 🎯",
  "Un de moins 💪",
  "Tu avances ! 🚀",
  "Nice ! ✨",
  "Continue ! 🔥",
  "Bravo ! 🌟",
  "Écrasé ! 👊",
  "Yes ! 🙌",
];

type PriorityScore = 1 | 2 | 3 | 4 | 5;

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onToggleStep: (taskId: string, stepId: string) => void;
  onDecompose?: (id: string) => void;
  onRedecompose?: (id: string) => void;
  onDecomposeStep?: (taskId: string, stepId: string) => void;
  onEditStep?: (taskId: string, stepId: string, text: string) => void;
  onStuck?: (id: string) => void;
  onUpdateEstimate?: (taskId: string, minutes: number | undefined) => void;
  onUpdateStepEstimate?: (taskId: string, stepId: string, minutes: number | undefined) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onSetScheduledDate?: (id: string, date: string | undefined) => void;
  onSetPriority?: (id: string, field: "urgency" | "importance", value: PriorityScore | undefined) => void;
  onSetTags?: (id: string, tags: Tag[]) => void;
  isDecomposing?: boolean;
  decomposingStepId?: string | null;
  animDelay?: number;
  isSecondary?: boolean;
  isOverdue?: boolean;
  dragHandleProps?: Record<string, unknown>;
  isSelected?: boolean;
  hasRunningTimer?: boolean;
  onSelect?: (id: string) => void;
  onTaskUpdated?: (task: Task) => void;
}

export default function TaskItem({
  task,
  onToggle,
  onToggleStep,
  onDecompose,
  onRedecompose,
  onDecomposeStep,
  onEditStep,
  onStuck,
  onUpdateEstimate,
  onUpdateStepEstimate,
  onDelete,
  onRename,
  onSetScheduledDate,
  onSetPriority,
  onSetTags,
  isDecomposing = false,
  decomposingStepId = null,
  animDelay = 0,
  isSecondary = false,
  isOverdue = false,
  dragHandleProps,
  isSelected = false,
  hasRunningTimer = false,
  onSelect,
  onTaskUpdated,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<number>(task.microSteps?.length ?? 0);
  const [justDecomposed, setJustDecomposed] = useState(false);
  const [showStuckMenu, setShowStuckMenu] = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState(task.name);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedulePos, setSchedulePos] = useState<{ top: number; right: number } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [tagEditorPos, setTagEditorPos] = useState<{ top: number; left: number } | null>(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState<Tag["color"]>("data");
  const [knownTags, setKnownTags] = useState<Tag[]>([]);
  const prevDoneRef = useRef(task.done);
  const stuckMenuRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const schedulePopoverRef = useRef<HTMLDivElement>(null);
  const scheduleBtnRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const tagEditorRef = useRef<HTMLDivElement>(null);
  const tagEditorPopoverRef = useRef<HTMLDivElement>(null);
  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const quickDates = useMemo(() => getQuickDates(), []);

  const hasSteps = task.microSteps && task.microSteps.length > 0;
  const canDecompose = !task.done && !hasSteps && !isDecomposing;

  useEffect(() => {
    if (task.done && !prevDoneRef.current) {
      const msg = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
      setCelebrationMsg(msg);
      const timer = setTimeout(() => setCelebrationMsg(null), 2500);
      prevDoneRef.current = task.done;
      return () => clearTimeout(timer);
    }
    prevDoneRef.current = task.done;
  }, [task.done]);

  useEffect(() => {
    if (!showStuckMenu && !showSchedule && !showTagEditor) return;
    const handler = (e: MouseEvent) => {
      if (showStuckMenu && stuckMenuRef.current && !stuckMenuRef.current.contains(e.target as Node)) {
        setShowStuckMenu(false);
      }
      if (showSchedule) {
        const inBtn = scheduleRef.current?.contains(e.target as Node);
        const inPopover = schedulePopoverRef.current?.contains(e.target as Node);
        if (!inBtn && !inPopover) setShowSchedule(false);
      }
      if (showTagEditor) {
        const inBtn = tagEditorRef.current?.contains(e.target as Node);
        const inPopover = tagEditorPopoverRef.current?.contains(e.target as Node);
        if (!inBtn && !inPopover) setShowTagEditor(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStuckMenu, showSchedule, showTagEditor]);

  useEffect(() => {
    if (!task.microSteps?.length) {
      setVisibleSteps(0);
      return;
    }
    if (justDecomposed) return;
    setVisibleSteps(task.microSteps.length);
  }, [task.microSteps?.length, justDecomposed]);

  useEffect(() => {
    if (!task.microSteps?.length || !isDecomposing) return;

    setJustDecomposed(true);
    setExpanded(true);
    setVisibleSteps(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    task.microSteps.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleSteps(i + 1), 300 * (i + 1)));
    });

    const doneTimer = setTimeout(
      () => setJustDecomposed(false),
      300 * task.microSteps.length + 400
    );
    timers.push(doneTimer);

    return () => timers.forEach(clearTimeout);
  }, [task.microSteps, isDecomposing]);

  const showGlow =
    justDecomposed &&
    visibleSteps === (task.microSteps?.length ?? 0) &&
    visibleSteps > 0;

  useEffect(() => {
    setNameText(task.name);
  }, [task.name]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.selectionStart = nameInputRef.current.value.length;
    }
  }, [editingName]);

  function startEditName() {
    if (!onRename) return;
    setNameText(task.name);
    setEditingName(true);
  }

  function commitEditName() {
    const trimmed = nameText.trim();
    if (trimmed && trimmed !== task.name) {
      onRename?.(task.id, trimmed);
    }
    setEditingName(false);
  }

  function startEditStep(stepId: string, text: string) {
    setEditingStepId(stepId);
    setEditingText(text);
  }

  function commitEditStep(stepId: string) {
    if (editingText.trim()) {
      onEditStep?.(task.id, stepId, editingText.trim());
    }
    setEditingStepId(null);
  }

  const addTag = useCallback((tag: Tag) => {
    if (!onSetTags) return;
    if (task.tags.some((t) => t.label.toLowerCase() === tag.label.toLowerCase())) return;
    onSetTags(task.id, [...task.tags, tag]);
    setNewTagLabel("");
  }, [task.tags, task.id, onSetTags]);

  const addNewTag = useCallback(() => {
    const label = newTagLabel.trim();
    if (!label) return;
    addTag({ label, color: newTagColor });
  }, [newTagLabel, newTagColor, addTag]);

  const removeTag = useCallback((index: number) => {
    if (!onSetTags) return;
    onSetTags(task.id, task.tags.filter((_, i) => i !== index));
  }, [task.tags, task.id, onSetTags]);

  const taskTagKeys = useMemo(
    () => new Set(task.tags.map((t) => `${t.label.toLowerCase()}:${t.color}`)),
    [task.tags],
  );

  const filteredSuggestions = useMemo(() => {
    return knownTags
      .filter((t) => !taskTagKeys.has(`${t.label.toLowerCase()}:${t.color}`))
      .filter((t) => !newTagLabel || t.label.toLowerCase().includes(newTagLabel.toLowerCase()));
  }, [knownTags, taskTagKeys, newTagLabel]);

  const openTagEditor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showTagEditor) {
      if (tagBtnRef.current) {
        const rect = tagBtnRef.current.getBoundingClientRect();
        setTagEditorPos({ top: rect.bottom + 4, left: rect.left });
      }
      getAllTags().then(setKnownTags).catch(() => {});
    }
    setShowTagEditor(!showTagEditor);
  }, [showTagEditor]);

  return (
    <div
      className={[
        styles.item,
        expanded && hasSteps ? styles.expanded : "",
        isDecomposing && !hasSteps ? styles.decomposing : "",
        showGlow ? styles.glowDone : "",
        isSecondary ? styles.secondary : "",
        celebrationMsg ? styles.celebrating : "",
        showStuckMenu ? styles.stuckOpen : "",
        isSelected ? styles.selected : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ animation: `fadeUp 0.25s ease ${animDelay}s both` }}
      onClick={() => onSelect?.(task.id)}
    >
      {dragHandleProps && (
        <div className={styles.dragHandle} {...dragHandleProps}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.2" />
            <circle cx="6" cy="2" r="1.2" />
            <circle cx="2" cy="7" r="1.2" />
            <circle cx="6" cy="7" r="1.2" />
            <circle cx="2" cy="12" r="1.2" />
            <circle cx="6" cy="12" r="1.2" />
          </svg>
        </div>
      )}

      <button
        className={`${styles.check} ${task.done ? styles.checkDone : ""}`}
        onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
      >
        {task.done && "✓"}
      </button>

      <div className={styles.body}>
        <div className={styles.nameRow}>
          {editingName ? (
            <input
              ref={nameInputRef}
              className={styles.nameEditInput}
              value={nameText}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNameText(e.target.value)}
              onBlur={commitEditName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEditName();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <div
              className={`${styles.name} ${task.done ? styles.nameDone : ""}`}
              onDoubleClick={(e) => { e.stopPropagation(); startEditName(); }}
            >
              {task.name}
            </div>
          )}
          {hasRunningTimer && (
            <span className={styles.timerBadge}>
              <span className={styles.timerDot} />
              en cours
            </span>
          )}
          {!task.done && !hasRunningTimer && (
            <EditableEstimate
              minutes={task.estimatedMinutes}
              onChange={(m) => onUpdateEstimate?.(task.id, m)}
            />
          )}
          {onSetScheduledDate && !task.done && (
            <div className={styles.scheduleWrap} ref={scheduleRef}>
              <button
                ref={scheduleBtnRef}
                className={`${styles.scheduleBtn} ${showSchedule ? styles.scheduleBtnActive : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showSchedule && scheduleBtnRef.current) {
                    const rect = scheduleBtnRef.current.getBoundingClientRect();
                    setSchedulePos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                  }
                  setShowSchedule(!showSchedule);
                }}
                title="Planifier"
              >
                📅
              </button>
              {showSchedule && schedulePos && createPortal(
                <div
                  ref={schedulePopoverRef}
                  className={styles.schedulePopover}
                  style={{ position: "fixed", top: schedulePos.top, right: schedulePos.right, left: "auto" }}
                >
                  <div className={styles.scheduleLabel}>Planifier</div>
                  <button
                    className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.today ? styles.scheduleSelected : ""}`}
                    onClick={(e) => { e.stopPropagation(); onSetScheduledDate(task.id, quickDates.today); setShowSchedule(false); }}
                  >
                    <span>☀️</span>
                    <span>Aujourd'hui</span>
                  </button>
                  <button
                    className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.tomorrow ? styles.scheduleSelected : ""}`}
                    onClick={(e) => { e.stopPropagation(); onSetScheduledDate(task.id, quickDates.tomorrow); setShowSchedule(false); }}
                  >
                    <span>→</span>
                    <span>Demain</span>
                  </button>
                  <div className={styles.scheduleDivider} />
                  <div className={styles.scheduleLabel}>Début de semaine</div>
                  <button
                    className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.nextMonday ? styles.scheduleSelected : ""}`}
                    onClick={(e) => { e.stopPropagation(); onSetScheduledDate(task.id, quickDates.nextMonday); setShowSchedule(false); }}
                  >
                    <span>📆</span>
                    <span>Semaine prochaine <span className={styles.scheduleHint}>{formatQuickDateHint(quickDates.nextMonday)}</span></span>
                  </button>
                  <button
                    className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.twoWeeksMonday ? styles.scheduleSelected : ""}`}
                    onClick={(e) => { e.stopPropagation(); onSetScheduledDate(task.id, quickDates.twoWeeksMonday); setShowSchedule(false); }}
                  >
                    <span>⏩</span>
                    <span>Dans 2 semaines <span className={styles.scheduleHint}>{formatQuickDateHint(quickDates.twoWeeksMonday)}</span></span>
                  </button>
                  <button
                    className={`${styles.scheduleOption} ${task.scheduledDate === quickDates.oneMonthMonday ? styles.scheduleSelected : ""}`}
                    onClick={(e) => { e.stopPropagation(); onSetScheduledDate(task.id, quickDates.oneMonthMonday); setShowSchedule(false); }}
                  >
                    <span>📅</span>
                    <span>Dans 1 mois <span className={styles.scheduleHint}>{formatQuickDateHint(quickDates.oneMonthMonday)}</span></span>
                  </button>
                  <div className={styles.scheduleDivider} />
                  <div className={styles.scheduleLabel}>Date précise</div>
                  <input
                    type="date"
                    className={styles.scheduleDateInput}
                    value={task.scheduledDate ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { onSetScheduledDate(task.id, e.target.value || undefined); setShowSchedule(false); }}
                  />
                  {task.scheduledDate && (
                    <>
                      <div className={styles.scheduleDivider} />
                      <button
                        className={styles.scheduleClear}
                        onClick={(e) => { e.stopPropagation(); onSetScheduledDate(task.id, undefined); setShowSchedule(false); }}
                      >
                        Retirer la planification
                      </button>
                    </>
                  )}
                </div>,
                document.body
              )}
            </div>
          )}
          <button
            className={styles.detailBtn}
            onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
            title="Voir le détail"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
          {onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              title="Supprimer"
            >
              ×
            </button>
          )}
        </div>

        {(task.tags.length > 0 || task.urgency != null || task.importance != null || (isOverdue && task.priority === "main") || (onSetTags && !task.done)) && (
          <div className={styles.tags}>
            {isOverdue && task.priority === "main" && (
              <span className={`${styles.tag} ${styles.wasPriority}`}>
                ⚡ était prioritaire
              </span>
            )}
            {task.urgency != null && (
              <PriorityBadge
                type="urgency"
                score={task.urgency}
                onChange={onSetPriority && !task.done ? (v) => onSetPriority(task.id, "urgency", v) : undefined}
              />
            )}
            {task.importance != null && (
              <PriorityBadge
                type="importance"
                score={task.importance}
                onChange={onSetPriority && !task.done ? (v) => onSetPriority(task.id, "importance", v) : undefined}
              />
            )}
            {task.tags.map((tag, i) => (
              <span key={i} className={`${styles.tag} ${styles[tag.color]}`}>
                {tag.label}
                {onSetTags && !task.done && (
                  <button
                    className={styles.tagRemove}
                    onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {onSetTags && !task.done && (
              <div ref={tagEditorRef}>
                <button
                  ref={tagBtnRef}
                  className={styles.tagAddBtn}
                  onClick={openTagEditor}
                >
                  +
                </button>
                {showTagEditor && tagEditorPos && createPortal(
                  <div
                    ref={tagEditorPopoverRef}
                    className={styles.tagEditorPopover}
                    style={{ position: "fixed", top: tagEditorPos.top, left: tagEditorPos.left }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={styles.tagEditorInputRow}>
                      <input
                        className={styles.tagEditorInput}
                        value={newTagLabel}
                        placeholder="Chercher ou créer un tag…"
                        autoFocus
                        onChange={(e) => setNewTagLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (filteredSuggestions.length > 0) {
                              addTag(filteredSuggestions[0]);
                            } else {
                              addNewTag();
                            }
                          }
                          if (e.key === "Escape") setShowTagEditor(false);
                        }}
                      />
                    </div>
                    {filteredSuggestions.length > 0 && (
                      <>
                        <div className={styles.tagEditorTitle}>Tags existants</div>
                        <div className={styles.tagEditorSuggestions}>
                          {filteredSuggestions.map((tag) => (
                            <button
                              key={`${tag.label}:${tag.color}`}
                              className={`${styles.tag} ${styles[tag.color]} ${styles.tagSuggestion}`}
                              onClick={() => addTag(tag)}
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {newTagLabel.trim() && !filteredSuggestions.some(
                      (t) => t.label.toLowerCase() === newTagLabel.trim().toLowerCase()
                    ) && (
                      <>
                        <div className={styles.tagEditorDivider} />
                        <div className={styles.tagEditorTitle}>Nouveau tag</div>
                        <div className={styles.tagEditorColors}>
                          {TAG_COLORS.map((c) => (
                            <button
                              key={c.id}
                              className={`${styles.tagColorDot} ${newTagColor === c.id ? styles.tagColorDotActive : ""}`}
                              style={{ background: c.css }}
                              onClick={() => setNewTagColor(c.id)}
                              title={c.label}
                            />
                          ))}
                        </div>
                        <button
                          className={styles.tagEditorCreateBtn}
                          onClick={addNewTag}
                        >
                          Créer <span className={`${styles.tag} ${styles[newTagColor]}`}>{newTagLabel.trim()}</span>
                        </button>
                      </>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            )}
          </div>
        )}

        {celebrationMsg && (
          <div className={styles.celebration}>{celebrationMsg}</div>
        )}

        {isDecomposing && !hasSteps && (
          <div className={styles.skeleton}>
            <div className={styles.skeletonLabel}>
              <span className={styles.skeletonDot} />
              focal. décompose
              <span className={styles.ellipsis} />
            </div>
            <div className={styles.skeletonLines}>
              <div className={`${styles.skeletonLine} ${styles.line1}`} />
              <div className={`${styles.skeletonLine} ${styles.line2}`} />
              <div className={`${styles.skeletonLine} ${styles.line3}`} />
            </div>
          </div>
        )}

        {!task.done && !isDecomposing && (
          <div className={styles.actions}>
            {canDecompose && onDecompose && (
              <button
                className={styles.decomposeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onDecompose(task.id);
                }}
              >
                <span className={styles.decomposeIcon}>✦</span>
                Décomposer
              </button>
            )}

            <div className={styles.stuckWrap} ref={stuckMenuRef}>
              <button
                className={styles.stuckBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStuckMenu(!showStuckMenu);
                }}
              >
                Je bloque
              </button>

              {showStuckMenu && (
                <div className={styles.stuckMenu}>
                  <button
                    className={styles.stuckOption}
                    onClick={() => {
                      onStuck?.(task.id);
                      setShowStuckMenu(false);
                    }}
                  >
                    <span>💬</span>
                    <span>En parler avec focal.</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {hasSteps && !isDecomposing && (
          <div className={styles.stepsHeader}>
            <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
              <span>{expanded ? "▾" : "▸"}</span>
              <span>{task.microSteps!.length} étapes · décomposé par IA</span>
              {task.aiDecomposed && <span className={styles.aiBadge}>IA</span>}
            </button>
            {!task.done && onRedecompose && (
              <button
                className={styles.redoBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onRedecompose(task.id);
                }}
                title="Régénérer la décomposition"
              >
                ↻
              </button>
            )}
          </div>
        )}

        {expanded && hasSteps && (
          <div className={styles.microSteps}>
            {task.microSteps!.map((step, i) => (
              <div
                key={step.id}
                className={`${styles.microStep} ${
                  i < visibleSteps ? styles.stepVisible : styles.stepHidden
                }`}
                style={{
                  transitionDelay: justDecomposed ? `${i * 0.05}s` : "0s",
                }}
              >
                {decomposingStepId === step.id ? (
                  <div className={styles.stepLoading}>
                    <span className={styles.skeletonDot} />
                    <span className={styles.stepLoadingText}>
                      focal. décompose<span className={styles.ellipsis} />
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      className={styles.stepContent}
                      onClick={() => {
                        if (editingStepId !== step.id) onToggleStep(task.id, step.id);
                      }}
                    >
                      <div
                        className={`${styles.stepDot} ${
                          step.done ? styles.stepDotDone : ""
                        }`}
                      />
                      {editingStepId === step.id ? (
                        <input
                          className={styles.stepEditInput}
                          value={editingText}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => commitEditStep(step.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditStep(step.id);
                            if (e.key === "Escape") setEditingStepId(null);
                          }}
                        />
                      ) : (
                        <div
                          className={`${styles.stepText} ${
                            step.done ? styles.stepTextDone : ""
                          }`}
                        >
                          {step.text}
                        </div>
                      )}
                    </button>

                    {!task.done && !step.done && editingStepId !== step.id && (
                      <div className={styles.stepActions}>
                        <button
                          className={styles.stepActionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditStep(step.id, step.text);
                          }}
                          title="Modifier"
                        >
                          ✎
                        </button>
                        {onDecomposeStep && (
                          <button
                            className={styles.stepActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDecomposeStep(task.id, step.id);
                            }}
                            title="Décomposer cette étape"
                          >
                            ✦
                          </button>
                        )}
                      </div>
                    )}

                    {!task.done && (
                      <EditableEstimate
                        minutes={step.estimatedMinutes}
                        onChange={(m) => onUpdateStepEstimate?.(task.id, step.id, m)}
                        small
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showDetail && (
        <TaskDetailModal
          task={task}
          onClose={() => setShowDetail(false)}
          onToggle={onToggle}
          onRename={onRename}
          onSetPriority={onSetPriority}
          onSetScheduledDate={onSetScheduledDate}
          onUpdateEstimate={onUpdateEstimate}
          onDelete={onDelete}
          onSetTags={onSetTags}
          onTaskUpdated={onTaskUpdated}
        />
      )}
    </div>
  );
}
