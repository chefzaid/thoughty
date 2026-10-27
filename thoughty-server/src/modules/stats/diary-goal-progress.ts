import type { DiaryGoalType } from '@/database/entities';

/** What a diary wrote on one day: its entries and their words. */
export interface DayWriting {
  entries: number;
  words: number;
}

export interface DiaryGoalProgress {
  /** `day` for a words-per-day goal, `week` (Monday to Sunday) for an entries-per-week goal. */
  period: 'day' | 'week';
  /** First day of the current period: today, or this week's Monday. */
  periodStart: string;
  /** Words written today, or entries written this week. */
  progress: number;
  met: boolean;
  /** Periods in a row that met the goal, up to the current one; a current period not met yet does not break it. */
  currentStreak: number;
  longestStreak: number;
  /** First day of every period that met the goal, oldest first. */
  metPeriods: string[];
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  return toDay(new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_IN_MS));
}

/** The Monday that starts the week of a `YYYY-MM-DD` day. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** Sums the days into their goal periods, keyed by the period's first day. */
function periodTotals(type: DiaryGoalType, days: Map<string, DayWriting>, today: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const [day, writing] of days) {
    if (day > today) continue;
    const key = type === 'words_per_day' ? day : mondayOf(day);
    const value = type === 'words_per_day' ? writing.words : writing.entries;
    totals.set(key, (totals.get(key) ?? 0) + value);
  }
  return totals;
}

function longestRun(metPeriods: string[], step: number): number {
  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const period of metPeriods) {
    run = previous !== undefined && addDays(previous, step) === period ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = period;
  }
  return longest;
}

/**
 * Measures a goal against what a diary wrote up to `today`, the writer's own day. Entries dated
 * after it count towards later periods only, so they are left out.
 */
export function measureDiaryGoal(
  type: DiaryGoalType,
  target: number,
  days: Map<string, DayWriting>,
  today: string,
): DiaryGoalProgress {
  const step = type === 'words_per_day' ? 1 : 7;
  const periodStart = type === 'words_per_day' ? today : mondayOf(today);
  const totals = periodTotals(type, days, today);
  const metPeriods = [...totals.entries()]
    .filter(([, total]) => total >= target)
    .map(([period]) => period)
    .sort((left, right) => left.localeCompare(right));
  const met = new Set(metPeriods);
  const progress = totals.get(periodStart) ?? 0;

  let currentStreak = 0;
  let cursor = met.has(periodStart) ? periodStart : addDays(periodStart, -step);
  while (met.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -step);
  }

  return {
    period: type === 'words_per_day' ? 'day' : 'week',
    periodStart,
    progress,
    met: progress >= target,
    currentStreak,
    longestStreak: longestRun(metPeriods, step),
    metPeriods,
  };
}
