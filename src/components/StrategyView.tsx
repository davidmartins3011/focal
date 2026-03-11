import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MONTH_NAMES } from "../data/strategyConstants";
import {
  getStrategyReviews,
  getStrategyGoals,
  upsertStrategyGoal,
  deleteStrategyGoal,
  upsertStrategy,
  deleteStrategy,
  upsertTactic,
  deleteTactic,
  upsertAction,
  deleteAction,
  toggleAction,
  getPeriodSummary,
} from "../services/reviews";
import {
  getActiveMonths,
  strategyPeriodLabel,
  strategyCtaLabel,
  strategyNudgeThreshold,
} from "../data/settingsConstants";
import type {
  StrategyReview,
  StrategyFrequency,
  StrategyGoal,
  StrategyStrategy,
  StrategyTactic,
  PeriodSummary,
} from "../types";
import styles from "./StrategyView.module.css";

// ── Helpers ──

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

function daysSinceReview(review: StrategyReview): number {
  const now = new Date();
  const created = new Date(review.createdAt);
  return Math.floor((now.getTime() - created.getTime()) / 86400000);
}

function nextPeriodLabel(review: StrategyReview, freq: StrategyFrequency): string {
  const step =
    freq === "monthly" ? 1 :
    freq === "bimonthly" ? 2 :
    freq === "quarterly" ? 3 : 6;
  const nextMonth = (review.month + step) % 12;
  const yearAdd = review.month + step >= 12 ? 1 : 0;
  return `${MONTH_NAMES[nextMonth]} ${review.year + yearAdd}`;
}

function chipLabel(review: StrategyReview, freq: StrategyFrequency): string {
  const short = MONTH_NAMES[review.month].slice(0, 3);
  if (freq === "monthly") return `${short}.`;
  if (freq === "bimonthly") {
    const next = (review.month + 1) % 12;
    return `${short}-${MONTH_NAMES[next].slice(0, 3)}`;
  }
  if (freq === "quarterly") {
    const q = Math.floor(review.month / 3) + 1;
    return `T${q}`;
  }
  const s = review.month < 6 ? 1 : 2;
  return `S${s}`;
}

function periodTitleLabel(review: StrategyReview, freq: StrategyFrequency): string {
  const first = MONTH_NAMES[review.month];
  if (freq === "monthly") return first;
  const step =
    freq === "bimonthly" ? 2 :
    freq === "quarterly" ? 3 : 6;
  const lastMonth = (review.month + step - 1) % 12;
  return `${first}-${MONTH_NAMES[lastMonth]}`;
}

function goalProgress(goal: StrategyGoal): number {
  let total = 0;
  let done = 0;
  for (const s of goal.strategies) {
    for (const t of s.tactics) {
      for (const a of t.actions) {
        total++;
        if (a.done) done++;
      }
    }
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function stratProgress(strategy: StrategyStrategy): number {
  let total = 0;
  let done = 0;
  for (const t of strategy.tactics) {
    for (const a of t.actions) {
      total++;
      if (a.done) done++;
    }
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function tacticCount(tactic: StrategyTactic): { done: number; total: number } {
  const total = tactic.actions.length;
  const done = tactic.actions.filter((a) => a.done).length;
  return { done, total };
}

// ── Bilan helpers ──

const TAG_META: Record<string, { label: string; icon: string; color: string }> = {
  roadmap: { label: "Produit", icon: "🚀", color: "var(--accent)" },
  data:    { label: "Data",    icon: "📊", color: "var(--blue)" },
  saas:    { label: "SaaS",    icon: "💡", color: "var(--purple)" },
  crm:     { label: "CRM",     icon: "🤝", color: "var(--green)" },
};

function periodDates(review: StrategyReview, freq: StrategyFrequency): { start: string; end: string } {
  const step = freq === "monthly" ? 1 : freq === "bimonthly" ? 2 : freq === "quarterly" ? 3 : 6;
  const startDate = new Date(review.year, review.month, 1);
  const endDate = new Date(review.year, review.month + step, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(startDate), end: fmt(endDate) };
}

// ── InlineEdit ──

interface InlineEditProps {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
  tag?: "span" | "div" | "h3";
}

function InlineEdit({ value, onSave, className, placeholder, tag: Tag = "span" }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`${styles.inlineInput} ${className ?? ""}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <Tag
      className={`${styles.inlineText} ${className ?? ""}`}
      onClick={() => setEditing(true)}
      title="Cliquer pour modifier"
    >
      {value || placeholder}
    </Tag>
  );
}

// ── Main component ──

interface StrategyViewProps {
  frequency: StrategyFrequency;
  cycleStart: number;
}

export default function StrategyView({ frequency, cycleStart }: StrategyViewProps) {
  // ── Reviews state ──
  const [reviews, setReviews] = useState<StrategyReview[]>([]);

  useEffect(() => {
    getStrategyReviews()
      .then(setReviews)
      .catch((err) => console.error("[StrategyView] getStrategyReviews error:", err));
  }, []);

  const activeMonths = useMemo(
    () => getActiveMonths(frequency, cycleStart),
    [frequency, cycleStart]
  );

  const sorted = useMemo(
    () =>
      [...reviews]
        .filter((r) => activeMonths.has(r.month))
        .sort((a, b) => {
          const da = a.year * 12 + a.month;
          const db = b.year * 12 + b.month;
          return db - da;
        }),
    [reviews, activeMonths]
  );

  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? "");
  const review = sorted.find((r) => r.id === selectedId) ?? sorted[0];

  // ── GSTA state ──
  const [goals, setGoals] = useState<StrategyGoal[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const reloadGoals = useCallback(() => {
    getStrategyGoals()
      .then(setGoals)
      .catch((err) => console.error("[StrategyView] getStrategyGoals error:", err));
  }, []);

  useEffect(() => { reloadGoals(); }, [reloadGoals]);

  useEffect(() => {
    if (adding) setTimeout(() => addInputRef.current?.focus(), 0);
  }, [adding]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Goal CRUD ──

  const handleAddGoal = async () => {
    const id = uid();
    await upsertStrategyGoal({ id, title: "Nouvel objectif", target: "", position: goals.length });
    reloadGoals();
  };

  const handleUpdateGoal = async (goal: StrategyGoal, field: "title" | "target" | "deadline", value: string) => {
    await upsertStrategyGoal({
      id: goal.id,
      title: field === "title" ? value : goal.title,
      target: field === "target" ? value : goal.target,
      deadline: field === "deadline" ? (value || undefined) : goal.deadline,
      position: goals.indexOf(goal),
    });
    reloadGoals();
  };

  const handleDeleteGoal = async (id: string) => {
    await deleteStrategyGoal(id);
    reloadGoals();
  };

  // ── Strategy CRUD ──

  const handleAddStrategy = async (goalId: string, count: number) => {
    const id = uid();
    await upsertStrategy({ id, goalId, title: "Nouvelle stratégie", description: "", position: count });
    reloadGoals();
  };

  const handleUpdateStrategy = async (s: StrategyStrategy, goalId: string, field: "title" | "description", value: string, position: number) => {
    await upsertStrategy({
      id: s.id,
      goalId,
      title: field === "title" ? value : s.title,
      description: field === "description" ? value : s.description,
      position,
    });
    reloadGoals();
  };

  const handleDeleteStrategy = async (id: string) => {
    await deleteStrategy(id);
    reloadGoals();
  };

  // ── Tactic CRUD ──

  const handleAddTactic = async (strategyId: string, count: number) => {
    const id = uid();
    await upsertTactic({ id, strategyId, title: "Nouvelle tactique", description: "", position: count });
    reloadGoals();
  };

  const handleUpdateTactic = async (t: StrategyTactic, strategyId: string, field: "title" | "description", value: string, position: number) => {
    await upsertTactic({
      id: t.id,
      strategyId,
      title: field === "title" ? value : t.title,
      description: field === "description" ? value : t.description,
      position,
    });
    reloadGoals();
  };

  const handleDeleteTactic = async (id: string) => {
    await deleteTactic(id);
    reloadGoals();
  };

  // ── Action CRUD ──

  const handleAddAction = async (tacticId: string) => {
    const input = addInputRef.current;
    const text = input?.value.trim();
    if (!text) { setAdding(null); return; }
    const id = uid();
    const tac = goals.flatMap(g => g.strategies.flatMap(s => s.tactics)).find(t => t.id === tacticId);
    await upsertAction({ id, tacticId, text, position: tac?.actions.length ?? 0 });
    setAdding(null);
    reloadGoals();
  };

  const handleUpdateAction = async (actionId: string, tacticId: string, text: string, position: number) => {
    await upsertAction({ id: actionId, tacticId, text, position });
    reloadGoals();
  };

  const handleDeleteAction = async (id: string) => {
    await deleteAction(id);
    reloadGoals();
  };

  const handleToggleAction = async (id: string) => {
    await toggleAction(id);
    reloadGoals();
  };

  // ── Bilan state ──

  const [bilan, setBilan] = useState<PeriodSummary | null>(null);

  useEffect(() => {
    if (!review) { setBilan(null); return; }
    const { start, end } = periodDates(review, frequency);
    getPeriodSummary(start, end)
      .then(setBilan)
      .catch((err) => console.error("[StrategyView] getPeriodSummary error:", err));
  }, [review, frequency]);

  const bilanDistribution = useMemo(() => {
    if (!bilan || bilan.distribution.length === 0) return [];
    const total = bilan.distribution.reduce((s, d) => s + d.count, 0);
    return bilan.distribution.map((d) => {
      const meta = TAG_META[d.tag] ?? { label: d.tag, icon: "📁", color: "var(--text3)" };
      return { label: meta.label, pct: Math.round((d.count / total) * 100), color: meta.color };
    });
  }, [bilan]);

  const bilanHighlights = useMemo(() => {
    if (!bilan) return [];
    return bilan.highlights.map((h) => {
      const meta = TAG_META[h.tag ?? ""] ?? { icon: "✅" };
      return { icon: meta.icon, text: h.name };
    });
  }, [bilan]);

  // ── Review helpers ──

  const isLatest = review?.id === sorted[0]?.id;
  const daysSince = review ? daysSinceReview(review) : 0;
  const nudge = review ? isLatest && daysSince >= strategyNudgeThreshold(frequency) : false;
  const periodLabel = strategyPeriodLabel(frequency);

  // ── Render: goals block (reused in the layout) ──

  const renderGoals = () => (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Mes objectifs</span>
        <span className={styles.sectionHint}>
          Goal → Strategy → Tactic → Action
        </span>
        <button className={styles.addGoalBtn} onClick={handleAddGoal}>+ Objectif</button>
      </div>

      {goals.length === 0 ? (
        <div className={styles.gstaEmpty}>
          <div className={styles.gstaEmptyText}>
            Ajoute ton premier objectif pour structurer ta stratégie.
          </div>
          <button className={styles.gstaEmptyBtn} onClick={handleAddGoal}>Créer un objectif</button>
        </div>
      ) : (
        <div className={styles.goalsList}>
          {goals.map((goal) => {
            const pct = goalProgress(goal);
            const isCollapsed = collapsed.has(goal.id);

            return (
              <div key={goal.id} className={styles.goalCard}>
                <div className={styles.goalHeader} onClick={() => toggle(goal.id)}>
                  <span className={`${styles.chevron} ${isCollapsed ? "" : styles.chevronOpen}`}>›</span>
                  <div className={styles.goalHeaderContent}>
                    <div className={styles.goalTitleRow}>
                      <InlineEdit
                        value={goal.title}
                        onSave={(v) => handleUpdateGoal(goal, "title", v)}
                        className={styles.goalTitle}
                        tag="h3"
                      />
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
                        title="Supprimer l'objectif"
                      >×</button>
                    </div>
                    <div className={styles.goalMeta}>
                      <InlineEdit
                        value={goal.target}
                        onSave={(v) => handleUpdateGoal(goal, "target", v)}
                        className={styles.goalTarget}
                        placeholder="Cible mesurable..."
                      />
                      {goal.deadline && (
                        <span className={styles.goalDeadline}>
                          Échéance : {new Date(goal.deadline).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <div className={styles.progressRow}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.progressPct}>{pct}%</span>
                    </div>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className={styles.goalBody}>
                    {goal.strategies.map((strat, si) => {
                      const sPct = stratProgress(strat);
                      const stratCollapsed = collapsed.has(strat.id);

                      return (
                        <div key={strat.id} className={styles.strategyBlock}>
                          <div className={styles.strategyHeader} onClick={() => toggle(strat.id)}>
                            <span className={`${styles.chevronSm} ${stratCollapsed ? "" : styles.chevronOpen}`}>›</span>
                            <span className={styles.strategyLabel}>Stratégie {si + 1}</span>
                            <InlineEdit
                              value={strat.title}
                              onSave={(v) => handleUpdateStrategy(strat, goal.id, "title", v, si)}
                              className={styles.strategyTitle}
                            />
                            <span className={styles.strategyPct}>{sPct}%</span>
                            <button
                              className={styles.deleteBtnSm}
                              onClick={(e) => { e.stopPropagation(); handleDeleteStrategy(strat.id); }}
                              title="Supprimer la stratégie"
                            >×</button>
                          </div>
                          {strat.description && !stratCollapsed && (
                            <div className={styles.strategyDesc}>
                              <InlineEdit
                                value={strat.description}
                                onSave={(v) => handleUpdateStrategy(strat, goal.id, "description", v, si)}
                                className={styles.strategyDescText}
                                placeholder="Description..."
                              />
                            </div>
                          )}

                          {!stratCollapsed && (
                            <div className={styles.tacticsGroup}>
                              {strat.tactics.map((tactic, ti) => {
                                const tp = tacticCount(tactic);
                                return (
                                  <div key={tactic.id} className={styles.tacticBlock}>
                                    <div className={styles.tacticHeader}>
                                      <span className={styles.tacticPin}>📌</span>
                                      <InlineEdit
                                        value={tactic.title}
                                        onSave={(v) => handleUpdateTactic(tactic, strat.id, "title", v, ti)}
                                        className={styles.tacticTitle}
                                      />
                                      {tp.total > 0 && (
                                        <span className={styles.tacticCountBadge}>{tp.done}/{tp.total}</span>
                                      )}
                                      <button
                                        className={styles.deleteBtnSm}
                                        onClick={() => handleDeleteTactic(tactic.id)}
                                        title="Supprimer la tactique"
                                      >×</button>
                                    </div>

                                    <div className={styles.actionsList}>
                                      {tactic.actions.map((action, ai) => (
                                        <div key={action.id} className={styles.actionItem}>
                                          <label className={styles.actionCheck}>
                                            <input
                                              type="checkbox"
                                              checked={action.done}
                                              onChange={() => handleToggleAction(action.id)}
                                            />
                                            <span className={styles.checkmark} />
                                          </label>
                                          <InlineEdit
                                            value={action.text}
                                            onSave={(v) => handleUpdateAction(action.id, tactic.id, v, ai)}
                                            className={`${styles.actionText} ${action.done ? styles.actionDone : ""}`}
                                          />
                                          <button
                                            className={styles.deleteBtnXs}
                                            onClick={() => handleDeleteAction(action.id)}
                                            title="Supprimer"
                                          >×</button>
                                        </div>
                                      ))}

                                      {adding === tactic.id ? (
                                        <div className={styles.actionItem}>
                                          <span className={styles.addActionDot} />
                                          <input
                                            ref={addInputRef}
                                            className={styles.addActionInput}
                                            placeholder="Nouvelle action..."
                                            onBlur={() => handleAddAction(tactic.id)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleAddAction(tactic.id);
                                              if (e.key === "Escape") setAdding(null);
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <button
                                          className={styles.addActionBtn}
                                          onClick={() => setAdding(tactic.id)}
                                        >+ Action</button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              <button
                                className={styles.addTacticBtn}
                                onClick={() => handleAddTactic(strat.id, strat.tactics.length)}
                              >+ Tactique</button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      className={styles.addStrategyBtn}
                      onClick={() => handleAddStrategy(goal.id, goal.strategies.length)}
                    >+ Stratégie</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // ── Main render ──

  if (!review) {
    return (
      <div className={styles.wrap}>
        {renderGoals()}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>

      {sorted.length > 1 && (
        <div className={styles.monthSelector}>
          {sorted.map((r) => {
            const active = r.id === review.id;
            return (
              <button
                key={r.id}
                className={`${styles.monthChip} ${active ? styles.monthChipActive : ""}`}
                onClick={() => setSelectedId(r.id)}
              >
                <span className={styles.monthChipLabel}>
                  {chipLabel(r, frequency)}
                </span>
                <span className={styles.monthChipYear}>{r.year}</span>
              </button>
            );
          })}
        </div>
      )}

      {isLatest && (
        <div className={styles.ctaCard}>
          <div className={styles.ctaHeader}>
            <span className={styles.ctaIcon}>🧭</span>
            <div>
              <div className={styles.ctaTitle}>
                Prise de recul — {periodTitleLabel(review, frequency)} {review.year}
              </div>
              <div className={`${styles.ctaMeta} ${nudge ? styles.ctaMetaNudge : ""}`}>
                {nudge
                  ? `Ça fait ${daysSince} jours — un bon moment pour prendre du recul`
                  : `Dernière revue il y a ${daysSince} jours`}
              </div>
            </div>
          </div>
          <p className={styles.ctaText}>
            Prends 15 minutes pour regarder {strategyCtaLabel(frequency)}, ajuster tes objectifs,
            et décider de tes priorités pour {nextPeriodLabel(review, frequency)}.
          </p>
          <button className={styles.ctaBtn}>Lancer la prise de recul</button>
        </div>
      )}

      {!isLatest && (
        <div className={styles.pastHeader}>
          <span className={styles.pastIcon}>📖</span>
          <div>
            <div className={styles.pastTitle}>
              {periodTitleLabel(review, frequency)} {review.year}
            </div>
            <div className={styles.pastMeta}>
              Revue réalisée il y a {daysSince} jours
            </div>
          </div>
        </div>
      )}

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Bilan de la période</span>
        <span className={styles.sectionHint}>
          {isLatest
            ? `Ce que tu as accompli ${frequency === "monthly" ? "ce mois-ci" : "cette période"}`
            : `Réalisations en ${MONTH_NAMES[review.month].toLowerCase()} ${review.year}`}
        </span>
      </div>

      {bilan && bilan.tasksTotal > 0 && (
        <>
          <div className={styles.bilanGrid}>
            <div className={styles.bilanStat}>
              <div className={styles.bilanStatValue}>
                {bilan.tasksCompleted}<span className={styles.bilanStatSlash}>/{bilan.tasksTotal}</span>
              </div>
              <div className={styles.bilanStatLabel}>tâches terminées</div>
              <div className={styles.bilanStatBar}>
                <div
                  className={styles.bilanStatFill}
                  style={{ width: `${Math.round((bilan.tasksCompleted / bilan.tasksTotal) * 100)}%` }}
                />
              </div>
            </div>
            <div className={styles.bilanStat}>
              <div className={styles.bilanStatValue}>
                {bilan.focusDays}<span className={styles.bilanStatSlash}>/{bilan.totalDays}j</span>
              </div>
              <div className={styles.bilanStatLabel}>jours de focus</div>
              <div className={styles.bilanStatBar}>
                <div
                  className={`${styles.bilanStatFill} ${styles.bilanStatFillAlt}`}
                  style={{ width: `${Math.round((bilan.focusDays / bilan.totalDays) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {bilanDistribution.length > 0 && (
            <div className={styles.bilanDistribution}>
              <div className={styles.bilanDistBar}>
                {bilanDistribution.map((d) => (
                  <div
                    key={d.label}
                    className={styles.bilanDistSegment}
                    style={{ width: `${d.pct}%`, background: d.color }}
                    title={`${d.label} — ${d.pct}%`}
                  />
                ))}
              </div>
              <div className={styles.bilanDistLegend}>
                {bilanDistribution.map((d) => (
                  <div key={d.label} className={styles.bilanDistItem}>
                    <span className={styles.bilanDistDot} style={{ background: d.color }} />
                    <span className={styles.bilanDistLabel}>{d.label}</span>
                    <span className={styles.bilanDistPct}>{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bilanHighlights.length > 0 && (
            <div className={styles.bilanHighlights}>
              {bilanHighlights.map((h, i) => (
                <div key={i} className={styles.bilanHighlight}>
                  <span className={styles.bilanHighlightIcon}>{h.icon}</span>
                  <span className={styles.bilanHighlightText}>{h.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {renderGoals()}

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Réflexion {periodLabel}</span>
      </div>
      <div className={styles.reflections}>
        {review.reflections.map((r) => (
          <div key={r.id} className={styles.reflectionCard}>
            <div className={styles.reflectionPrompt}>{r.prompt}</div>
            <div className={styles.reflectionAnswer}>{r.answer}</div>
          </div>
        ))}
      </div>

    </div>
  );
}
