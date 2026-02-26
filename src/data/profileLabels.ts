export const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  site_web: "Site web",
  entreprise: "Entreprise",
  autre: "Autre",
};

export const LABELS = {
  mainContext: {
    travail_salarie: "Travail salarié",
    independant: "Indépendant / entrepreneur",
    etudes: "Études / formation",
    parent: "Parent / famille",
    mix: "Mix de plusieurs rôles",
    autre: "Autre",
  },
  adhdRecognition: {
    diagnostique: "Oui, diagnostiqué",
    fortement: "Oui, fortement",
    un_peu: "Un peu",
    non: "Non / je ne sais pas",
  },
  blockers: {
    commencer: "Savoir par quoi commencer",
    oublier: "Ne pas oublier",
    agir: "Passer à l'action",
    finir: "Finir ce que je commence",
    trop_head: "Trop de choses en tête",
    motivation: "Manque de motivation",
  },
  remindersPreference: {
    clairs_frequents: "Des rappels clairs et fréquents",
    peu_choisis: "Peu de rappels mais bien choisis",
    minimum: "Le minimum possible",
    ca_depend: "Ça dépend des jours",
  },
  organizationHorizon: {
    aujourdhui: "Aujourd'hui",
    semaine: "La semaine",
    projets_longs: "Des projets longs",
    mix: "Un mix",
  },
  mainExpectation: {
    me_dire_quoi_faire: "Me dise quoi faire maintenant",
    prioriser: "M'aide à prioriser",
    allege_tete: "M'allège la tête",
    avancer_sans_pression: "M'aide à avancer sans pression",
    cadrer: "Me cadre un peu plus",
  },
} as const;

export const BLOCKER_KEYS = ["commencer", "oublier", "agir", "finir", "trop_head", "motivation"] as const;
export const MAIN_CONTEXT_KEYS = ["travail_salarie", "independant", "etudes", "parent", "mix", "autre"] as const;
export const ADHD_KEYS = ["diagnostique", "fortement", "un_peu", "non"] as const;
export const REMINDERS_KEYS = ["clairs_frequents", "peu_choisis", "minimum", "ca_depend"] as const;
export const HORIZON_KEYS = ["aujourdhui", "semaine", "projets_longs", "mix"] as const;
export const EXPECTATION_KEYS = ["me_dire_quoi_faire", "prioriser", "allege_tete", "avancer_sans_pression", "cadrer"] as const;
