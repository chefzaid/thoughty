import type { Request } from 'express';
import { REFRESH_TOKEN_COOKIE, readRefreshTokenCookie } from './refresh-token-cookie';

const request = (cookie?: string) => ({ headers: { cookie } }) as unknown as Request;

describe('readRefreshTokenCookie', () => {
  it('finds the refresh token among other cookies', () => {
    expect(readRefreshTokenCookie(request(`a=1; ${REFRESH_TOKEN_COOKIE}=abc.def; b=2`))).toBe(
      'abc.def',
    );
  });

  it('decodes an encoded value', () => {
    expect(readRefreshTokenCookie(request(`${REFRESH_TOKEN_COOKIE}=a%3Db`))).toBe('a=b');
  });

  it.each([
    ['no Cookie header', undefined],
    ['other cookies only', 'a=1; b=2'],
    ['a cookie whose name merely contains it', `x${REFRESH_TOKEN_COOKIE}=abc`],
    ['an empty value', `${REFRESH_TOKEN_COOKIE}=`],
    ['a malformed encoding', `${REFRESH_TOKEN_COOKIE}=%E0%A4%A`],
  ])('returns undefined for %s', (_case, cookie) => {
    expect(readRefreshTokenCookie(request(cookie))).toBeUndefined();
  });
});
