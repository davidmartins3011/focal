import type { WeekDayId, ReminderFrequency, FrequencyOccurrence, StrategyFrequency } from "../types";

export const DAY_LABELS: { id: WeekDayId; short: string }[] = [
  { id: "lun", short: "L" },
  { id: "mar", short: "M" },
  { id: "mer", short: "Me" },
  { id: "jeu", short: "J" },
  { id: "ven", short: "V" },
  { id: "sam", short: "S" },
  { id: "dim", short: "D" },
];

export const FREQUENCY_OPTIONS: { id: ReminderFrequency; label: string }[] = [
  { id: "weekly", label: "Chaque semaine" },
  { id: "biweekly", label: "Toutes les 2 semaines" },
  { id: "monthly", label: "Tous les mois" },
  { id: "bimonthly", label: "Tous les 2 mois" },
  { id: "quarterly", label: "Tous les 3 mois" },
  { id: "biannual", label: "Tous les 6 mois" },
];

export function getOccurrenceOptions(freq: ReminderFrequency): { id: FrequencyOccurrence; label: string }[] {
  if (freq === "biweekly") {
    return [
      { id: "1st", label: "Sem. impaire" },
      { id: "2nd", label: "Sem. paire" },
    ];
  }
  return [
    { id: "1st", label: "1er" },
    { id: "2nd", label: "2e" },
    { id: "3rd", label: "3e" },
    { id: "4th", label: "4e" },
    { id: "last", label: "Dernier" },
  ];
}

const SHORT_MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Août", "Sep", "Oct", "Nov", "Déc"];

function buildCycleLabel(start: number, step: number): string {
  const pairs: string[] = [];
  for (let m = start - 1; m < 12; m += step) {
    const end = (m + step - 1) % 12;
    pairs.push(`${SHORT_MONTHS[m]}-${SHORT_MONTHS[end]}`);
  }
  return pairs.join(", ");
}

export const BIMONTHLY_CYCLES: { start: number; label: string }[] = [
  { start: 1, label: buildCycleLabel(1, 2) },
  { start: 2, label: buildCycleLabel(2, 2) },
];

export const QUARTERLY_CYCLES: { start: number; label: string }[] = [
  { start: 1, label: buildCycleLabel(1, 3) },
  { start: 2, label: buildCycleLabel(2, 3) },
  { start: 3, label: buildCycleLabel(3, 3) },
];

export const BIANNUAL_CYCLES: { start: number; label: string }[] = [
  { start: 1, label: buildCycleLabel(1, 6) },
  { start: 2, label: buildCycleLabel(2, 6) },
  { start: 3, label: buildCycleLabel(3, 6) },
  { start: 4, label: buildCycleLabel(4, 6) },
  { start: 5, label: buildCycleLabel(5, 6) },
  { start: 6, label: buildCycleLabel(6, 6) },
];

export const STRATEGY_FREQUENCY_OPTIONS: { id: StrategyFrequency; label: string }[] = [
  { id: "monthly", label: "Tous les mois" },
  { id: "bimonthly", label: "Tous les 2 mois" },
  { id: "quarterly", label: "Tous les 3 mois" },
  { id: "biannual", label: "Tous les 6 mois" },
];


/**
 * Returns which 0-indexed months are active for a given frequency + cycleStart.
 * cycleStart is 1-indexed (1=Jan).
 */
export function getActiveMonths(freq: StrategyFrequency, cycleStart: number): Set<number> {
  const step =
    freq === "monthly" ? 1 :
    freq === "bimonthly" ? 2 :
    freq === "quarterly" ? 3 : 6;

  const months = new Set<number>();
  const start = cycleStart - 1; // convert to 0-indexed
  for (let m = start; m < 12; m += step) {
    months.add(m);
  }
  return months;
}

export function strategyPeriodLabel(freq: StrategyFrequency): string {
  switch (freq) {
    case "monthly": return "du mois";
    case "bimonthly": return "de la période";
    case "quarterly": return "du trimestre";
    case "biannual": return "du semestre";
  }
}

export function strategyCtaLabel(freq: StrategyFrequency): string {
  switch (freq) {
    case "monthly": return "le mois écoulé";
    case "bimonthly": return "les 2 derniers mois";
    case "quarterly": return "le trimestre écoulé";
    case "biannual": return "le semestre écoulé";
  }
}

export function strategyNudgeThreshold(freq: StrategyFrequency): number {
  switch (freq) {
    case "monthly": return 25;
    case "bimonthly": return 50;
    case "quarterly": return 75;
    case "biannual": return 150;
  }
}
