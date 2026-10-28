import { describe, expect, it } from 'vitest';
import { getTranslation, type Language } from '../../utils/translations';
import { formatEntryDay, shareLinkName, shareLinkViews } from './shareLinkText';

const tr = (language: Language) => (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

describe('share link text', () => {
  it('names a link by its note, or when it was made', () => {
    expect(shareLinkName({ label: 'For Mum', createdAt: '2026-10-28T09:00:00.000Z' }, tr('en'), 'en')).toBe('For Mum');
    expect(shareLinkName({ label: null, createdAt: '2026-10-28T09:00:00.000Z' }, tr('fr'), 'fr')).toMatch(/^Lien créé le 28 oct\. 2026/);
  });

  it('counts views against the limit, in both languages', () => {
    expect(shareLinkViews({ viewCount: 1, maxViews: null }, tr('en'), 'en')).toBe('1 view');
    expect(shareLinkViews({ viewCount: 0, maxViews: null }, tr('fr'), 'fr')).toBe('0 vue');
    expect(shareLinkViews({ viewCount: 2, maxViews: 5 }, tr('en'), 'en')).toBe('2 of 5 views');
    expect(shareLinkViews({ viewCount: 5, maxViews: 5 }, tr('fr'), 'fr')).toBe('Plus aucune vue');
  });

  it('writes an entry’s day in the reader’s language', () => {
    expect(formatEntryDay('2026-10-27', 'en')).toBe('October 27, 2026');
    expect(formatEntryDay('2026-10-27T00:00:00.000Z', 'fr')).toBe('27 octobre 2026');
  });
});
