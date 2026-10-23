import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXCERPT_LENGTH = 220;

export type RecycleBinCountKey = 'recycleBinEntries' | 'recycleBinDaysLeft' | 'recycleBinFiles';

/** "1 entry", "3 entries", and in French "0 entrée", which counts zero as singular. */
export function binCountPhrase(t: TranslationFunction, key: RecycleBinCountKey, count: number, language: Language): string {
  const form = new Intl.PluralRules(language).select(count) === 'one' ? 'one' : 'other';
  return t(`${key}_${form}`, { count: count.toLocaleString(language) });
}

/** Whole days left before the purge, rounded up so an entry never reads as gone early. */
export function daysUntilPurge(purgeAt: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - now.getTime()) / DAY_MS));
}

/** The start of the entry on one line, without Markdown heading and emphasis marks. */
export function binExcerpt(content: string): string {
  const text = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…` : text;
}

/** A journal date such as 2026-10-21, written out for the reader's language. */
export function formatBinDate(date: string, language: Language): string {
  const [year = 1970, month = 1, day = 1] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** When an entry was deleted, in the reader's time zone. */
export function formatDeletedOn(deletedAt: string, language: Language): string {
  return new Date(deletedAt).toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' });
}
