import { describe, expect, it } from 'vitest';

import { PASSWORD_SYMBOLS, isStrongPassword } from './passwordRule';
import { getTranslation } from './translations';

describe('the password rule', () => {
  it.each(['Writer123!', 'aB3"long', 'Zz9<>zzz'])('takes %s', (password) => {
    expect(isStrongPassword(password)).toBe(true);
  });

  it.each(['password123', 'PASSWORD123!', 'Password!!', 'Password123', 'Pass12!', 'Password123-_', ''])(
    'refuses %s, as the API does',
    (password) => {
      expect(isStrongPassword(password)).toBe(false);
    },
  );

  it('counts every symbol it lists, and only those', () => {
    for (const symbol of PASSWORD_SYMBOLS.split(' ')) {
      expect(isStrongPassword(`Writer12${symbol}`)).toBe(true);
    }
    expect(isStrongPassword('Writer12-')).toBe(false);
  });

  it.each(['en', 'fr'] as const)('says the same in %s when the API refuses a password as when the form does', (language) => {
    expect(getTranslation(language, 'apiError_AUTH_WEAK_PASSWORD')).toBe(
      getTranslation(language, 'passwordTooWeak', { symbols: PASSWORD_SYMBOLS }),
    );
  });
});
