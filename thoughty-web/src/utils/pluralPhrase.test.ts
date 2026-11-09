import { describe, expect, it } from 'vitest';

import { pluralPhrase } from './pluralPhrase';
import { getTranslation, translations } from './translations';

describe('pluralPhrase', () => {
  it.each([
    ['en', 0, '0 entries mention Marie'],
    ['en', 1, '1 entry mentions Marie'],
    ['en', 2, '2 entries mention Marie'],
    ['en', 1200, '1,200 entries mention Marie'],
    ['fr', 0, '0 entrée mentionne Marie'],
    ['fr', 1, '1 entrée mentionne Marie'],
    ['fr', 2, '2 entrées mentionnent Marie'],
  ] as const)('picks the %s form for %i and fills the other parameters', (language, count, expected) => {
    const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

    expect(pluralPhrase(t, 'personDateMentions', count, language, { name: 'Marie' })).toBe(expected);
  });

  it('writes the count in the reader\'s number format', () => {
    const t = (key: string, params?: Record<string, string | number>) => `${key}:${params?.count}`;

    expect(pluralPhrase(t, 'personDateMentions', 1200, 'fr')).toBe(`personDateMentions_other:${(1200).toLocaleString('fr')}`);
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
