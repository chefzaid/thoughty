import { describe, expect, it } from 'vitest';

import { pluralPhrase } from './pluralPhrase';
import { getTranslation, translations } from './translations';

describe('pluralPhrase', () => {
  it.each([
    ['en', 0, '0 entries on Jan 5, 2024'],
    ['en', 1, '1 entry on Jan 5, 2024'],
    ['en', 2, '2 entries on Jan 5, 2024'],
    ['en', 1200, '1,200 entries on Jan 5, 2024'],
    ['fr', 0, '0 entrée le Jan 5, 2024'],
    ['fr', 1, '1 entrée le Jan 5, 2024'],
    ['fr', 2, '2 entrées le Jan 5, 2024'],
  ] as const)('picks the %s form for %i and fills the other parameters', (language, count, expected) => {
    const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

    expect(pluralPhrase(t, 'statsHeatmapDay', count, language, { date: 'Jan 5, 2024' })).toBe(expected);
  });

  it('writes the count in the reader\'s number format', () => {
    const t = (key: string, params?: Record<string, string | number>) => `${key}:${params?.count}`;

    expect(pluralPhrase(t, 'statsHeatmapDay', 1200, 'fr')).toBe(`statsHeatmapDay_other:${(1200).toLocaleString('fr')}`);
  });

  it.each(['en', 'fr'] as const)('finds both forms for every count in %s and no other plural scheme', (language) => {
    const keys = Object.keys(translations[language]);
    const oneKeys = keys.filter((key) => key.endsWith('_one'));
    const otherKeys = keys.filter((key) => key.endsWith('_other'));

    expect(oneKeys.length).toBeGreaterThan(0);
    expect(oneKeys.map((key) => key.replace(/_one$/, '')).sort()).toEqual(otherKeys.map((key) => key.replace(/_other$/, '')).sort());
    expect(keys.filter((key) => /[a-z]One$/.test(key))).toEqual([]);
  });
});
