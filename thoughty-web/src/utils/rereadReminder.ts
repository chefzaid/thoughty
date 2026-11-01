import { formatEntryDate } from './entryDate';
import { timeCapsuleDateBounds } from './timeCapsule';

/** The quick choices of the reread dialog. */
export const REREAD_PRESETS = ['week', 'month', 'year'] as const;
export type RereadPreset = (typeof REREAD_PRESETS)[number];

/** The same day `months` later on the local clock, or that month's last day (31 January → 28 February). */
function monthsAfter(today: Date, months: number): Date {
  const later = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());
  if (later.getDate() !== today.getDate()) later.setDate(0);
  return later;
}

/** The local day (YYYY-MM-DD) a preset stands for: a week, a month or a year from `today`. */
export function rereadPresetDay(preset: RereadPreset, today: Date): string {
  if (preset === 'week') {
    return formatEntryDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));
  }
  return formatEntryDate(monthsAfter(today, preset === 'month' ? 1 : 12));
}

/** The days a reminder can be set for, as the API allows: tomorrow up to fifty years ahead, like a time capsule. */
export function rereadDateBounds(today: Date): { min: string; max: string } {
  return timeCapsuleDateBounds(today);
}

/** Whether `day` is one the API accepts for a reminder set on `today`. */
export function isValidRereadDay(day: string, today: Date): boolean {
  const { min, max } = rereadDateBounds(today);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= min && day <= max;
}
