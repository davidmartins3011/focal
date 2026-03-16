import type { Tag } from "../types";

export const TAG_COLORS: { id: Tag["color"]; label: string; css: string }[] = [
  { id: "crm", label: "Vert", css: "var(--green)" },
  { id: "data", label: "Bleu", css: "var(--blue)" },
  { id: "roadmap", label: "Accent", css: "var(--accent)" },
  { id: "saas", label: "Violet", css: "var(--purple)" },
  { id: "urgent", label: "Rouge", css: "var(--red)" },
];
