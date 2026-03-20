import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type { Task, Tag, PriorityScore } from "../types";
import { updateTask as updateTaskSvc, getAllTags } from "../services/tasks";
import { TAG_COLORS } from "../data/tagConstants";
import useStrategies from "../hooks/useStrategies";
import { CheckmarkIcon } from "./icons";
import { formatFullDate, formatFullDateTime } from "../utils/dateFormat";
import styles from "./TaskDetailModal.module.css";

interface Props {
  task: Task;
  onClose: () => void;
  onToggle: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onSetPriority?: (id: string, field: "urgency" | "importance", value: PriorityScore | undefined) => void;
  onSetScheduledDate?: (id: string, date: string | undefined) => void;
  onUpdateEstimate?: (taskId: string, minutes: number | undefined) => void;
  onDelete?: (id: string) => void;
  onSetTags?: (id: string, tags: Tag[]) => void;
  onTaskUpdated?: (task: Task) => void;
}

export default function TaskDetailModal({
  task,
  onClose,
  onToggle,
  onRename,
  onSetPriority,
  onSetScheduledDate,
  onUpdateEstimate,
  onDelete,
  onSetTags,
  onTaskUpdated,
}: Props) {
  const [title, setTitle] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [tagSearch, setTagSearch] = useState("");
  const [newTagColor, setNewTagColor] = useState<Tag["color"]>("data");
  const [knownTags, setKnownTags] = useState<Tag[]>([]);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const { pickerObjectives, getStrategyInfo } = useStrategies();
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(task.name);
    setDescription(task.description ?? "");
  }, [task.id, task.name, task.description]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      const trimmed = val.trim();
      if (trimmed && trimmed !== task.name) {
        onRename?.(task.id, trimmed);
      }
    }, 500);
  }, [task.id, task.name, onRename]);

  const handleDescriptionChange = useCallback((val: string) => {
    setDescription(val);
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(() => {
      updateTaskSvc({ id: task.id, description: val }).catch(() => {});
      onTaskUpdated?.({ ...task, description: val || undefined });
    }, 500);
  }, [task, onTaskUpdated]);

  useEffect(() => {
    return () => {
      if (descTimer.current) clearTimeout(descTimer.current);
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (onSetTags) {
      getAllTags().then(setKnownTags).catch(() => {});
    }
  }, [onSetTags]);

  const taskTagKeys = useMemo(
    () => new Set(task.tags.map((t) => `${t.label.toLowerCase()}:${t.color}`)),
    [task.tags],
  );

  const filteredSuggestions = useMemo(() => {
    return knownTags
      .filter((t) => !taskTagKeys.has(`${t.label.toLowerCase()}:${t.color}`))
      .filter((t) => !tagSearch || t.label.toLowerCase().includes(tagSearch.toLowerCase()));
  }, [knownTags, taskTagKeys, tagSearch]);

  const addTag = useCallback((tag: Tag) => {
    if (!onSetTags) return;
    if (task.tags.some((t) => t.label.toLowerCase() === tag.label.toLowerCase())) return;
    onSetTags(task.id, [...task.tags, tag]);
    setTagSearch("");
  }, [task.tags, task.id, onSetTags]);

  const addNewTag = useCallback(() => {
    const label = tagSearch.trim();
    if (!label) return;
    addTag({ label, color: newTagColor });
  }, [tagSearch, newTagColor, addTag]);

  const removeTag = useCallback((index: number) => {
    if (!onSetTags) return;
    onSetTags(task.id, task.tags.filter((_, i) => i !== index));
  }, [task.tags, task.id, onSetTags]);

  const currentStrategyInfo = getStrategyInfo(task.strategyId);

  const handleStrategyChange = useCallback((tacticId: string | undefined) => {
    const newId = tacticId ?? "";
    updateTaskSvc({ id: task.id, strategyId: newId }).catch(() => {});
    onTaskUpdated?.({ ...task, strategyId: tacticId });
    setShowStrategyPicker(false);
  }, [task, onTaskUpdated]);

  const stepsTotal = task.microSteps?.length ?? 0;
  const stepsDone = task.microSteps?.filter((s) => s.done).length ?? 0;

  return createPortal(
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.panel}>
        <div className={styles.panelBody}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <input
                className={`${styles.titleInput} ${task.done ? styles.titleDone : ""}`}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>

          {/* Description */}
          <div className={styles.descriptionSection}>
            <div className={styles.descriptionLabel}>Description</div>
            <textarea
              className={styles.descriptionInput}
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Ajouter une description, des notes, du contexte…"
            />
          </div>

          {/* Metadata */}
          <div className={styles.metaGrid}>
            {/* Scheduled date */}
            <div className={styles.metaRow}>
              <div className={styles.metaIcon}>📅</div>
              <div className={styles.metaLabel}>Date</div>
              <div className={styles.metaValue}>
                {onSetScheduledDate ? (
                  <input
                    type="date"
                    className={styles.metaDateInput}
                    value={task.scheduledDate ?? ""}
                    onChange={(e) => onSetScheduledDate(task.id, e.target.value || undefined)}
                  />
                ) : (
                  <span className={task.scheduledDate ? undefined : styles.metaValueEmpty}>
                    {task.scheduledDate ? formatFullDate(task.scheduledDate) : "Non planifié"}
                  </span>
                )}
              </div>
            </div>

            {/* Estimate */}
            <div className={styles.metaRow}>
              <div className={styles.metaIcon}>⏱</div>
              <div className={styles.metaLabel}>Estimation</div>
              <div className={styles.metaValue}>
                {onUpdateEstimate ? (
                  <>
                    <input
                      type="number"
                      className={styles.estimateInput}
                      value={task.estimatedMinutes ?? ""}
                      min={0}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        onUpdateEstimate(task.id, v);
                      }}
                    />
                    <span className={styles.estimateUnit}>min</span>
                  </>
                ) : (
                  <span className={task.estimatedMinutes ? undefined : styles.metaValueEmpty}>
                    {task.estimatedMinutes ? `${task.estimatedMinutes} min` : "Non estimé"}
                  </span>
                )}
              </div>
            </div>

            {/* Priority — Urgency */}
            <div className={styles.metaRow}>
              <div className={styles.metaIcon}>🔥</div>
              <div className={styles.metaLabel}>Urgence</div>
              <div className={styles.metaValue}>
                <div className={styles.priorityScale}>
                  {([1, 2, 3, 4, 5] as const).map((v) => (
                    <button
                      key={v}
                      className={`${styles.prioritySegment} ${
                        task.urgency != null && v <= task.urgency ? styles.prioritySegmentFilled : ""
                      } ${task.urgency === v ? styles.prioritySegmentActive : ""}`}
                      style={{ "--seg-hue": `${120 - (v - 1) * 30}` } as React.CSSProperties}
                      onClick={() => {
                        if (onSetPriority) {
                          onSetPriority(task.id, "urgency", task.urgency === v ? undefined : v);
                        }
                      }}
                      disabled={!onSetPriority}
                    />
                  ))}
                  <span className={styles.priorityLabel}>
                    {task.urgency == null ? "—" : ["", "Faible", "Modérée", "Normale", "Haute", "Critique"][task.urgency]}
                  </span>
                </div>
              </div>
            </div>

            {/* Priority — Importance */}
            <div className={styles.metaRow}>
              <div className={styles.metaIcon}>🎯</div>
              <div className={styles.metaLabel}>Importance</div>
              <div className={styles.metaValue}>
                <div className={styles.priorityScale}>
                  {([1, 2, 3, 4, 5] as const).map((v) => (
                    <button
                      key={v}
                      className={`${styles.prioritySegment} ${
                        task.importance != null && v <= task.importance ? styles.prioritySegmentFilled : ""
                      } ${task.importance === v ? styles.prioritySegmentActive : ""}`}
                      style={{ "--seg-hue": `${260 - (v - 1) * 10}` } as React.CSSProperties}
                      onClick={() => {
                        if (onSetPriority) {
                          onSetPriority(task.id, "importance", task.importance === v ? undefined : v);
                        }
                      }}
                      disabled={!onSetPriority}
                    />
                  ))}
                  <span className={styles.priorityLabel}>
                    {task.importance == null ? "—" : ["", "Faible", "Modérée", "Normale", "Haute", "Critique"][task.importance]}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className={styles.metaRow} style={{ alignItems: "flex-start" }}>
              <div className={styles.metaIcon} style={{ marginTop: 2 }}>🏷</div>
              <div className={styles.metaLabel} style={{ marginTop: 4 }}>Tags</div>
              <div className={styles.metaValue}>
                <div className={styles.tagsWrap}>
                  {task.tags.length > 0 && (
                    <div className={styles.tagsRow}>
                      {task.tags.map((tag, i) => (
                        <span key={i} className={`${styles.tag} ${styles[tag.color]}`}>
                          {tag.label}
                          {onSetTags && (
                            <button
                              className={styles.tagRemoveBtn}
                              onClick={() => removeTag(i)}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {onSetTags && (
                    <>
                      <input
                        ref={tagInputRef}
                        className={styles.tagInlineInput}
                        value={tagSearch}
                        placeholder={task.tags.length > 0 ? "Ajouter…" : "Ajouter un tag…"}
                        onChange={(e) => setTagSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (filteredSuggestions.length > 0) {
                              addTag(filteredSuggestions[0]);
                            } else if (tagSearch.trim()) {
                              addNewTag();
                            }
                          }
                        }}
                      />
                      {filteredSuggestions.length > 0 && (
                        <div className={styles.tagSuggestionsList}>
                          {filteredSuggestions.map((tag) => (
                            <button
                              key={`${tag.label}:${tag.color}`}
                              className={`${styles.tagSuggestionItem} ${styles[tag.color]}`}
                              onClick={() => addTag(tag)}
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {tagSearch.trim() && !filteredSuggestions.some(
                        (t) => t.label.toLowerCase() === tagSearch.trim().toLowerCase()
                      ) && (
                        <div className={styles.tagCreateRow}>
                          <div className={styles.tagColorPicker}>
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
                          <button className={styles.tagCreateBtn} onClick={addNewTag}>
                            Créer <span className={`${styles.tag} ${styles[newTagColor]}`}>{tagSearch.trim()}</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {!onSetTags && task.tags.length === 0 && (
                    <span className={styles.noTags}>Aucun tag</span>
                  )}
                </div>
              </div>
            </div>

            {/* Strategy link */}
            <div className={styles.metaRow} style={{ alignItems: "flex-start" }}>
              <div className={styles.metaIcon} style={{ marginTop: 2 }}>🧭</div>
              <div className={styles.metaLabel} style={{ marginTop: 4 }}>Stratégie</div>
              <div className={styles.metaValue}>
                <div className={styles.strategyWrap}>
                  {currentStrategyInfo ? (
                    <div className={styles.strategySelected}>
                      <div className={styles.strategySelectedInfo}>
                        {currentStrategyInfo.strategyId !== currentStrategyInfo.objectiveId && (
                          <span className={styles.strategyGoalHint}>{currentStrategyInfo.objectiveTitle}</span>
                        )}
                        <span className={styles.strategyTitle}>{currentStrategyInfo.strategyTitle}</span>
                      </div>
                      <button
                        className={styles.strategyRemoveBtn}
                        onClick={() => handleStrategyChange(undefined)}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.strategyPickBtn}
                      onClick={() => setShowStrategyPicker(!showStrategyPicker)}
                    >
                      Rattacher à une stratégie…
                    </button>
                  )}
                  {currentStrategyInfo && !showStrategyPicker && (
                    <button
                      className={styles.strategyChangeBtn}
                      onClick={() => setShowStrategyPicker(true)}
                    >
                      Changer
                    </button>
                  )}
                  {showStrategyPicker && (
                    <div className={styles.strategyDropdown}>
                      {pickerObjectives.length === 0 ? (
                        <div className={styles.strategyEmpty}>
                          Aucune stratégie définie dans la prise de recul
                        </div>
                      ) : (
                        pickerObjectives.map((obj) => (
                          <div key={obj.id} className={styles.strategyGoalGroup}>
                            {obj.strategies.length > 0 ? (
                              <>
                                <div className={styles.strategyGoalLabel}>{obj.title}</div>
                                {obj.strategies.map((strategy) => (
                                  <button
                                    key={strategy.id}
                                    className={`${styles.strategyOption} ${task.strategyId === strategy.id ? styles.strategyOptionActive : ""}`}
                                    onClick={() => handleStrategyChange(strategy.id)}
                                  >
                                    {strategy.title}
                                  </button>
                                ))}
                              </>
                            ) : (
                              <button
                                className={`${styles.strategyObjective} ${task.strategyId === obj.id ? styles.strategyOptionActive : ""}`}
                                onClick={() => handleStrategyChange(obj.id)}
                              >
                                {obj.title}
                              </button>
                            )}
                          </div>
                        ))
                      )}
                      <button
                        className={styles.strategyCancel}
                        onClick={() => setShowStrategyPicker(false)}
                      >
                        Fermer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          {stepsTotal > 0 && (
            <>
              <div className={styles.divider} />
              <div className={styles.stepsSection}>
                <div className={styles.stepsHeader}>
                  <span className={styles.stepsTitle}>Micro-étapes</span>
                  <span className={styles.stepsCount}>{stepsDone}/{stepsTotal}</span>
                </div>
                <div className={styles.stepsList}>
                  {task.microSteps!.map((step) => (
                    <div key={step.id} className={styles.step}>
                      <div className={`${styles.stepDot} ${step.done ? styles.stepDotDone : ""}`} />
                      <span className={`${styles.stepText} ${step.done ? styles.stepTextDone : ""}`}>
                        {step.text}
                      </span>
                      {step.estimatedMinutes && (
                        <span className={styles.stepEstimate}>{step.estimatedMinutes} min</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Status + Footer */}
        <div className={styles.footerArea}>
          <button
            className={`${styles.statusBtn} ${task.done ? styles.statusBtnDone : ""}`}
            onClick={() => onToggle(task.id)}
          >
            {task.done ? (
              <>
                <CheckmarkIcon size={14} />
                Terminée
              </>
            ) : (
              <>
                <span className={styles.statusCircle} />
                Marquer comme terminée
              </>
            )}
          </button>
          <div className={styles.footer}>
            <div className={styles.footerMeta}>
              {task.createdAt && (
                <span>Créée le {formatFullDateTime(task.createdAt)}</span>
              )}
              {task.aiDecomposed && <span>Décomposée par IA</span>}
            </div>
            <div className={styles.footerActions}>
              {onDelete && (
                <button
                  className={styles.deleteBtn}
                  onClick={() => { onDelete(task.id); onClose(); }}
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
