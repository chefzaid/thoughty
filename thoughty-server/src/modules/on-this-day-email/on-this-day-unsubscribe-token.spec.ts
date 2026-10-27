import { createUnsubscribeToken, verifyUnsubscribeToken } from './on-this-day-unsubscribe-token';

const SECRET = 'a'.repeat(48);

describe('unsubscribe tokens', () => {
  it('name the writer they were signed for', () => {
    const token = createUnsubscribeToken(42, SECRET);

    expect(token).toMatch(/^42\.[\w-]{43}$/);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(42);
    expect(createUnsubscribeToken(42, SECRET)).toBe(token);
  });

  it('refuse another key, another writer’s ID on the signature, and tampered or malformed tokens', () => {
    const token = createUnsubscribeToken(42, SECRET);
    const [, signature] = token.split('.');
    const flipped = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;

    expect(verifyUnsubscribeToken(token, 'b'.repeat(48))).toBeNull();
    expect(verifyUnsubscribeToken(`43.${signature}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`42.${flipped}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken('42', SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`42.${signature}x`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`-1.${signature}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken('', SECRET)).toBeNull();
  });
});
