import type { components } from '../../src/generated/openapi';
import type { MockAppState, MockEntry } from './mockApp.shared';
import { isMockSealed } from './mockApp.routes.time-capsules';
import { mockMentions } from './mockApp.routes.people';

type ApiErrorCode = components['schemas']['ApiErrorCode'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The newest day among the entries, or null without any. */
export function mockLastMentionedOn(entries: readonly Pick<MockEntry, 'date'>[]): string | null {
  return entries.map((entry) => entry.date).sort().at(-1) ?? null;
}

/** Why the API refuses a last contact: a day after today in Kiritimati (UTC+14); null when it takes it. */
export function mockContactRefusal(day: string, now = new Date()): { code: ApiErrorCode; message: string } | null {
  const latestDay = new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return day > latestDay ? { code: 'PERSON_CONTACT_IN_FUTURE', message: 'The last contact cannot be after today' } : null;
}

/**
 * Highlights' `reachOuts` on the writer's day, as the API builds them: the people with a reminder whose days
 * have passed since the later of the last contact and the newest entry mentioning them outside sealed capsules
 * (the recycle bin is kept apart already), or with neither; nothing on record first, then the longest out of
 * touch, then by name, up to 10.
 */
export function mockReachOuts(state: MockAppState, today: string): components['schemas']['PersonReachOutHighlightDto'][] {
  return state.people
    .flatMap((person) => {
      if (!person.reachOutDays) return [];
      const lastMentionedOn = mockLastMentionedOn(state.entries.filter((entry) => !isMockSealed(entry) && mockMentions(entry, person)));
      const lastContactOn = person.lastContactOn ?? null;
      const lastInTouch = [lastContactOn, lastMentionedOn].filter((day): day is string => day !== null).sort().at(-1) ?? null;
      const daysSince = lastInTouch === null ? null : Math.round((Date.parse(today) - Date.parse(lastInTouch)) / DAY_MS);
      if (daysSince !== null && daysSince < person.reachOutDays) return [];
      return [{ lastInTouch, due: { id: person.id, name: person.name, reachOutDays: person.reachOutDays, lastContactOn, lastMentionedOn, daysSince } }];
    })
    .sort((left, right) => (left.lastInTouch ?? '').localeCompare(right.lastInTouch ?? '')
      || left.due.name.toLowerCase().localeCompare(right.due.name.toLowerCase()) || left.due.id - right.due.id)
    .slice(0, 10)
    .map(({ due }) => due);
}
