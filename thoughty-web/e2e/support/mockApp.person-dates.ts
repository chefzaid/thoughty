import type { components } from '../../src/generated/openapi';
import { daysInMonth } from '../../src/utils/personDates';
import type { MockAppState } from './mockApp.shared';
import { toEntryResponse } from './mockApp.route-utils';
import { isMockSealed } from './mockApp.routes.time-capsules';
import { mockMentions } from './mockApp.routes.people';

type PersonDateInput = components['schemas']['PersonDateInputDto'];
type PersonDate = components['schemas']['PersonDateDto'];
type ApiErrorCode = components['schemas']['ApiErrorCode'];

const isLeap = (year: number) => daysInMonth(2, year) === 29;
const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Why the API refuses a date on a person, as `assertValidPersonDate` checks it, or null when it takes it:
 * a day the month never has (29 February in a known common year too), a year before 1000, or a dated day
 * after today in Kiritimati (UTC+14).
 */
export function mockPersonDateRefusal(date: PersonDateInput, now = new Date()): { code: ApiErrorCode; message: string } | null {
  const year = date.year ?? null;
  if (date.month < 1 || date.month > 12 || date.day < 1 || date.day > daysInMonth(date.month, year)) {
    return { code: 'PERSON_DATE_INVALID', message: 'This day does not exist in that month' };
  }
  if (year === null) return null;
  if (year < 1000) return { code: 'PERSON_DATE_YEAR_INVALID', message: 'Write the year with four digits, from 1000' };
  const latestDay = new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `${year}-${pad(date.month)}-${pad(date.day)}` > latestDay
    ? { code: 'PERSON_DATE_IN_FUTURE', message: 'A date with its year cannot be in the future' }
    : null;
}

/** The most dates, and the longest label, the API saves on a person. */
const MOCK_PERSON_DATES_MAX = 10;
const MOCK_PERSON_DATE_LABEL_MAX_LENGTH = 40;

/**
 * Why the API refuses the dates sent for a person, or null when it takes them: more than ten or a label over 40
 * characters (`VALIDATION_FAILED`), a second birthday, then the first date that cannot be.
 */
export function mockPersonDatesRefusal(dates: readonly PersonDateInput[]): { code: ApiErrorCode; message: string } | null {
  if (dates.length > MOCK_PERSON_DATES_MAX || dates.some((date) => (date.label ?? '').trim().length > MOCK_PERSON_DATE_LABEL_MAX_LENGTH)) {
    return { code: 'VALIDATION_FAILED', message: 'dates must hold at most 10 dates with labels of at most 40 characters' };
  }
  if (dates.filter((date) => date.kind === 'birthday').length > 1) {
    return { code: 'PERSON_DATE_BIRTHDAY_TWICE', message: 'A person has one birthday' };
  }
  return dates.map((date) => mockPersonDateRefusal(date)).find(Boolean) ?? null;
}

/** A person's dates in the API's order: through the year, a birthday before an anniversary on the same day. */
const byDay = (left: PersonDate, right: PersonDate) => left.month - right.month || left.day - right.day
  || Number(left.kind !== 'birthday') - Number(right.kind !== 'birthday');

/** The dates as the API saves them: each label trimmed (blank for none), in their order. */
export function mockSavedPersonDates(dates: readonly PersonDateInput[]): PersonDate[] {
  return dates
    .map((date) => ({ kind: date.kind, label: date.label?.trim() || null, month: date.month, day: date.day, year: date.year ?? null }))
    .sort(byDay);
}

/** The person kept's dates after a merge: theirs, then the duplicate's but a second birthday and the dates they share. */
export function mockMergedPersonDates(kept: readonly PersonDate[], duplicate: readonly PersonDate[]): PersonDate[] {
  const label = (date: PersonDate) => (date.label ?? '').toLowerCase();
  const moved = duplicate.filter((date) => !kept.some((own) => own.kind === date.kind
    && (date.kind === 'birthday' || (own.month === date.month && own.day === date.day && label(own) === label(date)))));
  return [...kept, ...moved].sort(byDay);
}

/**
 * Highlights' `personDates` on the writer's day, as the API builds them: the people whose date is that day
 * (29 February on 28 February in a common year), by name and once for each such date, with the entries that mention them outside sealed
 * capsules (the recycle bin is kept apart already) and the newest of them.
 */
export function mockPersonDates(state: MockAppState, today: string): components['schemas']['PersonDateHighlightDto'][] {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  const onDay = (date: { month: number; day: number }) => (date.month === month && date.day === day)
    || (month === 2 && day === 28 && !isLeap(year) && date.month === 2 && date.day === 29);
  return [...state.people]
    .sort((left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()) || left.id - right.id)
    .flatMap((person) => (person.dates ?? []).filter(onDay).map((date) => ({ person, date })))
    .map(({ person, date }) => {
      const entries = state.entries
        .filter((entry) => !isMockSealed(entry) && mockMentions(entry, person))
        .sort((left, right) => right.date.localeCompare(left.date) || right.index - left.index);
      return {
        id: person.id,
        name: person.name,
        date,
        years: date.year === null ? null : year - date.year,
        entryCount: entries.length,
        latestEntry: entries[0] ? toEntryResponse(entries[0], state) : null,
      };
    });
}
