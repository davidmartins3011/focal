export interface MicroStep {
  id: string;
  text: string;
  done: boolean;
  estimatedMinutes?: number;
}

export interface Task {
  id: string;
  name: string;
  done: boolean;
  tags: Tag[];
  microSteps?: MicroStep[];
  aiDecomposed?: boolean;
  estimatedMinutes?: number;
  priority?: "main" | "secondary";
  scheduledDate?: string;
  urgency?: number;
  importance?: number;
  description?: string;
  createdAt?: string;
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
  dots: ("done" | "pending")[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  steps?: { text: string }[];
}

export type ViewTab = "today" | "week" | "strategy";

export type SidebarPage = "main" | "calendar" | "suggestions" | "todos" | "integrations" | "settings" | "profile";

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
  /** Sources à scraper (LinkedIn, site web, etc.) — plusieurs possibles */
  profileResearchSources?: ProfileResearchSource[];
  adhdRecognition?: "diagnostique" | "fortement" | "un_peu" | "non";
  blockers?: ("commencer" | "oublier" | "agir" | "finir" | "trop_head" | "motivation")[];
  remindersPreference?: "clairs_frequents" | "peu_choisis" | "minimum" | "ca_depend";
  organizationHorizon?: "aujourdhui" | "semaine" | "projets_longs" | "mix";
  mainExpectation?: "me_dire_quoi_faire" | "prioriser" | "allege_tete" | "avancer_sans_pression" | "cadrer";
  extraInfo?: string;
  /** Résumé généré par l'IA à partir des profils publics (LinkedIn, site web…) */
  publicProfileSummary?: string;
}

export interface MemoryInsight {
  id: string;
  category: string;
  insight: string;
  sourceDate: string;
  createdAt: string;
  updatedAt: string;
}

export type ThemeId = "default" | "clair" | "sombre" | "zen" | "hyperfocus" | "aurore" | "ocean" | "sakura" | "nord" | "solaire";

export type AIProviderId = "openai" | "anthropic" | "mistral";

export type AIKeyStatus = "untested" | "validating" | "valid" | "invalid";

export interface AIProviderConfig {
  id: AIProviderId;
  enabled: boolean;
  apiKey: string;
  keyStatus?: AIKeyStatus;
}

export interface AISettings {
  providers: AIProviderConfig[];
  selectedModel?: string;
}

export type WeekDayId = "lun" | "mar" | "mer" | "jeu" | "ven" | "sam" | "dim";

export type ReminderFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "biannual";

export type FrequencyOccurrence = "1st" | "2nd" | "3rd" | "4th" | "last";

export interface NotificationReminder {
  id: string;
  label: string;
  description: string;
  time: string; // HH:mm
  enabled: boolean;
  days: WeekDayId[];
  icon: string;
  frequency?: ReminderFrequency;
  frequencyOccurrence?: FrequencyOccurrence;
  frequencyCycleStart?: number; // 1-12, mois de départ du cycle
}

export interface NotificationSettings {
  enabled: boolean;
  reminders: NotificationReminder[];
}

export interface NotificationHistoryEntry {
  id: string;
  reminderId: string;
  icon: string;
  label: string;
  description: string;
  scheduledTime: string; // HH:mm
  firedAt: string;       // ISO datetime
  missed: boolean;
  read: boolean;
}

export type StrategyFrequency = "monthly" | "bimonthly" | "quarterly" | "biannual";

export type PillarColor = "crm" | "data" | "roadmap" | "saas";

export interface StrategyPillar {
  id: string;
  name: string;
  tagColor: PillarColor;
  goal: string;
  progress: number;
  insight: string;
}

export interface StrategyReflection {
  id: string;
  prompt: string;
  answer: string;
}

export interface StrategyReview {
  id: string;
  month: number;   // 0-11
  year: number;
  createdAt: string; // ISO date
  pillars: StrategyPillar[];
  reflections: StrategyReflection[];
  top3: string[];
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
  oauthProvider?: string;
  accountEmail?: string;
}

export type SuggestionImpact = "high" | "medium" | "low";
export type SuggestionCategory = "planification" | "habitudes" | "focus" | "organisation" | "bien-être";

export interface Suggestion {
  id: string;
  icon: string;
  title: string;
  description: string;
  source: string;
  impact: SuggestionImpact;
  category: SuggestionCategory;
  confidence: number;
}

export interface OAuthCredentialsInfo {
  provider: string;
  clientId: string;
  configured: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees: string[];
  source: string;
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  snippet: string;
  date: string;
  isRead: boolean;
  labels: string[];
  source: string;
}
