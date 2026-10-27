import { afterEach, describe, expect, it, vi } from 'vitest';

import { dismissOn, isDismissedOn, writingStreakView } from './writingStreakState';

const lastEntry = { id: 1, date: '2026-10-20', title: null, snippet: 'Notes' };

describe('writingStreakView', () => {
  it('shows a streak of two days or more, even before today is written', () => {
    expect(writingStreakView({ currentStreak: 2, writtenToday: false, daysSinceLastEntry: 1, lastEntry }))
      .toEqual({ kind: 'streak', days: 2, writtenToday: false });
  });

  it('offers to pick up after three days or more without an entry', () => {
    expect(writingStreakView({ currentStreak: 0, writtenToday: false, daysSinceLastEntry: 3, lastEntry }))
      .toEqual({ kind: 'resume', entry: lastEntry });
  });

  it('shows nothing for a first day, a short break, or an empty journal', () => {
    expect(writingStreakView({ currentStreak: 1, writtenToday: true, daysSinceLastEntry: 0, lastEntry })).toBeNull();
    expect(writingStreakView({ currentStreak: 0, writtenToday: false, daysSinceLastEntry: 2, lastEntry })).toBeNull();
    expect(writingStreakView({ currentStreak: 0, writtenToday: false, daysSinceLastEntry: null, lastEntry: null })).toBeNull();
    expect(writingStreakView(undefined)).toBeNull();
  });
});

describe('dismissal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('remembers the day the card was hidden', () => {
    dismissOn('2026-10-27');

    expect(isDismissedOn('2026-10-27')).toBe(true);
    expect(isDismissedOn('2026-10-28')).toBe(false);
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(() => dismissOn('2026-10-27')).not.toThrow();
    expect(isDismissedOn('2026-10-27')).toBe(false);
  });
});
