import { accessTokenHashOf, accessTokenHint, createAccessToken, hashAccessToken } from './access-token-secret';

describe('access token secrets', () => {
  it('makes distinct prefixed tokens of 256 random bits', () => {
    const first = createAccessToken();
    const second = createAccessToken();

    expect(first).toMatch(/^thy_[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(accessTokenHint(first)).toBe(first.slice(0, 8));
  });

  it('hashes only what can be a token', () => {
    const token = createAccessToken();

    expect(accessTokenHashOf(token)).toBe(hashAccessToken(token));
    expect(hashAccessToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(accessTokenHashOf(token.slice(4))).toBeNull();
    expect(accessTokenHashOf(`${token}x`)).toBeNull();
    expect(accessTokenHashOf('eyJhbGciOiJIUzI1NiJ9.e30.sig')).toBeNull();
  });
});
