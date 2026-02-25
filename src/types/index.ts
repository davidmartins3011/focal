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

export type SidebarPage = "main" | "integrations";

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  category: "calendar" | "email" | "crm" | "messaging" | "storage" | "other";
}
