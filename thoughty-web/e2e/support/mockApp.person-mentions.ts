import type { components } from '../../src/generated/openapi';
import { isMockWithheld } from './mockApp.content-lock';
import { isMockSealed } from './mockApp.routes.time-capsules';
import type { MockAppState, MockEntry } from './mockApp.shared';

type MentionsOverTime = components['schemas']['MentionsOverTimeResponseDto'];
type MentionPeriod = components['schemas']['MentionPeriodDto'];

const MOCK_MENTION_MONTHS = 12;

function toPeriod(period: string, entries: readonly MockEntry[]): MentionPeriod {
  const moods = entries.flatMap((entry) => (typeof entry.mood === 'number' ? [entry.mood] : []));
  const averageMood = moods.length ? Math.round((moods.reduce((sum, mood) => sum + mood, 0) / moods.length) * 10) / 10 : null;
  return { period, entries: entries.length, moodEntries: moods.length, averageMood };
}

/**
 * `GET /api/people/{id}/mentions-over-time` and `GET /api/people/mentions-over-time` as the API answers them: the entries
 * up to `today`, outside the recycle bin, neither sealed nor locked, that `mentions` matches, counted once each, by month over
 * the last twelve months and by year from the first mention, with their average mood.
 */
export function mockMentionsOverTime(state: MockAppState, mentions: (entry: MockEntry) => boolean, today: string): MentionsOverTime {
  const counted = state.entries.filter((entry) => entry.date <= today && !isMockSealed(entry) && !isMockWithheld(entry, state) && mentions(entry));
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const months = Array.from({ length: MOCK_MENTION_MONTHS }, (_, index) => {
    const offset = year * 12 + month - 1 - (MOCK_MENTION_MONTHS - 1 - index);
    const period = `${Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}`;
    return toPeriod(period, counted.filter((entry) => entry.date.startsWith(`${period}-`)));
  });
  const first = counted.length ? Math.min(...counted.map((entry) => Number(entry.date.slice(0, 4)))) : year + 1;
  const years = Array.from({ length: Math.max(0, year - first + 1) }, (_, index) => {
    const period = String(first + index);
    return toPeriod(period, counted.filter((entry) => entry.date.startsWith(`${period}-`)));
  });
  return { entries: counted.length, months, years };
}
