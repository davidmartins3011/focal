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

export const BIMONTHLY_CYCLES: { start: number; label: string }[] = [
  { start: 1, label: "Jan, Mar, Mai, Jul, Sep, Nov" },
  { start: 2, label: "Fév, Avr, Jun, Août, Oct, Déc" },
];

export const BIANNUAL_CYCLES: { start: number; label: string }[] = [
  { start: 1, label: "Jan, Jul" },
  { start: 2, label: "Fév, Août" },
  { start: 3, label: "Mar, Sep" },
  { start: 4, label: "Avr, Oct" },
  { start: 5, label: "Mai, Nov" },
  { start: 6, label: "Jun, Déc" },
];

export const QUARTERLY_CYCLES: { start: number; label: string }[] = [
  { start: 1, label: "Jan, Avr, Jul, Oct" },
  { start: 2, label: "Fév, Mai, Août, Nov" },
  { start: 3, label: "Mar, Jun, Sep, Déc" },
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
