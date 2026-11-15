import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from './feature-flags.service';
import { featureFlagsWith } from './feature-flags.test-helpers';

describe('FeatureFlagsService', () => {
  const getConfig = (values: Record<string, string | undefined>) => ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

  const providerAnswer = (flags: Record<string, unknown>) => ({
    ok: true,
    json: async () => ({ flags }),
  }) as Response;

  afterEach(() => {
    jest.useRealTimers();
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

  it('merges remote provider flags over fallback flags, with a request timeout', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(providerAnswer({ ai: false, betaFeed: 'enabled' }));
    const service = new FeatureFlagsService(getConfig({
      FEATURE_FLAG_PROVIDER_URL: 'https://flags.example/api',
      FEATURE_FLAG_PROVIDER_TOKEN: 'secret',
    }));

    const result = await service.getFeatureFlags();

    expect(result.ai).toBe(false);
    expect(result.betaFeed).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://flags.example/api', {
      headers: { Authorization: 'Bearer secret' },
      signal: expect.any(AbortSignal),
    });
  });

  it('reads a flat flag map and ignores values that are not on or off', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ cloudSync: 'off', bookConverter: 'maybe' }),
    } as Response);
    const service = new FeatureFlagsService(getConfig({ FEATURE_FLAG_PROVIDER_URL: 'https://flags.example/api' }));

    await expect(service.getFeatureFlags()).resolves.toMatchObject({ cloudSync: false, bookConverter: true });
  });

  it('uses cached remote flags while the cache is fresh, and asks again once it expires', async () => {
    jest.useFakeTimers({ now: 0 });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(providerAnswer({ ai: false }));
    const service = new FeatureFlagsService(getConfig({
      FEATURE_FLAG_PROVIDER_URL: 'https://flags.example/api',
      FEATURE_FLAG_CACHE_TTL_MS: '60000',
    }));

    await service.getFeatureFlags();
    await service.getFeatureFlags();
    expect(fetch).toHaveBeenCalledTimes(1);

    jest.setSystemTime(60_001);
    await service.getFeatureFlags();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('asks the provider once for requests that arrive together', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(providerAnswer({ publicSharing: false }));
    const service = new FeatureFlagsService(getConfig({ FEATURE_FLAG_PROVIDER_URL: 'https://flags.example/api' }));

    const answers = await Promise.all([service.isEnabled('publicSharing'), service.isEnabled('publicSharing')]);

    expect(answers).toEqual([false, false]);
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

  it('keeps the last flags the provider gave while it fails, and waits the cache TTL before asking again', async () => {
    jest.useFakeTimers({ now: 0 });
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(providerAnswer({ ai: false }))
      .mockRejectedValue(new TypeError('fetch failed'));
    const service = new FeatureFlagsService(getConfig({
      FEATURE_FLAG_PROVIDER_URL: 'https://flags.example/api',
      FEATURE_FLAG_CACHE_TTL_MS: '1000',
    }));

    await expect(service.isEnabled('ai')).resolves.toBe(false);
    jest.setSystemTime(1_001);
    await expect(service.isEnabled('ai')).resolves.toBe(false);
    await expect(service.isEnabled('ai')).resolves.toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses a switched-off feature with 503 FEATURE_DISABLED and lets one that is on through', async () => {
    const service = featureFlagsWith({ cloudSync: false });

    await expect(service.assertEnabled('ai')).resolves.toBeUndefined();
    const refusal = await service.assertEnabled('cloudSync').catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ServiceUnavailableException);
    expect((refusal as ServiceUnavailableException).getResponse()).toMatchObject({
      statusCode: 503,
      code: 'FEATURE_DISABLED',
      message: 'The cloudSync feature is turned off for now',
    });
  });
});
