import type { StrategyReview } from "../types";

export const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export const strategyReviews: StrategyReview[] = [
  {
    id: "review-2026-02",
    month: 1,
    year: 2026,
    createdAt: "2026-02-01T10:00:00",
    pillars: [
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
    ],
    reflections: [
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
    ],
    top3: [
      "Livrer le MVP focal. (décomposition IA + vue jour)",
      "Clôturer le bug pipeline dbt et documenter la solution",
      "Mettre en place un suivi client structuré (1 check-in/semaine)",
    ],
  },
  {
    id: "review-2026-01",
    month: 0,
    year: 2026,
    createdAt: "2026-01-03T09:00:00",
    pillars: [
      {
        id: "roadmap",
        name: "Roadmap produit",
        tagColor: "roadmap",
        goal: "Préparer le planning Q1 et aligner l'équipe",
        progress: 70,
        insight: "Planning Q1 validé, 2 features priorisées",
      },
      {
        id: "data",
        name: "Data Platform",
        tagColor: "data",
        goal: "Migrer les jobs Airflow vers dbt",
        progress: 50,
        insight: "Migration à 50%, quelques edge cases non couverts",
      },
      {
        id: "crm",
        name: "Relations & CRM",
        tagColor: "crm",
        goal: "Reprendre contact avec 5 clients dormants",
        progress: 60,
        insight: "3 clients recontactés, 2 rdv pris",
      },
      {
        id: "saas",
        name: "SaaS TDAH (focal.)",
        tagColor: "saas",
        goal: "Poser les bases : concept, cible, positionnement",
        progress: 15,
        insight: "Brainstorm fait, besoin de valider avec des utilisateurs",
      },
    ],
    reflections: [
      {
        id: "worked",
        prompt: "Ce qui a bien marché",
        answer:
          "Le morning routine est installé. Les blocs de focus marchent quand je coupe les notifs. L'alignement avec l'équipe s'est amélioré grâce aux standups quotidiens.",
      },
      {
        id: "blocked",
        prompt: "Ce qui m'a bloqué",
        answer:
          "Trop de contexte switching entre les projets. Difficulté à dire non aux urgences des autres. Le projet SaaS avance peu car toujours repoussé.",
      },
      {
        id: "stop",
        prompt: "Ce que je veux arrêter",
        answer:
          "Dire oui à toutes les réunions. Travailler le soir au lieu de couper. Repousser les décisions difficiles.",
      },
      {
        id: "start",
        prompt: "Ce que je veux commencer",
        answer:
          "Poser des limites claires sur les créneaux de deep work. Dédier le vendredi après-midi au SaaS. Prendre 5 min de revue en fin de journée.",
      },
    ],
    top3: [
      "Livrer les 2 features Q1 prioritaires d'ici fin janvier",
      "Finir la migration dbt (100% des jobs critiques)",
      "Faire 3 interviews utilisateurs pour le SaaS TDAH",
    ],
  },
  {
    id: "review-2025-12",
    month: 11,
    year: 2025,
    createdAt: "2025-12-02T11:30:00",
    pillars: [
      {
        id: "roadmap",
        name: "Roadmap produit",
        tagColor: "roadmap",
        goal: "Closer le Q4 et préparer la rétrospective",
        progress: 90,
        insight: "Q4 livré à 90%, bonne rétrospective d'équipe",
      },
      {
        id: "data",
        name: "Data Platform",
        tagColor: "data",
        goal: "Stabiliser le pipeline de reporting",
        progress: 75,
        insight: "Pipeline stable, alerting en place",
      },
      {
        id: "crm",
        name: "Relations & CRM",
        tagColor: "crm",
        goal: "Bilan annuel avec les clients clés",
        progress: 55,
        insight: "4 bilans faits sur 7 prévus",
      },
      {
        id: "saas",
        name: "SaaS TDAH (focal.)",
        tagColor: "saas",
        goal: "Explorer l'idée : veille, benchmark, notes",
        progress: 10,
        insight: "Lecture de 3 articles, idée qui mûrit mais rien de concret",
      },
    ],
    reflections: [
      {
        id: "worked",
        prompt: "Ce qui a bien marché",
        answer:
          "La rétrospective Q4 a été très productive. J'ai mieux géré mon énergie en respectant mes pauses. Le fait de poser mes idées par écrit m'a aidé à clarifier le projet SaaS.",
      },
      {
        id: "blocked",
        prompt: "Ce qui m'a bloqué",
        answer:
          "La fatigue de fin d'année. Beaucoup de distractions liées aux fêtes. Difficulté à maintenir le rythme la dernière semaine.",
      },
      {
        id: "stop",
        prompt: "Ce que je veux arrêter",
        answer:
          "Me surcharger en fin de mois pour \"rattraper\". Ignorer les signaux de fatigue. Reporter les bilans clients.",
      },
      {
        id: "start",
        prompt: "Ce que je veux commencer",
        answer:
          "Planifier les semaines le dimanche soir. Mettre en place un vrai outil de suivi (pas juste des notes). Commencer chaque journée par la tâche la plus importante.",
      },
    ],
    top3: [
      "Préparer le planning Q1 avec l'équipe",
      "Lancer la migration Airflow → dbt",
      "Faire un premier wireframe du SaaS TDAH",
    ],
  },
  {
    id: "review-2025-11",
    month: 10,
    year: 2025,
    createdAt: "2025-11-04T08:45:00",
    pillars: [
      {
        id: "roadmap",
        name: "Roadmap produit",
        tagColor: "roadmap",
        goal: "Livrer la feature phare du Q4",
        progress: 60,
        insight: "Feature en cours, besoin de plus de tests",
      },
      {
        id: "data",
        name: "Data Platform",
        tagColor: "data",
        goal: "Automatiser le reporting hebdo",
        progress: 40,
        insight: "Script en place, fiabilisation en cours",
      },
      {
        id: "crm",
        name: "Relations & CRM",
        tagColor: "crm",
        goal: "Relancer les clients inactifs depuis 2 mois",
        progress: 30,
        insight: "Seulement 2 relances envoyées, à accélérer",
      },
      {
        id: "saas",
        name: "SaaS TDAH (focal.)",
        tagColor: "saas",
        goal: "Première réflexion : noter les frustrations quotidiennes",
        progress: 5,
        insight: "Quelques notes, l'idée germe doucement",
      },
    ],
    reflections: [
      {
        id: "worked",
        prompt: "Ce qui a bien marché",
        answer:
          "Le fait de commencer la journée sans réunion m'a donné un vrai boost de productivité. Les standups courts fonctionnent bien.",
      },
      {
        id: "blocked",
        prompt: "Ce qui m'a bloqué",
        answer:
          "Trop de tâches en parallèle. Je perds du temps à redécouvrir le contexte quand je switch. Le reporting est rébarbatif et je procrastine.",
      },
      {
        id: "stop",
        prompt: "Ce que je veux arrêter",
        answer:
          "Garder 10 onglets ouverts \"pour plus tard\". Essayer de tout faire en même temps.",
      },
      {
        id: "start",
        prompt: "Ce que je veux commencer",
        answer:
          "Utiliser un timer Pomodoro. Bloquer des créneaux \"pas de réunion\" dans le calendrier. Écrire mes pensées au lieu de les garder en tête.",
      },
    ],
    top3: [
      "Livrer la feature Q4 et la mettre en prod",
      "Automatiser le reporting : 0 action manuelle",
      "Faire les bilans annuels clients avant décembre",
    ],
  },
];
