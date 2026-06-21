import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  const getConfig = (values: Record<string, string | undefined>) => ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns default flags with inline overrides when no provider is configured', async () => {
    const service = new FeatureFlagsService(getConfig({ FEATURE_FLAGS: 'ai=false,newEditor=true' }));

    await expect(service.getFeatureFlags()).resolves.toMatchObject({
      ai: false,
      bookConverter: true,
      cloudSync: true,
      publicSharing: true,
      newEditor: true,
    });
  });

  it('merges remote provider flags over fallback flags', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ flags: { ai: false, betaFeed: 'enabled' } }),
    } as Response);
    const service = new FeatureFlagsService(getConfig({
      FEATURE_FLAG_PROVIDER_URL: 'https://flags.example/api',
      FEATURE_FLAG_PROVIDER_TOKEN: 'secret',
    }));

    const result = await service.getFeatureFlags();

    expect(result.ai).toBe(false);
    expect(result.betaFeed).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://flags.example/api', {
      headers: { Authorization: 'Bearer secret' },
    });
  });

  it('uses cached remote flags while the cache is fresh', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ flags: { ai: false } }),
    } as Response);
    const service = new FeatureFlagsService(getConfig({
      FEATURE_FLAG_PROVIDER_URL: 'https://flags.example/api',
      FEATURE_FLAG_CACHE_TTL_MS: '60000',
    }));

    await service.getFeatureFlags();
    await service.getFeatureFlags();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to defaults when the provider fails before any cache exists', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);
    const service = new FeatureFlagsService(getConfig({
      FEATURE_FLAG_PROVIDER_URL: 'https://flags.example/api',
    }));

    await expect(service.getFeatureFlags()).resolves.toMatchObject({
      ai: true,
      bookConverter: true,
    });
  });
});
