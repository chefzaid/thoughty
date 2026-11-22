import type { components } from '../generated/openapi';
import type { Language } from './translations';

export type PersonDate = components['schemas']['PersonDateDto'];
export type PersonDateKind = components['schemas']['PersonDateKind'];
export type PersonDateInput = components['schemas']['PersonDateInputDto'];

/** What a date on a person can mark, in the order the editor offers them. */
export const PERSON_DATE_KINDS: readonly PersonDateKind[] = ['birthday', 'anniversary'];
/** The most dates the API saves on a person; merging two people may leave more. */
export const PERSON_DATES_MAX = 10;
/** The longest label (what a date marks) the API saves. */
export const PERSON_DATE_LABEL_MAX_LENGTH = 40;

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

/** Whether the dates to send are the person's dates, in the same order. */
export function samePersonDates(left: readonly PersonDateInput[], right: readonly PersonDate[]): boolean {
  return left.length === right.length && left.every((date, index) => {
    const other = right[index];
    return other !== undefined && date.kind === other.kind && (date.label ?? null) === other.label && date.month === other.month
      && date.day === other.day && (date.year ?? null) === other.year;
  });
}

/** One date as the writer fills it in: every value as typed, empty while not chosen, and a key that stays with it. */
export interface PersonDateDraft {
  readonly key: number;
  readonly kind: PersonDateKind;
  readonly label: string;
  readonly month: string;
  readonly day: string;
  readonly year: string;
}

let lastDraftKey = 0;

/** A date to fill in: the birthday while the person has none among `drafts`, an anniversary otherwise. */
export function newPersonDateDraft(drafts: readonly PersonDateDraft[]): PersonDateDraft {
  lastDraftKey += 1;
  const kind = drafts.some((draft) => draft.kind === 'birthday') ? 'anniversary' : 'birthday';
  return { key: lastDraftKey, kind, label: '', month: '', day: '', year: '' };
}

export function personDateDrafts(dates: readonly PersonDate[]): PersonDateDraft[] {
  return dates.map((date) => {
    lastDraftKey += 1;
    return {
      key: lastDraftKey,
      kind: date.kind,
      label: date.label ?? '',
      month: String(date.month),
      day: String(date.day),
      year: date.year === null ? '' : String(date.year),
    };
  });
}

type PersonDateDraftError =
  | 'personDateIncomplete'
  | 'apiError_PERSON_DATE_YEAR_INVALID'
  | 'apiError_PERSON_DATE_INVALID'
  | 'apiError_PERSON_DATE_IN_FUTURE';

const pad = (value: number) => String(value).padStart(2, '0');

/** Why one draft cannot be sent on the writer's day `today` (`YYYY-MM-DD`), or null when it can. */
function draftError(draft: PersonDateDraft, today: string): PersonDateDraftError | null {
  if (!draft.month || !draft.day) return 'personDateIncomplete';
  const year = draft.year.trim();
  if (!year) return null;
  if (!/^\d{4}$/.test(year) || Number(year) < 1000) return 'apiError_PERSON_DATE_YEAR_INVALID';
  if (Number(draft.day) > daysInMonth(Number(draft.month), Number(year))) return 'apiError_PERSON_DATE_INVALID';
  return `${year}-${pad(Number(draft.month))}-${pad(Number(draft.day))}` > today ? 'apiError_PERSON_DATE_IN_FUTURE' : null;
}

/**
 * The dates to send for the drafts, or the translation key of why the first draft that cannot be sent on the writer's
 * day `today` cannot, and that draft's place: the month and day are missing, the year is not four digits from 1000,
 * the day is 29 February in a year without one, or the dated day is after today. The API checks them all again
 * (`PERSON_DATE_*`), on the latest day on Earth.
 */
export function readPersonDateDrafts(drafts: readonly PersonDateDraft[], today: string):
  { dates: PersonDateInput[] } | { error: PersonDateDraftError; index: number } {
  for (const [index, draft] of drafts.entries()) {
    const error = draftError(draft, today);
    if (error) return { error, index };
  }
  return {
    dates: drafts.map((draft) => {
      const year = draft.year.trim();
      return {
        kind: draft.kind,
        label: draft.label.trim() || null,
        month: Number(draft.month),
        day: Number(draft.day),
        year: year ? Number(year) : null,
      };
    }),
  };
}
