import { createEmailUnsubscribeToken, verifyEmailUnsubscribeToken } from '@/modules/opt-in-email/email-unsubscribe-token';

/** The token in an "On this day" email's unsubscribe link: the writer's ID and an HMAC-SHA-256 of it. */
export function createUnsubscribeToken(userId: number, secret: string): string {
  return createEmailUnsubscribeToken('on-this-day', userId, secret);
}

/** The writer an "On this day" token was made for, or null for anything else, other emails' tokens included. */
export function verifyUnsubscribeToken(token: string, secret: string): number | null {
  const verified = verifyEmailUnsubscribeToken(token, secret);
  return verified?.kind === 'on-this-day' ? verified.userId : null;
}
