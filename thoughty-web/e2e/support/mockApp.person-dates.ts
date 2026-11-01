import type { components } from '../../src/generated/openapi';
import { daysInMonth } from '../../src/utils/personDates';
import type { MockAppState } from './mockApp.shared';
import { toEntryResponse } from './mockApp.route-utils';
import { isMockSealed } from './mockApp.routes.time-capsules';
import { mockMentions } from './mockApp.routes.people';

type PersonDateInput = components['schemas']['PersonDateInputDto'];
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

/**
 * Highlights' `personDates` on the writer's day, as the API builds them: the people whose date is that day
 * (29 February on 28 February in a common year), by name, with the entries that mention them outside sealed
 * capsules (the recycle bin is kept apart already) and the newest of them.
 */
export function mockPersonDates(state: MockAppState, today: string): components['schemas']['PersonDateHighlightDto'][] {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  const onDay = (date: { month: number; day: number }) => (date.month === month && date.day === day)
    || (month === 2 && day === 28 && !isLeap(year) && date.month === 2 && date.day === 29);
  return state.people
    .filter((person) => person.date && onDay(person.date))
    .sort((left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()) || left.id - right.id)
    .map((person) => {
      const date = person.date!;
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
