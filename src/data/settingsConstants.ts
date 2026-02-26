import type { WeekDayId, ReminderFrequency, FrequencyOccurrence } from "../types";

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
