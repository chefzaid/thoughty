import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerException, type ThrottlerStorage } from '@nestjs/throttler';
import type { Response } from 'express';

/**
 * Counts one request against `key` (an account, or an address) and refuses it once the key is over its
 * limit for the window, with `429 RATE_LIMITED` and `Retry-After` (seconds), as the global throttler does.
 */
export async function countAgainst(
  storage: ThrottlerStorage,
  context: ExecutionContext,
  key: string,
  { limit, ttl }: { limit: number; ttl: number },
  throttlerName: string,
): Promise<true> {
  const { isBlocked, timeToBlockExpire } = await storage.increment(key, ttl, limit, ttl, throttlerName);
  if (isBlocked) {
    context.switchToHttp().getResponse<Response>().header('Retry-After', String(timeToBlockExpire));
    throw new ThrottlerException();
  }
  return true;
}
