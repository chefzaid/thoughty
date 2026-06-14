export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;

export const RATE_LIMITS = {
  default: { limit: 100, ttl: FIFTEEN_MINUTES_MS },
  authAttempt: { limit: 5, ttl: FIFTEEN_MINUTES_MS },
  tokenRefresh: { limit: 30, ttl: FIFTEEN_MINUTES_MS },
  passwordRecovery: { limit: 3, ttl: ONE_HOUR_MS },
  accountSecurity: { limit: 5, ttl: ONE_HOUR_MS },
} as const;

export const throttleDefault = (limit: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS]) => ({
  default: limit,
});
