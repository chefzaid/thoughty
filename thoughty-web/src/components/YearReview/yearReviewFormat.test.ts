import { describe, expect, it } from 'vitest';

import type { YearReview } from '../../services/api';
import { appImportTranslations } from '../../utils/translations.appImport';
import { reviewTranslations } from '../../utils/translations.review';
import { buildShareText, busiestIndex, countPhrase, defaultReviewYear, formatChange } from './yearReviewFormat';

const translator = (language: 'en' | 'fr') => (key: string, params?: Record<string, string | number>) => {
  const template = (reviewTranslations[language] as Record<string, string>)[key]
    ?? (appImportTranslations[language] as Record<string, string>)[key]
    ?? key;
  return template.replaceAll(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''));
};

const review = {
  year: 2025,
  totals: { entries: 214, words: 61240, writingDays: 182, longestStreak: 38, favorites: 9, attachments: 40, averageWords: 286 },
  topTags: [{ tag: 'travel', count: 40 }, { tag: 'family', count: 30 }, { tag: 'work', count: 20 }, { tag: 'garden', count: 5 }],
} as YearReview;

describe('yearReviewFormat', () => {
  it('chooses singular and plural forms by language', () => {
    expect(countPhrase(translator('en'), 'reviewEntries', 1, 'en')).toBe('1 entry');
    expect(countPhrase(translator('en'), 'reviewEntries', 1200, 'en')).toBe('1,200 entries');
    expect(countPhrase(translator('fr'), 'reviewDays', 0, 'fr')).toBe('0 jour');
    expect(countPhrase(translator('fr'), 'reviewWords', 2, 'fr')).toBe('2 mots');
  });

  it('shows the change from the previous year with a sign', () => {
    expect(formatChange(214, 202, 'en')).toBe('+12');
    expect(formatChange(10, 1510, 'en')).toBe('−1,500');
    expect(formatChange(5, 5, 'en')).toBe('±0');
  });

  it('looks back on last year during January', () => {
    expect(defaultReviewYear(new Date(2026, 0, 15))).toBe(2025);
    expect(defaultReviewYear(new Date(2026, 1, 1))).toBe(2026);
  });

  it('finds the busiest slot', () => {
    expect(busiestIndex([0, 3, 7, 7])).toBe(2);
    expect(busiestIndex([0, 0])).toBe(-1);
  });

  it('writes the share text from numbers, adding themes only on request', () => {
    expect(buildShareText(review, 'en', translator('en'), false)).toBe(
      'My 2025 in Thoughty: 214 entries and 61,240 words over 182 days, with a longest streak of 38 days.',
    );
    expect(buildShareText(review, 'en', translator('en'), true)).toContain('Most on my mind: travel, family, work.');
    expect(buildShareText({ ...review, topTags: [] }, 'en', translator('en'), true)).not.toContain('Most on my mind');
    expect(buildShareText(review, 'fr', translator('fr'), false)).toContain('Mon année 2025 sur Thoughty : 214 entrées');
  });
});
