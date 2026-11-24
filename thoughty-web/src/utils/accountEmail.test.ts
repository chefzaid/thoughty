import { describe, expect, it } from 'vitest';
import { ownEmail } from './accountEmail';

describe('ownEmail', () => {
  it('gives the writer’s address, and nothing for a placeholder or no user', () => {
    expect(ownEmail({ email: 'ada@example.com', emailMissing: false })).toBe('ada@example.com');
    expect(ownEmail({ email: 'ada@example.com' })).toBe('ada@example.com');
    expect(ownEmail({ email: 'user-1@invalid', emailMissing: true })).toBe('');
    expect(ownEmail({})).toBe('');
    expect(ownEmail(null)).toBe('');
  });
});
