import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes: 256 bits, written as 43 URL-safe base64 characters. */
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** A new link token, from the operating system's secure random source. */
export function createShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** SHA-256 (hex) of a token, as the table keeps it. */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The hash to look a token up by, or null when it cannot be one this API made (so no query is run for it). */
export function shareTokenHashOf(token: string): string | null {
  return TOKEN_PATTERN.test(token) ? hashShareToken(token) : null;
}
