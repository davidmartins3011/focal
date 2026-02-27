import { useState } from "react";
import styles from "./SuggestionsView.module.css";

type Impact = "high" | "medium" | "low";
type Category = "planification" | "habitudes" | "focus" | "organisation" | "bien-être";

interface Suggestion {
  id: string;
  icon: string;
  title: string;
  description: string;
  source: string;
  impact: Impact;
  category: Category;
  confidence: number;
}

const IMPACT_LABELS: Record<Impact, string> = {
  high: "Impact élevé",
  medium: "Impact moyen",
  low: "Impact faible",
};

const mockSuggestions: Suggestion[] = [
  {
    id: "s1",
    icon: "🎯",
    title: "Limite tes priorités du jour à 3 tâches",
    description:
      "Cette semaine, tu as mis en moyenne 6 tâches en priorité par jour, et tu n'en as terminé que 2,4. En réduisant à 3, tu augmenterais ton taux de complétion et réduirais la frustration de fin de journée.",
    source: "Observé sur 7 jours d'activité",
    impact: "high",
    category: "planification",
    confidence: 92,
  },
  {
    id: "s2",
    icon: "⏰",
    title: "Planifie tes tâches complexes le matin",
    description:
      "Tes tâches marquées « complexes » sont terminées 2x plus souvent quand elles sont commencées avant 11h. Essaie de les placer systématiquement en début de journée.",
    source: "Analyse de 3 semaines de données",
    impact: "high",
    category: "focus",
    confidence: 87,
  },
  {
    id: "s3",
    icon: "✂️",
    title: "Décompose les tâches de plus de 45 min",
    description:
      "Les tâches que tu estimes à plus de 45 minutes sont abandonnées dans 60% des cas. Quand elles sont décomposées en micro-étapes, ce taux chute à 15%. Utilise la décomposition IA pour les grosses tâches.",
    source: "Comparaison tâches simples vs décomposées",
    impact: "high",
    category: "organisation",
    confidence: 94,
  },
  {
    id: "s4",
    icon: "🧘",
    title: "Ajoute une pause entre 2 blocs de focus",
    description:
      "Tu enchaînes souvent 2-3 blocs de focus sans pause. Après 90 min continues, ta vélocité baisse de 40%. Une pause de 5-10 min entre les blocs maintiendrait ton énergie.",
    source: "Données de tes sessions de focus",
    impact: "medium",
    category: "bien-être",
    confidence: 78,
  },
  {
    id: "s5",
    icon: "📋",
    title: "Fais ta revue du soir avant 19h",
    description:
      "Les jours où tu fais ta revue du soir, tu démarres 35% plus vite le lendemain matin. Actuellement tu ne la fais que 2 jours sur 5 — un rappel à 18h30 pourrait aider.",
    source: "Corrélation revue du soir / démarrage matin",
    impact: "medium",
    category: "habitudes",
    confidence: 82,
  },
  {
    id: "s6",
    icon: "🏷️",
    title: "Utilise des tags pour mieux suivre tes projets",
    description:
      "Tu as 12 tâches sans tag cette semaine. Les tâches taguées sont 25% plus souvent complétées car elles sont mieux contextualisées. Prends 2 min pour taguer tes tâches en cours.",
    source: "Statistiques de complétion par tag",
    impact: "low",
    category: "organisation",
    confidence: 71,
  },
];

export default function SuggestionsView() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const visibleSuggestions = mockSuggestions.filter((s) => !dismissed.has(s.id));
  const appliedCount = applied.size;
  const activeCount = visibleSuggestions.filter((s) => !applied.has(s.id)).length;

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const handleApply = (id: string) => {
    setApplied((prev) => new Set(prev).add(id));
  };

  const impactClass = (impact: Impact) => {
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
        <div className={styles.learningBadge}>
          <span className={styles.pulsingDot} />
          En apprentissage — 3 semaines d'observation
        </div>
      </div>

      <div className={styles.content}>
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
          </div>
        ) : (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Suggestions actives</span>
              <span className={styles.sectionCount}>{visibleSuggestions.length}</span>
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
      </div>
    </div>
  );
}
