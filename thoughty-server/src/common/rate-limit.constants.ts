export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;

export const RATE_LIMITS = {
  default: { limit: 100, ttl: FIFTEEN_MINUTES_MS },
  authAttempt: { limit: 5, ttl: FIFTEEN_MINUTES_MS },
  tokenRefresh: { limit: 30, ttl: FIFTEEN_MINUTES_MS },
  passwordRecovery: { limit: 3, ttl: ONE_HOUR_MS },
  accountSecurity: { limit: 5, ttl: ONE_HOUR_MS },
  socialWrite: { limit: 30, ttl: FIFTEEN_MINUTES_MS },
  // App imports send one request per batch of entries or files; a large library needs hundreds.
  importWrite: { limit: 300, ttl: FIFTEEN_MINUTES_MS },
  shareLinkWrite: { limit: 30, ttl: FIFTEEN_MINUTES_MS },
  // A private share link, opened without signing in: the entry or book, then each picture and video range.
  sharedLinkRead: { limit: 60, ttl: FIFTEEN_MINUTES_MS },
  sharedLinkFile: { limit: 600, ttl: FIFTEEN_MINUTES_MS },
} as const;

export const throttleDefault = (limit: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS]) => ({
  default: limit,
});
