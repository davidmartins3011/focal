import { useState, useEffect } from "react";
import { generateSuggestions } from "../services/chat";
import type { Suggestion, SuggestionImpact } from "../types";
import styles from "./SuggestionsView.module.css";

const IMPACT_LABELS: Record<SuggestionImpact, string> = {
  high: "Impact élevé",
  medium: "Impact moyen",
  low: "Impact faible",
};

export default function SuggestionsView() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    generateSuggestions()
      .then(setSuggestions)
      .catch((err) => {
        console.error("[SuggestionsView] generate error:", err);
        setError(typeof err === "string" ? err : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id));
  const appliedCount = applied.size;
  const activeCount = visibleSuggestions.filter((s) => !applied.has(s.id)).length;

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const handleApply = (id: string) => {
    setApplied((prev) => new Set(prev).add(id));
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    generateSuggestions()
      .then(setSuggestions)
      .catch((err) => {
        console.error("[SuggestionsView] refresh error:", err);
        setError(typeof err === "string" ? err : String(err));
      })
      .finally(() => setLoading(false));
  };

  const impactClass = (impact: SuggestionImpact) => {
    switch (impact) {
      case "high": return styles.impactHigh;
      case "medium": return styles.impactMedium;
      case "low": return styles.impactLow;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>💡</span>
          Suggestions
        </div>
        <div className={styles.subtitle}>
          focal. observe ton organisation et te propose des améliorations personnalisées.
        </div>
        {!loading && !error && (
          <div className={styles.learningBadge}>
            <span className={styles.pulsingDot} />
            Basé sur tes données réelles
          </div>
        )}
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>✦</div>
            <div className={styles.emptyTitle}>Analyse en cours…</div>
            <div className={styles.emptyText}>
              focal. analyse ton organisation pour te proposer des suggestions personnalisées.
            </div>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⚙️</div>
            <div className={styles.emptyTitle}>IA non configurée</div>
            <div className={styles.emptyText}>
              Configure un provider IA dans les paramètres pour recevoir des suggestions personnalisées.
            </div>
          </div>
        ) : (
          <>
            <div className={styles.statsBar}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{visibleSuggestions.length}</div>
                <div className={styles.statLabel}>Suggestions</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{activeCount}</div>
                <div className={styles.statLabel}>À explorer</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{appliedCount}</div>
                <div className={styles.statLabel}>Appliquées</div>
              </div>
            </div>

            {visibleSuggestions.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🌱</div>
                <div className={styles.emptyTitle}>Toutes les suggestions traitées</div>
                <div className={styles.emptyText}>
                  focal. continue d'observer ton organisation. De nouvelles suggestions apparaîtront au fil du temps.
                </div>
                <button className={styles.refreshBtn} onClick={handleRefresh}>
                  ↻ Régénérer
                </button>
              </div>
            ) : (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Suggestions actives</span>
                  <button className={styles.refreshBtn} onClick={handleRefresh}>
                    ↻ Actualiser
                  </button>
                </div>
                <div className={styles.suggestionsList}>
                  {visibleSuggestions.map((s) => {
                    const isApplied = applied.has(s.id);
                    return (
                      <div key={s.id} className={`${styles.card} ${isApplied ? styles.applied : ""}`}>
                        <div className={styles.cardTop}>
                          <div className={styles.cardIcon}>{s.icon}</div>
                          <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>{s.title}</div>
                            <div className={styles.cardSource}>{s.source}</div>
                          </div>
                        </div>
                        <div className={styles.cardDesc}>{s.description}</div>
                        <div className={styles.cardMeta}>
                          <span className={`${styles.impactBadge} ${impactClass(s.impact)}`}>
                            ↑ {IMPACT_LABELS[s.impact]}
                          </span>
                          <span className={styles.categoryBadge}>{s.category}</span>
                          <span className={styles.confidenceBadge}>
                            🎯 {s.confidence}% confiance
                          </span>
                        </div>
                        <div className={styles.cardActions}>
                          {isApplied ? (
                            <span className={styles.appliedLabel}>✓ Appliquée</span>
                          ) : (
                            <>
                              <button className={styles.applyBtn} onClick={() => handleApply(s.id)}>
                                Appliquer
                              </button>
                              <button className={styles.dismissBtn} onClick={() => handleDismiss(s.id)}>
                                Ignorer
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
