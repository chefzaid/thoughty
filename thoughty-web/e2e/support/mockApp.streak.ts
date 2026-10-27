import type { components } from '../../src/generated/openapi';

interface StreakEntry {
  id: number;
  date: string;
  index: number;
  title?: string | null;
  content: string;
  diaryId?: number | null;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_IN_MS).toISOString().slice(0, 10);

/** The writing streak as the API measures it: days in a row up to the writer's day, which may still be empty. */
export function buildMockStreak(entries: StreakEntry[], diaryId: number | null, today: string): components['schemas']['WritingStreakResponseDto'] {
  const scoped = entries
    .filter((entry) => entry.date <= today && (diaryId === null || (entry.diaryId ?? 1) === diaryId))
    .sort((left, right) => right.date.localeCompare(left.date) || right.index - left.index);
  const days = new Set(scoped.map((entry) => entry.date));
  let currentStreak = 0;
  for (let cursor = days.has(today) ? today : addDays(today, -1); days.has(cursor); cursor = addDays(cursor, -1)) {
    currentStreak += 1;
  }
  const last = scoped[0];

  return {
    currentStreak,
    writtenToday: days.has(today),
    daysSinceLastEntry: last ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / DAY_IN_MS) : null,
    lastEntry: last
      ? { id: last.id, date: last.date, title: last.title ?? null, snippet: last.content.replace(/\s+/g, ' ').trim().slice(0, 140) }
      : null,
  };
}
