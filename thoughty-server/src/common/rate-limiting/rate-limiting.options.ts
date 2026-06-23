import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { RATE_LIMITS } from '../rate-limit.constants';
import { createRedisThrottlerClientFromEnv, RedisThrottlerStorage } from './redis-throttler.storage';

export function createThrottlerModuleOptions(env: NodeJS.ProcessEnv = process.env): ThrottlerModuleOptions {
  const redisClient = createRedisThrottlerClientFromEnv(env);
  const throttlers = [
    {
      name: 'default',
      ...RATE_LIMITS.default,
    },
  ];

  if (!redisClient) {
    return throttlers;
  }

  return {
    storage: new RedisThrottlerStorage({ client: redisClient }),
    throttlers,
  };
}
