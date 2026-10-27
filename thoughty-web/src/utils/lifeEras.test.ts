import { describe, expect, it } from 'vitest';

import { eraContains, eraLabel, erasOnDate, formatEraDate, formatEraRange, joinEraNames } from './lifeEras';
import { getTranslation } from './translations';

const university = { name: 'University', emoji: '🎓', startDate: '2010-09-01', endDate: '2014-06-30' };
const paris = { name: 'Paris', emoji: null, startDate: '2014-06-30', endDate: null };

describe('lifeEras utils', () => {
  it('labels an era with its emoji when it has one', () => {
    expect(eraLabel(university)).toBe('🎓 University');
    expect(eraLabel(paris)).toBe('Paris');
  });

  it('covers an era from its first to its last day, ongoing eras without an end', () => {
    expect(eraContains(university, '2010-09-01')).toBe(true);
    expect(eraContains(university, '2014-06-30')).toBe(true);
    expect(eraContains(university, '2014-07-01')).toBe(false);
    expect(eraContains(paris, '2099-01-01')).toBe(true);
    expect(erasOnDate([university, paris], '2014-06-30')).toEqual([university, paris]);
    expect(erasOnDate([university, paris], '2009-01-01')).toEqual([]);
  });

  it('writes dates and ranges in the reader’s language', () => {
    const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
    const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

    expect(formatEraDate('2010-09-01', 'en')).toBe(new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(2010, 8, 1)));
    expect(formatEraRange(university, 'en', en)).toMatch(/^.*2010 – .*2014$/);
    expect(formatEraRange(paris, 'en', en)).toMatch(/^Since .*2014$/);
    expect(formatEraRange(paris, 'fr', fr)).toMatch(/^Depuis le 30 .*2014$/);
    expect(joinEraNames([university, paris], 'en')).toBe('🎓 University and Paris');
    expect(joinEraNames([university, paris], 'fr')).toBe('🎓 University et Paris');
  });
});
