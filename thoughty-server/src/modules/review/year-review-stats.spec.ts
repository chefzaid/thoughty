import { countWords, isoWeekdayIndex, longestStreak, plainExcerpt, sampleEvenly } from './year-review-stats';

describe('year review stats', () => {
  it('counts words like the stats page', () => {
    expect(countWords('  A long   day\nby the sea. ')).toBe(6);
    expect(countWords('   ')).toBe(0);
  });

  it('finds the longest run of consecutive writing days, across month ends and repeats', () => {
    expect(longestStreak(['2025-01-30', '2025-01-31', '2025-02-01', '2025-02-01', '2025-02-03', '2025-02-04'])).toBe(3);
    expect(longestStreak(['2025-03-30', '2025-03-31', '2025-04-01', '2025-04-02'])).toBe(4);
    expect(longestStreak(['2025-05-01'])).toBe(1);
    expect(longestStreak([])).toBe(0);
  });

  it('numbers weekdays from Monday', () => {
    expect(isoWeekdayIndex('2025-10-20')).toBe(0);
    expect(isoWeekdayIndex('2025-10-19')).toBe(6);
  });

  it('turns Markdown into a short plain excerpt', () => {
    expect(plainExcerpt('# Sunday\n\n> A **long** walk to [the pier](https://x.y) ![photo](a.jpg)\n\n- bread\n1. milk\n```\ncode\n```\nWell\\-known', 200))
      .toBe('Sunday A long walk to the pier bread milk Well-known');
    expect(plainExcerpt('one two three four five six seven', 15)).toBe('one two three…');
    expect(plainExcerpt('Supercalifragilistic', 10)).toBe('Supercalif…');
  });

  it('samples evenly from first to last', () => {
    expect(sampleEvenly([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toEqual([1, 5, 9]);
    expect(sampleEvenly([1, 2], 5)).toEqual([1, 2]);
    expect(sampleEvenly([1, 2, 3], 1)).toEqual([1]);
  });
});
