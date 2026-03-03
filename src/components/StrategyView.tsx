import { useState, useMemo, useEffect } from "react";
import { MONTH_NAMES } from "../data/strategyConstants";
import { getStrategyReviews } from "../services/reviews";
import {
  getActiveMonths,
  strategyPeriodLabel,
  strategyCtaLabel,
  strategyNudgeThreshold,
} from "../data/settingsConstants";
import type { StrategyReview, StrategyFrequency } from "../types";
import styles from "./StrategyView.module.css";

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

interface StrategyViewProps {
  frequency: StrategyFrequency;
  cycleStart: number;
}

export default function StrategyView({ frequency, cycleStart }: StrategyViewProps) {
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

  if (!review) {
    return (
      <div className={styles.wrap}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🧭</div>
          <div className={styles.emptyTitle}>Aucune revue pour cette fréquence</div>
          <div className={styles.emptyText}>
            Change la fréquence dans les paramètres ou lance ta première prise de recul.
          </div>
        </div>
      </div>
    );
  }

  const isLatest = review.id === sorted[0]?.id;
  const daysSince = daysSinceReview(review);
  const nudge = isLatest && daysSince >= strategyNudgeThreshold(frequency);
  const periodLabel = strategyPeriodLabel(frequency);

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
            Prends 15 minutes pour regarder {strategyCtaLabel(frequency)}, ajuster tes piliers,
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
        <span className={styles.sectionTitle}>Mes piliers</span>
        <span className={styles.sectionHint}>
          {isLatest
            ? `Tes grands axes de travail ${frequency === "monthly" ? "ce mois-ci" : "cette période"}`
            : `Axes de travail en ${MONTH_NAMES[review.month].toLowerCase()} ${review.year}`}
        </span>
      </div>
      <div className={styles.pillarsGrid}>
        {review.pillars.map((p) => (
          <div key={p.id} className={styles.pillarCard}>
            <div className={styles.pillarHeader}>
              <span className={`${styles.pillarTag} ${styles[p.tagColor]}`}>
                {p.name}
              </span>
              <span className={styles.pillarPct}>{p.progress}%</span>
            </div>
            <div className={styles.pillarGoal}>{p.goal}</div>
            <div className={styles.pillarBar}>
              <div
                className={`${styles.pillarFill} ${styles[`fill_${p.tagColor}`]}`}
                style={{ width: `${p.progress}%` }}
              />
            </div>
            <div className={styles.pillarInsight}>💡 {p.insight}</div>
          </div>
        ))}
      </div>

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

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>
          Top 3 — {nextPeriodLabel(review, frequency)}
        </span>
      </div>
      <div className={styles.top3}>
        {review.top3.map((item, i) => (
          <div key={i} className={styles.top3Item}>
            <span className={styles.top3Number}>{i + 1}</span>
            <span className={styles.top3Text}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
