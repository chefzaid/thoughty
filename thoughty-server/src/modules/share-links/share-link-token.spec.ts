import { createHash } from 'node:crypto';
import { createShareToken, hashShareToken, shareTokenHashOf } from './share-link-token';

describe('share link tokens', () => {
  it('are 256 random bits, written URL-safe, and never the same twice', () => {
    const tokens = Array.from({ length: 50 }, createShareToken);

    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    }
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('are kept as their SHA-256, and looked up only when they could be one', () => {
    const token = createShareToken();

    expect(hashShareToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
    expect(shareTokenHashOf(token)).toBe(hashShareToken(token));
    for (const bad of ['', 'short', `${token}x`, `${token.slice(0, 42)}/`, `${token.slice(0, 42)}=`, '../../etc/passwd']) {
      expect(shareTokenHashOf(bad)).toBeNull();
    }
  });
});
