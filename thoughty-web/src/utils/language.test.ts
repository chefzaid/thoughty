import { describe, expect, it } from 'vitest';

import { resolveLanguage } from './language';

describe('resolveLanguage', () => {
  it('keeps French and falls back to English for anything else', () => {
    expect(resolveLanguage('fr')).toBe('fr');
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('de')).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });
});
