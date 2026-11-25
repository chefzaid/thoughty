import { Logger, ServiceUnavailableException } from '@nestjs/common';
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

  describe('with Unleash', () => {
    const unleashConfig = (values: Record<string, string> = {}) => getConfig({
      FEATURE_FLAG_PROVIDER: 'Unleash',
      FEATURE_FLAG_PROVIDER_URL: 'http://thoughty-unleash:4242/api',
      FEATURE_FLAG_PROVIDER_TOKEN: 'default:production.unleash-secret',
      ...values,
    });
    const unleashAnswer = (features: unknown[]) => Response.json({ version: 2, features });

    it('reads the toggles over the fallback flags, ignoring toggles of other names, with a timeout', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(unleashAnswer([
        { name: 'ai', enabled: false, strategies: [{ name: 'default' }] },
        { name: 'betaFeed', enabled: true, strategies: [] },
      ]));
      const service = new FeatureFlagsService(unleashConfig({ FEATURE_FLAGS: 'cloudSync=false' }));

      await expect(service.getFeatureFlags()).resolves.toEqual({
        ai: false,
        bookConverter: true,
        cloudSync: false,
        publicSharing: true,
      });
      expect(fetch).toHaveBeenCalledWith('http://thoughty-unleash:4242/api/client/features', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'default:production.unleash-secret' }),
        signal: expect.any(AbortSignal),
      }));
    });

    it('lets a toggle turn back on a flag FEATURE_FLAGS turns off', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(unleashAnswer([{ name: 'ai', enabled: true, strategies: [] }]));
      const service = new FeatureFlagsService(unleashConfig({ FEATURE_FLAGS: 'ai=false' }));

      await expect(service.isEnabled('ai')).resolves.toBe(true);
    });

    it('keeps the last toggles while Unleash is down or times out, and never logs the token', async () => {
      jest.useFakeTimers({ now: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const fetchMock = jest.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(unleashAnswer([{ name: 'publicSharing', enabled: false, strategies: [] }]))
        .mockRejectedValueOnce(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }))
        .mockResolvedValueOnce(new Response('{"error":"unauthorized"}', { status: 401 }));
      const service = new FeatureFlagsService(unleashConfig({ FEATURE_FLAG_CACHE_TTL_MS: '1000' }));

      await expect(service.isEnabled('publicSharing')).resolves.toBe(false);
      jest.setSystemTime(1_001);
      await expect(service.isEnabled('publicSharing')).resolves.toBe(false);
      jest.setSystemTime(2_002);
      await expect(service.isEnabled('publicSharing')).resolves.toBe(false);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(warn).toHaveBeenCalledWith('Feature flag provider unavailable', {
        errorName: 'TimeoutError',
        errorMessage: 'The operation was aborted due to timeout',
      });
      expect(warn).toHaveBeenCalledWith('Feature flag provider unavailable', {
        errorName: 'Error',
        errorMessage: 'Unleash returned 401',
      });
      expect(JSON.stringify(warn.mock.calls)).not.toContain('unleash-secret');
    });

    it('uses the fallback flags when Unleash answers no features list before any toggles were read', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'not a client answer' }));
      const service = new FeatureFlagsService(unleashConfig({ FEATURE_FLAGS: 'bookConverter=false' }));

      await expect(service.getFeatureFlags()).resolves.toMatchObject({ ai: true, bookConverter: false });
    });

    it('asks no provider for an unknown FEATURE_FLAG_PROVIDER and uses the fallback flags', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const fetchMock = jest.spyOn(globalThis, 'fetch');
      const service = new FeatureFlagsService(unleashConfig({ FEATURE_FLAG_PROVIDER: 'flagsmith', FEATURE_FLAGS: 'ai=false' }));

      await expect(service.isEnabled('ai')).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith('Feature flag provider unavailable', {
        errorName: 'Error',
        errorMessage: 'Unknown FEATURE_FLAG_PROVIDER "flagsmith", expected json or unleash',
      });
    });
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
