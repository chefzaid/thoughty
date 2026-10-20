import type { LocalizedText } from '../../services/api';

export type MemoirLanguage = keyof LocalizedText;

export function localize(text: LocalizedText, language: MemoirLanguage): string {
  return text[language] || text.en;
}

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

export function formatDeliveryDate(iso: string, timeZone: string, language: MemoirLanguage): string {
  return new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(new Date(iso));
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
