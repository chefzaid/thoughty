import type { WritingStreak } from '../../services/api';

/** Days without an entry, counted from the last one, before the card offers to pick up from it. */
export const RESUME_AFTER_DAYS = 3;
/** Days in a row before the card shows the streak; a single day is not a run yet. */
export const MIN_STREAK_DAYS = 2;

const DISMISSED_STORAGE_KEY = 'thoughty.writingStreakDismissedOn';

export type WritingStreakView =
  | { kind: 'streak'; days: number; writtenToday: boolean }
  | { kind: 'resume'; entry: NonNullable<WritingStreak['lastEntry']> }
  | null;

/**
 * What the card shows: the streak while it runs, an offer to pick up the last entry after a gap, and
 * nothing in between or before the first entry. A streak that ended is never counted or mentioned.
 */
export function writingStreakView(streak: WritingStreak | undefined): WritingStreakView {
  if (!streak?.lastEntry) return null;
  if (streak.currentStreak >= MIN_STREAK_DAYS) {
    return { kind: 'streak', days: streak.currentStreak, writtenToday: streak.writtenToday };
  }
  if ((streak.daysSinceLastEntry ?? 0) >= RESUME_AFTER_DAYS) {
    return { kind: 'resume', entry: streak.lastEntry };
  }
  return null;
}

/** Whether the card was hidden on this day (`YYYY-MM-DD`); false when storage is unavailable. */
export function isDismissedOn(day: string): boolean {
  try {
    return globalThis.localStorage?.getItem(DISMISSED_STORAGE_KEY) === day;
  } catch {
    return false;
  }
}

/** Hides the card for the rest of the day; it comes back tomorrow. */
export function dismissOn(day: string): void {
  try {
    globalThis.localStorage?.setItem(DISMISSED_STORAGE_KEY, day);
  } catch {
    // Remembering the dismissal is a convenience; the card still hides for this visit.
  }
}
