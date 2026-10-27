import { measureDiaryGoal, mondayOf, type DayWriting } from './diary-goal-progress';

const days = (writing: Record<string, Partial<DayWriting>>) =>
  new Map(Object.entries(writing).map(([day, value]) => [day, { entries: 0, words: 0, ...value }]));

describe('mondayOf', () => {
  it.each([
    ['2026-10-26', '2026-10-26'],
    ['2026-10-27', '2026-10-26'],
    ['2026-11-01', '2026-10-26'],
    ['2026-01-01', '2025-12-29'],
  ])('starts the week of %s on Monday %s', (day, monday) => {
    expect(mondayOf(day)).toBe(monday);
  });
});

describe('measureDiaryGoal', () => {
  it('counts the words of today and the days in a row that met the goal', () => {
    const progress = measureDiaryGoal('words_per_day', 100, days({
      '2026-10-20': { words: 150 },
      '2026-10-21': { words: 99 },
      '2026-10-22': { words: 100 },
      '2026-10-23': { words: 300 },
      '2026-10-24': { words: 120 },
      '2026-10-25': { words: 101 },
      '2026-10-26': { words: 200 },
      '2026-10-27': { words: 40 },
    }), '2026-10-27');

    expect(progress).toEqual({
      period: 'day',
      periodStart: '2026-10-27',
      progress: 40,
      met: false,
      // Today is not met yet, which does not break the five days before it
      currentStreak: 5,
      longestStreak: 5,
      metPeriods: ['2026-10-20', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'],
    });
  });

  it('counts today in the streak once it meets the goal, and a missed day ends it', () => {
    const progress = measureDiaryGoal('words_per_day', 10, days({
      '2026-10-24': { words: 10 },
      '2026-10-26': { words: 10 },
      '2026-10-27': { words: 12 },
    }), '2026-10-27');

    expect(progress).toEqual(expect.objectContaining({ progress: 12, met: true, currentStreak: 2, longestStreak: 2 }));
  });

  it('sums the entries of each Monday-to-Sunday week, across months and years', () => {
    const progress = measureDiaryGoal('entries_per_week', 3, days({
      '2025-12-22': { entries: 3 },
      '2025-12-29': { entries: 1 },
      '2026-01-01': { entries: 1 },
      '2026-01-04': { entries: 1 },
      '2026-01-05': { entries: 2 },
      '2026-01-07': { entries: 1 },
      '2026-01-12': { entries: 2 },
    }), '2026-01-14');

    expect(progress).toEqual({
      period: 'week',
      periodStart: '2026-01-12',
      progress: 2,
      met: false,
      currentStreak: 3,
      longestStreak: 3,
      metPeriods: ['2025-12-22', '2025-12-29', '2026-01-05'],
    });
  });

  it('leaves out entries dated after today and starts from nothing without writing', () => {
    expect(measureDiaryGoal('entries_per_week', 1, days({ '2026-10-28': { entries: 4 } }), '2026-10-27')).toEqual({
      period: 'week',
      periodStart: '2026-10-26',
      progress: 0,
      met: false,
      currentStreak: 0,
      longestStreak: 0,
      metPeriods: [],
    });
  });

  it('keeps the longest streak apart from a broken current one', () => {
    const progress = measureDiaryGoal('entries_per_week', 1, days({
      '2026-09-07': { entries: 1 },
      '2026-09-14': { entries: 1 },
      '2026-09-21': { entries: 1 },
      '2026-10-19': { entries: 1 },
    }), '2026-10-27');

    expect(progress).toEqual(expect.objectContaining({ currentStreak: 1, longestStreak: 3 }));
  });
});
