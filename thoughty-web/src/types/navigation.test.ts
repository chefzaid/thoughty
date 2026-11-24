import { describe, expect, it } from 'vitest';

import {
  getLocalizedPublicPage,
  getPublicPageAlternates,
  getPublicPathForView,
  getPublicViewForPath,
} from './navigation';

describe('localized public paths', () => {
  it('puts the French public pages under /fr and leaves the others at their only address', () => {
    expect(getPublicPathForView('about')).toBe('/about');
    expect(getPublicPathForView('about', 'fr')).toBe('/fr/about');
    expect(getPublicPathForView('intro', 'fr')).toBe('/fr/');
    expect(getPublicPathForView('memoirQuestions', 'fr')).toBe('/fr/memoir-questions');
    expect(getPublicPathForView('login', 'fr')).toBe('/login');
    expect(getPublicPathForView('resetPassword', 'fr')).toBe('/reset-password');
  });

  it('reads the page and the language from a path', () => {
    expect(getLocalizedPublicPage('/')).toEqual({ view: 'intro', language: 'en' });
    expect(getLocalizedPublicPage('/fr')).toEqual({ view: 'intro', language: 'fr' });
    expect(getLocalizedPublicPage('/fr/')).toEqual({ view: 'intro', language: 'fr' });
    expect(getLocalizedPublicPage('/fr/journal-templates/')).toEqual({ view: 'journalTemplates', language: 'fr' });
    expect(getLocalizedPublicPage('/feedback')).toEqual({ view: 'feedback', language: 'en' });
    for (const path of ['/login', '/fr/login', '/fr/fr/about', '/french', '/journal', '/fr/journal']) {
      expect(getLocalizedPublicPage(path)).toBeNull();
    }
  });

  it('opens the same public view at either address, and no view at a French address of another page', () => {
    expect(getPublicViewForPath('/fr/privacy')).toBe('privacy');
    expect(getPublicViewForPath('/privacy')).toBe('privacy');
    expect(getPublicViewForPath('/login')).toBe('login');
    expect(getPublicViewForPath('/fr/login')).toBeNull();
  });

  it('lists a page’s address in each language, the English one for any other', () => {
    expect(getPublicPageAlternates('terms')).toEqual([
      { hreflang: 'en', path: '/terms' },
      { hreflang: 'fr', path: '/fr/terms' },
      { hreflang: 'x-default', path: '/terms' },
    ]);
  });
});
