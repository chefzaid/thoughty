import { createHmac, timingSafeEqual } from 'node:crypto';
import type { OptInEmailKind } from './opt-in-email-kind';

/**
 * How each email's tokens look: a prefix naming the email and the purpose its HMAC signs. "On this day"
 * tokens have no prefix, as they did before there was a second email, so links already sent keep working.
 */
const TOKEN_FORMATS: Record<OptInEmailKind, { prefix: string; purpose: string }> = {
  'on-this-day': { prefix: '', purpose: 'on-this-day-email:unsubscribe' },
  'monthly-recap': { prefix: 'recap', purpose: 'monthly-recap-email:unsubscribe' },
};
const KIND_BY_PREFIX = new Map(
  (Object.entries(TOKEN_FORMATS) as Array<[OptInEmailKind, { prefix: string }]>).map(([kind, { prefix }]) => [prefix, kind]),
);
const TOKEN_PATTERN = /^(?:([a-z]{1,16})\.)?(\d{1,10})\.([A-Za-z0-9_-]{43})$/;

export interface VerifiedUnsubscribeToken {
  kind: OptInEmailKind;
  userId: number;
}

function signature(kind: OptInEmailKind, userId: number, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${TOKEN_FORMATS[kind].purpose}:${userId}`).digest();
}

/**
 * The token in an opt-in email's unsubscribe link: the email's kind, the writer's ID and an HMAC-SHA-256
 * of both, so the link turns that one email off without signing in, and only for that writer.
 */
export function createEmailUnsubscribeToken(kind: OptInEmailKind, userId: number, secret: string): string {
  const { prefix } = TOKEN_FORMATS[kind];
  return `${prefix ? `${prefix}.` : ''}${userId}.${signature(kind, userId, secret).toString('base64url')}`;
}

/** The email and writer a token was made for, or null when it is malformed or was not signed with `secret`. */
export function verifyEmailUnsubscribeToken(token: string, secret: string): VerifiedUnsubscribeToken | null {
  const match = TOKEN_PATTERN.exec(token);
  const kind = match ? KIND_BY_PREFIX.get(match[1] ?? '') : undefined;
  if (!match || !kind) {
    return null;
  }
  const userId = Number(match[2]);
  const given = Buffer.from(match[3], 'base64url');
  const expected = signature(kind, userId, secret);
  return given.length === expected.length && timingSafeEqual(given, expected) ? { kind, userId } : null;
}
