export interface MicroStep {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  name: string;
  done: boolean;
  tags: Tag[];
  microSteps?: MicroStep[];
  aiDecomposed?: boolean;
  estimatedMinutes?: number;
}

export interface Tag {
  label: string;
  color: "crm" | "data" | "roadmap" | "saas" | "urgent";
}

export interface WeekDay {
  name: string;
  date: number;
  isToday: boolean;
  taskSummary: string;
  dots: ("done" | "pending" | "empty")[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  steps?: { text: string }[];
}

export type ViewTab = "today" | "week" | "review";

export type SidebarPage = "main" | "calendar" | "integrations" | "settings" | "profile";

/** Une source de recherche de profil (LinkedIn, site web, etc.) */
export interface ProfileResearchSource {
  source: "linkedin" | "site_web" | "entreprise" | "autre";
  sourceUrl?: string;
  scrapedAt?: string; // ISO date
}

/** Profil utilisateur (alimenté par l'onboarding via le chat) */
export interface UserProfile {
  firstName?: string;
  mainContext?: "travail_salarie" | "independant" | "etudes" | "parent" | "mix" | "autre";
  mainContextOther?: string;
  jobActivity?: string;
  profileResearch?: boolean;
  profileResearchIdentifier?: "entreprise" | "site_web" | "linkedin" | "autre";
  profileResearchIdentifierValue?: string;
  /** Sources à scraper (LinkedIn, site web, etc.) — plusieurs possibles */
  profileResearchSources?: ProfileResearchSource[];
  adhdRecognition?: "diagnostique" | "fortement" | "un_peu" | "non";
  blockers?: ("commencer" | "oublier" | "agir" | "finir" | "trop_head" | "motivation")[];
  remindersPreference?: "clairs_frequents" | "peu_choisis" | "minimum" | "ca_depend";
  organizationHorizon?: "aujourdhui" | "semaine" | "projets_longs" | "mix";
  mainExpectation?: "me_dire_quoi_faire" | "prioriser" | "allege_tete" | "avancer_sans_pression" | "cadrer";
  extraInfo?: string;
}

export type ThemeId = "default" | "clair" | "sombre" | "zen" | "hyperfocus" | "aurore" | "ocean" | "sakura" | "nord" | "solaire";

export type AIProviderId = "openai" | "anthropic" | "mistral";

export interface AIProviderConfig {
  id: AIProviderId;
  enabled: boolean;
  apiKey: string;
}

export interface AISettings {
  providers: AIProviderConfig[];
}

export interface IntegrationRule {
  id: string;
  text: string;
  urgency: number;   // 1-5
  importance: number; // 1-5
}

export interface IntegrationContext {
  rules: IntegrationRule[];
  extraContext: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  category: "calendar" | "email" | "crm" | "messaging" | "storage" | "other";
  context: IntegrationContext;
}
