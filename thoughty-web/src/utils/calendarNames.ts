import type { Language } from './translations';

/** 2024-01-07 was a Sunday, so day 7 + n of that month is weekday n (0 = Sunday). */
export function weekdayName(weekday: number, language: Language, width: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(language, { weekday: width, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + weekday)));
}

/** `month` runs from 1 (January) to 12. */
export function monthName(month: number, language: Language, width: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(language, { month: width, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, month - 1, 1)));
}

/** An hour of the day (0 to 23) as the language names it on its own ("9 PM", "21 h"). */
export function hourName(hour: number, language: Language): string {
  return new Intl.DateTimeFormat(language, { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1, hour)));
}
