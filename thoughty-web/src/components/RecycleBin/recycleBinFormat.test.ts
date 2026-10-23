import { describe, expect, it } from 'vitest';

import { binCountPhrase, binExcerpt, daysUntilPurge, formatBinDate } from './recycleBinFormat';

const t = (key: string, params?: Record<string, string | number>) => `${key}:${params?.count ?? ''}`;

describe('recycle bin formatting', () => {
  it('picks the singular or plural form for each language', () => {
    expect(binCountPhrase(t, 'recycleBinEntries', 1, 'en')).toBe('recycleBinEntries_one:1');
    expect(binCountPhrase(t, 'recycleBinEntries', 0, 'en')).toBe('recycleBinEntries_other:0');
    expect(binCountPhrase(t, 'recycleBinEntries', 0, 'fr')).toBe('recycleBinEntries_one:0');
    expect(binCountPhrase(t, 'recycleBinDaysLeft', 1200, 'en')).toBe('recycleBinDaysLeft_other:1,200');
  });

  it('counts the days left before the purge, rounding up and never below zero', () => {
    const now = new Date('2026-10-23T12:00:00Z');

    expect(daysUntilPurge('2026-11-22T12:00:00Z', now)).toBe(30);
    expect(daysUntilPurge('2026-10-23T13:00:00Z', now)).toBe(1);
    expect(daysUntilPurge('2026-10-23T11:00:00Z', now)).toBe(0);
  });

  it('shows the start of an entry on one line without Markdown marks', () => {
    expect(binExcerpt('### The harbor\n\nA **slow** walk\n> before `work`')).toBe('The harbor A slow walk before work');

    const long = binExcerpt('word '.repeat(80));
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(221);
  });

  it('writes the journal date out for the reader without shifting the day', () => {
    expect(formatBinDate('2026-10-21', 'en')).toBe('October 21, 2026');
    expect(formatBinDate('2026-01-01T00:00:00.000Z', 'fr')).toBe('1 janvier 2026');
  });
});
