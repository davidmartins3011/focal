import { useState, useEffect, useCallback } from "react";
import {
  getSuggestions,
  respondToSuggestion,
  checkAndRunSuggestions,
  runSuggestionsNow,
  getLastSuggestionsRun,
} from "../services/chat";
import type { Suggestion, SuggestionImpact } from "../types";
import styles from "./SuggestionsView.module.css";

const IMPACT_LABELS: Record<SuggestionImpact, string> = {
  high: "Impact élevé",
  medium: "Impact moyen",
  low: "Impact faible",
};

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "hier";
  return `il y a ${diffDays} jours`;
}

export default function SuggestionsView() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, run] = await Promise.all([
        getSuggestions(),
        getLastSuggestionsRun(),
      ]);
      setSuggestions(data);
      setLastRun(run);
    } catch (err) {
      console.error("[SuggestionsView] load error:", err);
      setError(typeof err === "string" ? err : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    checkAndRunSuggestions()
      .then(() => load())
      .catch((err) => {
        console.error("[SuggestionsView] init error:", err);
        load();
      })
      .finally(() => setLoading(false));
  }, [load]);

  const pending = suggestions.filter((s) => s.status === "pending");
  const later = suggestions.filter((s) => s.status === "later");
  const accepted = suggestions.filter((s) => s.status === "accepted");

  const handleRespond = async (id: string, status: "accepted" | "rejected" | "later") => {
    await respondToSuggestion(id, status);
    if (status === "rejected") {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } else {
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s)),
      );
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await runSuggestionsNow();
      await load();
    } catch (err) {
      console.error("[SuggestionsView] generate error:", err);
      setError(typeof err === "string" ? err : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const impactClass = (impact: SuggestionImpact) => {
    switch (impact) {
      case "high":
        return styles.impactHigh;
      case "medium":
        return styles.impactMedium;
      case "low":
        return styles.impactLow;
    }
  };

  const renderCard = (s: Suggestion, showActions = true) => {
    const isPending = s.status === "pending" || s.status === "later";
    return (
      <div
        key={s.id}
        className={`${styles.card} ${!isPending ? styles.applied : ""}`}
      >
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
        {showActions && (
          <div className={styles.cardActions}>
            {isPending ? (
              <>
                <button
                  className={styles.applyBtn}
                  onClick={() => handleRespond(s.id, "accepted")}
                >
                  ✓ Pertinent
                </button>
                <button
                  className={styles.laterBtn}
                  onClick={() => handleRespond(s.id, "later")}
                >
                  ⏳ Plus tard
                </button>
                <button
                  className={styles.dismissBtn}
                  onClick={() => handleRespond(s.id, "rejected")}
                >
                  ✗ Non pertinent
                </button>
              </>
          ) : (
            <span className={styles.appliedLabel}>✓ Pertinent</span>
          )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>💡</span>
          Suggestions
        </div>
        <div className={styles.subtitle}>
          focal. analyse ton organisation toutes les semaines et te propose des
          améliorations personnalisées.
        </div>
        <div className={styles.headerMeta}>
          {!loading && !error && suggestions.length > 0 && (
            <div className={styles.learningBadge}>
              <span className={styles.pulsingDot} />
              Basé sur tes 14 derniers jours
            </div>
          )}
          {lastRun && (
            <div className={styles.lastRunBadge}>
              Dernière analyse : {formatRelativeDate(lastRun)}
            </div>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>✦</div>
            <div className={styles.emptyTitle}>Chargement…</div>
            <div className={styles.emptyText}>
              Récupération de tes suggestions personnalisées.
            </div>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⚙️</div>
            <div className={styles.emptyTitle}>IA non configurée</div>
            <div className={styles.emptyText}>
              Configure un provider IA dans les paramètres pour recevoir des
              suggestions personnalisées.
            </div>
          </div>
        ) : suggestions.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🌱</div>
            <div className={styles.emptyTitle}>Pas encore de suggestions</div>
            <div className={styles.emptyText}>
              focal. a besoin de données pour t'aider. Utilise l'app quelques
              jours, puis génère tes premières suggestions.
            </div>
            <button
              className={styles.refreshBtn}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Analyse en cours…" : "✦ Générer maintenant"}
            </button>
          </div>
        ) : (
          <>
            <div className={styles.statsBar}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{suggestions.length}</div>
                <div className={styles.statLabel}>Total</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{pending.length}</div>
                <div className={styles.statLabel}>À évaluer</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{accepted.length}</div>
                <div className={styles.statLabel}>Pertinentes</div>
              </div>
            </div>

            {pending.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    Nouvelles suggestions
                  </span>
                  <button
                    className={styles.refreshBtn}
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    {generating ? "Analyse…" : "✦ Régénérer"}
                  </button>
                </div>
                <div className={styles.suggestionsList}>
                  {pending.map((s) => renderCard(s))}
                </div>
              </div>
            )}

            {pending.length === 0 && later.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>✅</div>
                <div className={styles.emptyTitle}>
                  Toutes les suggestions évaluées
                </div>
                <div className={styles.emptyText}>
                  De nouvelles suggestions seront générées automatiquement la
                  semaine prochaine.
                </div>
                <button
                  className={styles.refreshBtn}
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? "Analyse…" : "✦ Générer maintenant"}
                </button>
              </div>
            )}

            {later.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    Remises à plus tard
                  </span>
                  <span className={styles.sectionCount}>
                    {later.length}
                  </span>
                </div>
                <div className={styles.suggestionsList}>
                  {later.map((s) => renderCard(s))}
                </div>
              </div>
            )}

            {accepted.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    Suggestions pertinentes
                  </span>
                  <span className={styles.sectionCount}>
                    {accepted.length}
                  </span>
                </div>
                <div className={styles.suggestionsList}>
                  {accepted.map((s) => renderCard(s, false))}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
