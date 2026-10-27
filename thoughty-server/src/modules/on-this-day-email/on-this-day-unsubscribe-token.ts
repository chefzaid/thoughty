import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_PURPOSE = 'on-this-day-email:unsubscribe';
const TOKEN_PATTERN = /^(\d{1,10})\.([A-Za-z0-9_-]{43})$/;

function signature(userId: number, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${TOKEN_PURPOSE}:${userId}`).digest();
}

/**
 * The token in an "On this day" email's unsubscribe link: the writer's ID and an HMAC-SHA-256 of it,
 * so the link turns the email off without signing in, and only for that writer.
 */
export function createUnsubscribeToken(userId: number, secret: string): string {
  return `${userId}.${signature(userId, secret).toString('base64url')}`;
}

/** The writer a token was made for, or null when it is malformed or was not signed with `secret`. */
export function verifyUnsubscribeToken(token: string, secret: string): number | null {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) {
    return null;
  }
  const userId = Number(match[1]);
  const given = Buffer.from(match[2], 'base64url');
  const expected = signature(userId, secret);
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
