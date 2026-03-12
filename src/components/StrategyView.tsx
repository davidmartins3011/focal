import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MONTH_NAMES } from "../data/strategyConstants";
import {
  getStrategyPeriods,
  createStrategyPeriod,
  closeStrategyPeriod,
  carryOverGoals,
  getStrategyGoals,
  upsertStrategyGoal,
  deleteStrategyGoal,
  upsertStrategy,
  deleteStrategy,
  upsertTactic,
  deleteTactic,
  upsertPeriodReflection,
  getPeriodSummary,
  getGoalStrategyLinks,
  toggleGoalStrategyLink,
} from "../services/reviews";
import type {
  StrategyFrequency,
  StrategyPeriod,
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

function goalProgress(goal: StrategyGoal): number {
  let total = 0, done = 0;
  for (const s of goal.strategies) for (const t of s.tactics) for (const a of t.actions) { total++; if (a.done) done++; }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function computeCurrentPeriod(freq: StrategyFrequency, cycleStart: number) {
  const now = new Date();
  const cm = now.getMonth();
  const cy = now.getFullYear();
  if (freq === "monthly") return { startMonth: cm, startYear: cy, endMonth: cm, endYear: cy };
  const step = freq === "bimonthly" ? 2 : freq === "quarterly" ? 3 : 6;
  const s0 = cycleStart - 1;
  const starts: number[] = [];
  for (let m = s0; m < 12; m += step) starts.push(m);
  if (cm < starts[0]) {
    const sm = starts[starts.length - 1];
    const em = sm + step - 1;
    return { startMonth: sm, startYear: cy - 1, endMonth: em >= 12 ? em - 12 : em, endYear: em >= 12 ? cy : cy - 1 };
  }
  let sm = starts[0];
  for (let i = starts.length - 1; i >= 0; i--) if (cm >= starts[i]) { sm = starts[i]; break; }
  const em = sm + step - 1;
  return { startMonth: sm, startYear: cy, endMonth: em >= 12 ? em - 12 : em, endYear: em >= 12 ? cy + 1 : cy };
}

function periodChipLabel(p: StrategyPeriod): string {
  const freq = p.frequency as StrategyFrequency;
  const short = MONTH_NAMES[p.startMonth].slice(0, 3);
  if (freq === "monthly") return `${short}.`;
  if (freq === "bimonthly") return `${short}-${MONTH_NAMES[p.endMonth].slice(0, 3)}`;
  if (freq === "quarterly") return `T${Math.floor(p.startMonth / 3) + 1}`;
  return `S${p.startMonth < 6 ? 1 : 2}`;
}

function periodTitleLabel(p: StrategyPeriod): string {
  const first = MONTH_NAMES[p.startMonth];
  if (p.startMonth === p.endMonth) return first;
  return `${first} — ${MONTH_NAMES[p.endMonth]}`;
}

function periodDateRange(p: StrategyPeriod): { start: string; end: string } {
  const s = new Date(p.startYear, p.startMonth, 1);
  const e = new Date(p.endYear, p.endMonth + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(s), end: fmt(e) };
}

function frequencyLabel(freq: string): string {
  switch (freq) {
    case "monthly": return "du mois";
    case "bimonthly": return "de la période";
    case "quarterly": return "du trimestre";
    case "biannual": return "du semestre";
    default: return "de la période";
  }
}

const TAG_META: Record<string, { label: string; icon: string; color: string }> = {
  roadmap: { label: "Produit", icon: "🚀", color: "var(--accent)" },
  data:    { label: "Data",    icon: "📊", color: "var(--blue)" },
  saas:    { label: "SaaS",    icon: "💡", color: "var(--purple)" },
  crm:     { label: "CRM",     icon: "🤝", color: "var(--green)" },
};

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
        onClick={(e) => e.stopPropagation()}
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
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
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
  // ── Periods state ──
  const [periods, setPeriods] = useState<StrategyPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const initialLoad = useRef(true);

  const loadPeriods = useCallback(async () => {
    try {
      const data = await getStrategyPeriods();
      setPeriods(data);
      if (initialLoad.current) {
        const active = data.find((p) => p.status === "active");
        setSelectedPeriodId(active?.id ?? data[0]?.id ?? "");
        initialLoad.current = false;
      }
    } catch (err) {
      console.error("[StrategyView] loadPeriods error:", err);
    }
  }, []);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const activePeriod = periods.find((p) => p.status === "active");
  const isActive = selectedPeriod?.status === "active";

  const previousPeriod = useMemo(() => {
    if (!isActive) return null;
    return periods.find((p) => p.status === "closed") ?? null;
  }, [periods, isActive]);

  const previousCommitments = useMemo(() => {
    if (!previousPeriod) return null;
    const stop = previousPeriod.reflections.find((r) => r.prompt.includes("arrêter"));
    const start = previousPeriod.reflections.find((r) => r.prompt.includes("commencer"));
    if (!stop?.answer && !start?.answer) return null;
    return { stop: stop?.answer || "", start: start?.answer || "" };
  }, [previousPeriod]);

  // ── Goals state ──
  const [goals, setGoals] = useState<StrategyGoal[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [goalLinks, setGoalLinks] = useState<Map<string, string[]>>(new Map());

  const reloadGoals = useCallback(() => {
    if (!selectedPeriodId) return;
    getStrategyGoals(selectedPeriodId)
      .then(setGoals)
      .catch((err) => console.error("[StrategyView] getStrategyGoals error:", err));
    getGoalStrategyLinks(selectedPeriodId)
      .then((links) => {
        const map = new Map<string, string[]>();
        for (const l of links) {
          const arr = map.get(l.strategyId) ?? [];
          arr.push(l.goalId);
          map.set(l.strategyId, arr);
        }
        setGoalLinks(map);
      })
      .catch((err) => console.error("[StrategyView] getGoalStrategyLinks error:", err));
  }, [selectedPeriodId]);

  useEffect(() => { reloadGoals(); }, [reloadGoals]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Bilan state ──
  const [bilan, setBilan] = useState<PeriodSummary | null>(null);

  useEffect(() => {
    if (!selectedPeriod) { setBilan(null); return; }
    const { start, end } = periodDateRange(selectedPeriod);
    getPeriodSummary(start, end)
      .then(setBilan)
      .catch((err) => console.error("[StrategyView] getPeriodSummary error:", err));
  }, [selectedPeriod?.id]);

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

  // ── Period lifecycle ──

  const handleCreatePeriod = async () => {
    const p = computeCurrentPeriod(frequency, cycleStart);
    const id = `period-${crypto.randomUUID().slice(0, 12)}`;
    try {
      await createStrategyPeriod({
        id,
        startMonth: p.startMonth,
        startYear: p.startYear,
        endMonth: p.endMonth,
        endYear: p.endYear,
        frequency,
      });
      setSelectedPeriodId(id);
      await loadPeriods();
    } catch (err) {
      console.error("[StrategyView] createPeriod error:", err);
    }
  };

  const handleClosePeriod = async () => {
    if (!selectedPeriod || !confirm("Clôturer cette période ? Tu pourras toujours la consulter dans l'historique.")) return;
    try {
      await closeStrategyPeriod(selectedPeriod.id);
      await loadPeriods();
    } catch (err) {
      console.error("[StrategyView] closePeriod error:", err);
    }
  };

  const handleCarryOver = async () => {
    if (!previousPeriod || !selectedPeriod) return;
    try {
      await carryOverGoals(previousPeriod.id, selectedPeriod.id);
      reloadGoals();
    } catch (err) {
      console.error("[StrategyView] carryOver error:", err);
    }
  };

  // ── Goal CRUD ──

  const handleAddGoal = async () => {
    const id = uid();
    await upsertStrategyGoal({ id, title: "Nouvel objectif", target: "", position: goals.length, periodId: selectedPeriodId || undefined });
    reloadGoals();
  };

  const handleUpdateGoal = async (goal: StrategyGoal, field: "title" | "target" | "deadline", value: string) => {
    await upsertStrategyGoal({
      id: goal.id,
      title: field === "title" ? value : goal.title,
      target: field === "target" ? value : goal.target,
      deadline: field === "deadline" ? (value || undefined) : goal.deadline,
      position: goals.indexOf(goal),
      periodId: selectedPeriodId || undefined,
    });
    reloadGoals();
  };

  const handleDeleteGoal = async (id: string) => { await deleteStrategyGoal(id); reloadGoals(); };

  // ── Strategy CRUD ──

  const handleAddStrategy = async (goalId: string, count: number) => {
    await upsertStrategy({ id: uid(), goalId, title: "Nouvel objectif", description: "", position: count });
    reloadGoals();
  };

  const handleUpdateStrategy = async (s: StrategyStrategy, goalId: string, field: "title" | "description", value: string, position: number) => {
    await upsertStrategy({ id: s.id, goalId, title: field === "title" ? value : s.title, description: field === "description" ? value : s.description, position });
    reloadGoals();
  };

  const handleDeleteStrategy = async (id: string) => { await deleteStrategy(id); reloadGoals(); };

  // ── Tactic CRUD ──

  const handleAddTactic = async (strategyId: string, count: number) => {
    await upsertTactic({ id: uid(), strategyId, title: "Nouvelle stratégie", description: "", position: count });
    reloadGoals();
  };

  const handleUpdateTactic = async (t: StrategyTactic, strategyId: string, field: "title" | "description", value: string, position: number) => {
    await upsertTactic({ id: t.id, strategyId, title: field === "title" ? value : t.title, description: field === "description" ? value : t.description, position });
    reloadGoals();
  };

  const handleDeleteTactic = async (id: string) => { await deleteTactic(id); reloadGoals(); };

  // ── Reflection update ──

  const handleReflectionChange = (reflId: string, answer: string) => {
    setPeriods((prev) =>
      prev.map((p) =>
        p.id === selectedPeriodId
          ? { ...p, reflections: p.reflections.map((r) => (r.id === reflId ? { ...r, answer } : r)) }
          : p,
      ),
    );
  };

  // ── Render: Cap à tenir ──

  const renderNorthStarGoals = () => (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Cap à tenir</span>
        <button className={styles.addGoalBtn} onClick={handleAddGoal}>+ Cap</button>
      </div>

      {goals.length === 0 ? (
        <div className={styles.gstaEmpty}>
          <div className={styles.gstaEmptyText}>
            {isActive
              ? "Définis les grands caps à tenir — les ambitions qui guident cette période."
              : "Aucun cap défini pour cette période."}
          </div>
          <div className={styles.gstaEmptyBtns}>
            <button className={styles.gstaEmptyBtn} onClick={handleAddGoal}>Définir un cap</button>
            {isActive && previousPeriod && (
              <button className={styles.carryOverBtn} onClick={handleCarryOver}>
                Reprendre les objectifs précédents
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.goalsList}>
          {goals.map((goal) => {
            const pct = goalProgress(goal);

            return (
              <div key={goal.id} className={styles.northStarCard}>
                <button className={styles.northStarDeleteBtn} onClick={() => handleDeleteGoal(goal.id)} title="Supprimer">×</button>
                <div className={styles.northStarHeader}>
                  <span className={styles.northStarIcon}>⭐</span>
                  <div className={styles.northStarContent}>
                    <InlineEdit value={goal.title} onSave={(v) => handleUpdateGoal(goal, "title", v)} className={`${styles.goalTitle} ${styles.noHoverBg}`} tag="h3" />
                    <div className={styles.northStarMetaRow}>
                      <InlineEdit value={goal.target} onSave={(v) => handleUpdateGoal(goal, "target", v)} className={`${styles.goalTarget} ${styles.noHoverBg}`} placeholder="Description..." />
                      <span className={styles.northStarDeadlineSep}>·</span>
                      <span className={styles.northStarDeadlineLabel}>Échéance</span>
                      <input
                        type="date"
                        className={styles.northStarDeadlineInput}
                        value={goal.deadline ?? ""}
                        onChange={(e) => handleUpdateGoal(goal, "deadline", e.target.value)}
                      />
                    </div>
                    {pct > 0 && (
                      <div className={styles.progressRow}>
                        <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${pct}%` }} /></div>
                        <span className={styles.progressPct}>{pct}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // ── Render: Mes objectifs (strategies + tactics) ──

  const allStrategies = useMemo(() =>
    goals.flatMap((goal) =>
      goal.strategies.map((strat) => ({ ...strat, goalId: goal.id }))
    ),
    [goals],
  );

  const [linkPickerOpen, setLinkPickerOpen] = useState<string | null>(null);
  const linkPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!linkPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (linkPickerRef.current && !linkPickerRef.current.contains(e.target as Node)) {
        setLinkPickerOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [linkPickerOpen]);

  const handleToggleLink = async (goalId: string, strategyId: string) => {
    await toggleGoalStrategyLink(goalId, strategyId);
    reloadGoals();
  };

  const renderObjectives = () => (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Mes objectifs</span>
        {goals.length > 0 && (
          <button className={styles.addGoalBtn} onClick={() => {
            if (goals.length > 0) handleAddStrategy(goals[0].id, goals[0].strategies.length);
          }}>+ Objectif</button>
        )}
      </div>

      {allStrategies.length === 0 ? (
        <div className={styles.gstaEmpty}>
          <div className={styles.gstaEmptyText}>
            {goals.length === 0
              ? "Ajoute d'abord un cap à tenir pour créer des objectifs."
              : "Décompose tes caps en objectifs concrets."}
          </div>
          {goals.length > 0 && (
            <div className={styles.gstaEmptyBtns}>
              <button className={styles.gstaEmptyBtn} onClick={() => handleAddStrategy(goals[0].id, goals[0].strategies.length)}>
                Créer un objectif
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.goalsList}>
          {goals.map((goal) =>
            goal.strategies.map((strat, si) => {
              const isCollapsed = collapsed.has(strat.id);
              const linkedGoalIds = goalLinks.get(strat.id) ?? [];
              const linkedGoals = goals.filter((g) => linkedGoalIds.includes(g.id));
              const pickerOpen = linkPickerOpen === strat.id;

              return (
                <div key={strat.id} className={styles.objectiveCard}>
                  <div className={styles.objectiveHeader} onClick={() => toggle(strat.id)}>
                    <span className={`${styles.chevron} ${isCollapsed ? "" : styles.chevronOpen}`}>›</span>
                    <div className={styles.objectiveHeaderContent}>
                      <div className={styles.goalTitleRow}>
                        <InlineEdit value={strat.title} onSave={(v) => handleUpdateStrategy(strat, goal.id, "title", v, si)} className={styles.objectiveTitle} />
                        <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDeleteStrategy(strat.id); }} title="Supprimer l'objectif">×</button>
                      </div>
                      <div className={styles.linkedGoals} onClick={(e) => e.stopPropagation()} ref={pickerOpen ? linkPickerRef : undefined}>
                        {linkedGoals.map((g) => (
                          <button key={g.id} className={styles.linkedGoalTag} title="Cliquer pour délier" onClick={() => handleToggleLink(g.id, strat.id)}>
                            ⭐ {g.title}
                            <span className={styles.linkedGoalRemove}>×</span>
                          </button>
                        ))}
                        <button
                          className={styles.linkGoalBtn}
                          onClick={() => setLinkPickerOpen(pickerOpen ? null : strat.id)}
                        >
                          {linkedGoals.length === 0 ? "+ Lier à un cap" : "+"}
                        </button>
                        {pickerOpen && (() => {
                          const unlinked = goals.filter((g) => !linkedGoalIds.includes(g.id));
                          if (unlinked.length === 0) {
                            setLinkPickerOpen(null);
                            return null;
                          }
                          return (
                            <div className={styles.linkPicker}>
                              {unlinked.map((g) => (
                                <button
                                  key={g.id}
                                  className={styles.linkPickerItem}
                                  onClick={() => { handleToggleLink(g.id, strat.id); setLinkPickerOpen(null); }}
                                >
                                  ⭐ {g.title}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className={styles.subObjectivesBody}>
                      {strat.tactics.map((tactic, ti) => (
                        <div key={tactic.id} className={styles.subObjectiveItem}>
                          <span className={styles.subObjectiveDot} />
                          <InlineEdit value={tactic.title} onSave={(v) => handleUpdateTactic(tactic, strat.id, "title", v, ti)} className={`${styles.subObjectiveText} ${styles.noHoverBg}`} />
                          <button className={styles.deleteBtnSm} onClick={() => handleDeleteTactic(tactic.id)} title="Supprimer">×</button>
                        </div>
                      ))}
                      <button className={styles.addTacticBtn} onClick={() => handleAddTactic(strat.id, strat.tactics.length)}>+ Stratégie</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );

  // ── Main render ──

  return (
    <div className={styles.wrap}>

      {/* ── Period selector ── */}
      {periods.length > 0 && (
        <div className={styles.monthSelector}>
          {!activePeriod && (
            <button className={styles.newPeriodChip} onClick={handleCreatePeriod}>
              + Nouvelle période
            </button>
          )}
          {periods.map((p) => {
            const active = p.id === selectedPeriodId;
            return (
              <button
                key={p.id}
                className={`${styles.monthChip} ${active ? styles.monthChipActive : ""} ${p.status === "closed" ? styles.monthChipClosed : ""}`}
                onClick={() => setSelectedPeriodId(p.id)}
              >
                <span className={styles.monthChipLabel}>{periodChipLabel(p)}</span>
                <span className={styles.monthChipYear}>{p.startYear}</span>
                {p.status === "closed" && <span className={styles.monthChipCheck}>✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Empty state: no periods at all ── */}
      {periods.length === 0 && (
        <div className={styles.ctaCard}>
          <div className={styles.ctaHeader}>
            <span className={styles.ctaIcon}>🧭</span>
            <div>
              <div className={styles.ctaTitle}>Bienvenue dans la prise de recul</div>
              <div className={styles.ctaMeta}>Commence par préparer ta première période</div>
            </div>
          </div>
          <p className={styles.ctaText}>
            Définis tes objectifs, suis tes statistiques, et fais le bilan en fin de période pour progresser continuellement.
          </p>
          <button className={styles.ctaBtn} onClick={handleCreatePeriod}>
            Préparer ma première période
          </button>
        </div>
      )}

      {/* ── Selected period content ── */}
      {selectedPeriod && (
        <>
          {/* Closed banner */}
          {selectedPeriod.status === "closed" && (
            <div className={styles.closedBanner}>
              <span className={styles.closedBannerIcon}>📖</span>
              <div>
                <div className={styles.closedBannerTitle}>
                  Période clôturée — {periodTitleLabel(selectedPeriod)} {selectedPeriod.startYear}
                </div>
                <div className={styles.closedBannerMeta}>
                  Les modifications seront sauvegardées mais cette période est terminée.
                </div>
              </div>
            </div>
          )}

          {/* Active period header */}
          {isActive && (
            <div className={styles.ctaCard}>
              <div className={styles.ctaHeader}>
                <span className={styles.ctaIcon}>🧭</span>
                <div>
                  <div className={styles.ctaTitle}>
                    {periodTitleLabel(selectedPeriod)} {selectedPeriod.startYear}
                  </div>
                  <div className={styles.ctaMeta}>Période en cours</div>
                </div>
              </div>
            </div>
          )}

          {/* Cap à tenir */}
          {renderNorthStarGoals()}

          {/* Mes objectifs */}
          {renderObjectives()}

          {/* Previous commitments */}
          {isActive && previousCommitments && (
            <div className={styles.commitments}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Engagements de la période précédente</span>
              </div>
              {previousCommitments.stop && (
                <div className={styles.commitmentCard}>
                  <span className={styles.commitmentIcon}>🛑</span>
                  <div>
                    <div className={styles.commitmentLabel}>Ce que je voulais arrêter</div>
                    <div className={styles.commitmentText}>{previousCommitments.stop}</div>
                  </div>
                </div>
              )}
              {previousCommitments.start && (
                <div className={styles.commitmentCard}>
                  <span className={styles.commitmentIcon}>🚀</span>
                  <div>
                    <div className={styles.commitmentLabel}>Ce que je voulais commencer</div>
                    <div className={styles.commitmentText}>{previousCommitments.start}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bilan / Avancement */}
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              {isActive ? "Avancement de la période" : "Bilan de la période"}
            </span>
          </div>

          {bilan && bilan.tasksTotal > 0 ? (
            <>
              <div className={styles.bilanGrid}>
                <div className={styles.bilanStat}>
                  <div className={styles.bilanStatValue}>
                    {bilan.tasksCompleted}<span className={styles.bilanStatSlash}>/{bilan.tasksTotal}</span>
                  </div>
                  <div className={styles.bilanStatLabel}>tâches terminées</div>
                  <div className={styles.bilanStatBar}>
                    <div className={styles.bilanStatFill} style={{ width: `${Math.round((bilan.tasksCompleted / bilan.tasksTotal) * 100)}%` }} />
                  </div>
                </div>
                <div className={styles.bilanStat}>
                  <div className={styles.bilanStatValue}>
                    {bilan.focusDays}<span className={styles.bilanStatSlash}>/{bilan.totalDays}j</span>
                  </div>
                  <div className={styles.bilanStatLabel}>jours de focus</div>
                  <div className={styles.bilanStatBar}>
                    <div className={`${styles.bilanStatFill} ${styles.bilanStatFillAlt}`} style={{ width: `${Math.round((bilan.focusDays / bilan.totalDays) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {bilanDistribution.length > 0 && (
                <div className={styles.bilanDistribution}>
                  <div className={styles.bilanDistBar}>
                    {bilanDistribution.map((d) => (
                      <div key={d.label} className={styles.bilanDistSegment} style={{ width: `${d.pct}%`, background: d.color }} title={`${d.label} — ${d.pct}%`} />
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
          ) : (
            <div className={styles.bilanEmpty}>Pas encore de données pour cette période.</div>
          )}

          {/* Reflections */}
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Réflexion {frequencyLabel(selectedPeriod.frequency)}</span>
          </div>
          <div className={styles.reflections}>
            {selectedPeriod.reflections.map((r, i) => (
              <div key={r.id} className={styles.reflectionCard}>
                <div className={styles.reflectionPrompt}>{r.prompt}</div>
                <textarea
                  className={styles.reflectionTextarea}
                  value={r.answer}
                  placeholder="Écris ta réflexion ici..."
                  rows={2}
                  onChange={(e) => handleReflectionChange(r.id, e.target.value)}
                  onBlur={(e) => {
                    upsertPeriodReflection({
                      id: r.id,
                      periodId: selectedPeriod.id,
                      prompt: r.prompt,
                      answer: (e.target as HTMLTextAreaElement).value,
                      position: i,
                    }).catch(console.error);
                  }}
                  ref={(el) => {
                    if (el && r.answer) {
                      el.style.height = "auto";
                      el.style.height = el.scrollHeight + "px";
                    }
                  }}
                />
              </div>
            ))}
          </div>

          {/* Close period */}
          {isActive && (
            <div className={styles.closePeriodSection}>
              <button className={styles.closePeriodBtn} onClick={handleClosePeriod}>
                Clôturer la période
              </button>
              <span className={styles.closePeriodHint}>
                Remplis tes réflexions avant de clôturer. Tu pourras toujours consulter cette période dans l'historique.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
