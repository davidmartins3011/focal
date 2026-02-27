const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

export function formatScheduledDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  if (diff >= 2 && diff <= 6) return DAYS_SHORT[d.getDay()];
  if (diff >= -6 && diff < -1) return `${DAYS_SHORT[d.getDay()]} dernier`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatQuickDateHint(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export interface QuickDates {
  today: string;
  tomorrow: string;
  nextMonday: string;
  twoWeeksMonday: string;
  oneMonthMonday: string;
}

export function getQuickDates(): QuickDates {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);

  const twoWeeksMonday = new Date(nextMonday);
  twoWeeksMonday.setDate(twoWeeksMonday.getDate() + 7);

  const oneMonth = new Date(today);
  oneMonth.setMonth(oneMonth.getMonth() + 1);
  const oneMonthDay = oneMonth.getDay();
  const oneMonthDaysUntilMonday = oneMonthDay === 1 ? 0 : oneMonthDay === 0 ? 1 : 8 - oneMonthDay;
  oneMonth.setDate(oneMonth.getDate() + oneMonthDaysUntilMonday);

  return {
    today: toISODate(today),
    tomorrow: toISODate(tomorrow),
    nextMonday: toISODate(nextMonday),
    twoWeeksMonday: toISODate(twoWeeksMonday),
    oneMonthMonday: toISODate(oneMonth),
  };
}
