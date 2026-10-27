import type { LocalizedText } from '../../services/api';

export type MemoirLanguage = keyof LocalizedText;

export function localize(text: LocalizedText, language: MemoirLanguage): string {
  return text[language] || text.en;
}

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

export function formatDeliveryDate(iso: string, timeZone: string, language: MemoirLanguage): string {
  return new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(new Date(iso));
}

export { browserTimeZone } from '../../utils/timeZone';

/** Today's date (`YYYY-MM-DD`) in the memoir's time zone, the day an answer is dated; the browser's day when the zone is unknown. */
export function todayIn(timeZone: string, now = new Date()): string {
  const format = (zone?: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return format(timeZone);
  } catch {
    return format();
  }
}
