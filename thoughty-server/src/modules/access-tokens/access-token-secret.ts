import { createShareToken, hashShareToken } from '@/modules/share-links/share-link-token';

/** Every personal access token starts with this, so a leaked one is easy to recognize and search for. */
export const ACCESS_TOKEN_PREFIX = 'thy_';
/** The prefix and 43 URL-safe base64 characters: 256 random bits. */
const ACCESS_TOKEN_PATTERN = /^thy_[A-Za-z0-9_-]{43}$/;
/** Characters of the token kept to tell tokens apart: the prefix and four more. */
const HINT_LENGTH = ACCESS_TOKEN_PREFIX.length + 4;

/** A new token, from the operating system's secure random source. */
export function createAccessToken(): string {
  return `${ACCESS_TOKEN_PREFIX}${createShareToken()}`;
}

/** SHA-256 (hex) of a token, as the table keeps it. */
export const hashAccessToken = hashShareToken;

/** The first characters shown in the token list. */
export function accessTokenHint(token: string): string {
  return token.slice(0, HINT_LENGTH);
}

/** The hash to look a token up by, or null when it cannot be one this API made (so no query is run for it). */
export function accessTokenHashOf(token: string): string | null {
  return ACCESS_TOKEN_PATTERN.test(token) ? hashAccessToken(token) : null;
}
