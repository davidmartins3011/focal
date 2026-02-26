import styles from "./StrategyView.module.css";

interface Pillar {
  id: string;
  name: string;
  tagColor: "crm" | "data" | "roadmap" | "saas";
  goal: string;
  progress: number;
  insight: string;
}

interface Reflection {
  id: string;
  prompt: string;
  answer: string;
}

const pillars: Pillar[] = [
  {
    id: "roadmap",
    name: "Roadmap produit",
    tagColor: "roadmap",
    goal: "Piloter la roadmap Q1 et livrer le sprint",
    progress: 80,
    insight: "Sprint review bien cadré, bonne vélocité",
  },
  {
    id: "data",
    name: "Data Platform",
    tagColor: "data",
    goal: "Stabiliser les pipelines dbt en prod",
    progress: 65,
    insight: "2 bugs critiques résolus, 1 en cours",
  },
  {
    id: "crm",
    name: "Relations & CRM",
    tagColor: "crm",
    goal: "Structurer le suivi client et partenaires",
    progress: 40,
    insight: "Suivi encore trop informel, à cadrer",
  },
  {
    id: "saas",
    name: "SaaS TDAH (focal.)",
    tagColor: "saas",
    goal: "Valider le concept et construire le MVP",
    progress: 25,
    insight: "Mockup fait, concept à tester avec 3 personnes",
  },
];

const reflections: Reflection[] = [
  {
    id: "worked",
    prompt: "Ce qui a bien marché",
    answer:
      "Bonne discipline sur les standups. La décomposition de tâches m'aide vraiment — quand je l'utilise. Le focus par blocs de 45 min est efficace.",
  },
  {
    id: "blocked",
    prompt: "Ce qui m'a bloqué",
    answer:
      "Procrastination sur le projet SaaS : trop de tâches floues, pas assez décomposées. Le bug dbt a mangé 3 jours de focus.",
  },
  {
    id: "stop",
    prompt: "Ce que je veux arrêter",
    answer:
      "Checker Slack toutes les 10 min. Accepter des réunions sans agenda clair. Rester sur des tâches bloquées sans demander de l'aide.",
  },
  {
    id: "start",
    prompt: "Ce que je veux commencer",
    answer:
      "Bloquer 1h chaque matin pour le SaaS. Faire la revue du soir systématiquement. Utiliser « Je bloque » au lieu de tourner en rond.",
  },
];

const nextMonthTop3 = [
  "Livrer le MVP focal. (décomposition IA + vue jour)",
  "Clôturer le bug pipeline dbt et documenter la solution",
  "Mettre en place un suivi client structuré (1 check-in/semaine)",
];

const DAYS_SINCE_LAST_REVIEW = 28;

export default function StrategyView() {
  const nudge = DAYS_SINCE_LAST_REVIEW >= 25;

  return (
    <div className={styles.wrap}>
      <div className={styles.ctaCard}>
        <div className={styles.ctaHeader}>
          <span className={styles.ctaIcon}>🧭</span>
          <div>
            <div className={styles.ctaTitle}>Prise de recul — Février 2026</div>
            <div className={`${styles.ctaMeta} ${nudge ? styles.ctaMetaNudge : ""}`}>
              {nudge
                ? `Ça fait ${DAYS_SINCE_LAST_REVIEW} jours — un bon moment pour prendre du recul`
                : `Dernière revue il y a ${DAYS_SINCE_LAST_REVIEW} jours`}
            </div>
          </div>
        </div>
        <p className={styles.ctaText}>
          Prends 15 minutes pour regarder le mois écoulé, ajuster tes piliers,
          et décider de tes priorités pour mars.
        </p>
        <button className={styles.ctaBtn}>Lancer la revue stratégique</button>
      </div>

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Mes piliers</span>
        <span className={styles.sectionHint}>Tes grands axes de travail ce mois-ci</span>
      </div>
      <div className={styles.pillarsGrid}>
        {pillars.map((p) => (
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
        <span className={styles.sectionTitle}>Réflexion du mois</span>
      </div>
      <div className={styles.reflections}>
        {reflections.map((r) => (
          <div key={r.id} className={styles.reflectionCard}>
            <div className={styles.reflectionPrompt}>{r.prompt}</div>
            <div className={styles.reflectionAnswer}>{r.answer}</div>
          </div>
        ))}
      </div>

      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Top 3 — Mars 2026</span>
      </div>
      <div className={styles.top3}>
        {nextMonthTop3.map((item, i) => (
          <div key={i} className={styles.top3Item}>
            <span className={styles.top3Number}>{i + 1}</span>
            <span className={styles.top3Text}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
