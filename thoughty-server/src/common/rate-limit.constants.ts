export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * A signed-in request counts against its account at a route's limit, and every signed-in request from one
 * address against this many times that limit (`AccountThrottlerGuard`), so writers who share an address do
 * not use up each other's budget, yet many accounts at one address cannot multiply the limits without end.
 */
export const ADDRESS_CEILING_FACTOR = 3;

export const RATE_LIMITS = {
  default: { limit: 100, ttl: FIFTEEN_MINUTES_MS },
  authAttempt: { limit: 5, ttl: FIFTEEN_MINUTES_MS },
  // Refresh counts per account (a refresh token signed for it), or per address without one; the opt-in
  // email unsubscribes use it per address.
  tokenRefresh: { limit: 30, ttl: FIFTEEN_MINUTES_MS },
  // Every refresh from one address: the ceiling for writers who share it (one network, one NAT).
  tokenRefreshAddress: { limit: 300, ttl: FIFTEEN_MINUTES_MS },
  passwordRecovery: { limit: 3, ttl: ONE_HOUR_MS },
  accountSecurity: { limit: 5, ttl: ONE_HOUR_MS },
  socialWrite: { limit: 30, ttl: FIFTEEN_MINUTES_MS },
  // App imports send one request per batch of entries or files; a large library needs hundreds.
  importWrite: { limit: 300, ttl: FIFTEEN_MINUTES_MS },
  // Composer autosave: the web saves at most once every three seconds while the writer types.
  draftWrite: { limit: 300, ttl: FIFTEEN_MINUTES_MS },
  shareLinkWrite: { limit: 30, ttl: FIFTEEN_MINUTES_MS },
  // A private share link, opened without signing in: the entry or book, then each picture and video range.
  sharedLinkRead: { limit: 60, ttl: FIFTEEN_MINUTES_MS },
  sharedLinkFile: { limit: 600, ttl: FIFTEEN_MINUTES_MS },
  // The public Contact page form, per address: each message is an email to the deployment's inbox.
  contactMessage: { limit: 5, ttl: ONE_HOUR_MS },
  // PIN tries and changes; the per-account lockout in the database is what protects the PIN itself.
  contentPin: { limit: 20, ttl: FIFTEEN_MINUTES_MS },
} as const;

export const throttleDefault = (limit: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS]) => ({
  default: limit,
});
