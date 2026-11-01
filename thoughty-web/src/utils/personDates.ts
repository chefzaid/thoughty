import type { components } from '../generated/openapi';
import type { Language } from './translations';

export type PersonDate = components['schemas']['PersonDateDto'];
export type PersonDateKind = components['schemas']['PersonDateKind'];
export type PersonDateInput = components['schemas']['PersonDateInputDto'];

/** What a date on a person can mark, in the order the editor offers them. */
export const PERSON_DATE_KINDS: readonly PersonDateKind[] = ['birthday', 'anniversary'];

/** The days `month` (1 to 12) can have: February 29 unless the year is known and had no 29th, as the API checks. */
export function daysInMonth(month: number, year: number | null): number {
  if (month === 2) {
    return year === null || (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** The date as the reader's language writes it: "14 March 1992", or "14 March" without the year. */
export function formatPersonDate(date: Pick<PersonDate, 'month' | 'day' | 'year'>, language: Language): string {
  // 2000 had a 29 February, so a date without its year always exists in it
  const when = new Date(Date.UTC(date.year ?? 2000, date.month - 1, date.day));
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    ...(date.year === null ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(when);
}

/** Whether two dates (or their absence) are the same. */
export function samePersonDate(left: PersonDateInput | null, right: PersonDateInput | null): boolean {
  if (left === null || right === null) return left === right;
  return left.kind === right.kind && left.month === right.month && left.day === right.day && (left.year ?? null) === (right.year ?? null);
}

/** The date fields as the writer fills them in: every value as typed, empty while not chosen. */
export interface PersonDateDraft {
  readonly kind: PersonDateKind | '';
  readonly month: string;
  readonly day: string;
  readonly year: string;
}

export function personDateDraft(date: PersonDate | null): PersonDateDraft {
  return date
    ? { kind: date.kind, month: String(date.month), day: String(date.day), year: date.year === null ? '' : String(date.year) }
    : { kind: '', month: '', day: '', year: '' };
}

/**
 * The date to send for the draft (null when no kind is chosen), or the translation key of what is missing:
 * the month and day, or a year written with four digits. The API checks the rest (`PERSON_DATE_*`).
 */
export function readPersonDateDraft(draft: PersonDateDraft): { date: PersonDateInput | null } | { error: 'personDateIncomplete' | 'apiError_PERSON_DATE_YEAR_INVALID' } {
  if (draft.kind === '') return { date: null };
  if (!draft.month || !draft.day) return { error: 'personDateIncomplete' };
  const year = draft.year.trim();
  if (year && !/^\d{4}$/.test(year)) return { error: 'apiError_PERSON_DATE_YEAR_INVALID' };
  return { date: { kind: draft.kind, month: Number(draft.month), day: Number(draft.day), year: year ? Number(year) : null } };
}
