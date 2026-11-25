import { describeContract } from './contract-suite';

const UNLEASH_API = 'http://thoughty-unleash.contract.invalid:4242/api';
const UNLEASH_FEATURES = `${UNLEASH_API}/client/features`;
const UNLEASH_TOKEN = 'default:production.contract-unleash-token';

/** What the fake Unleash answers now: the suite changes the toggles between requests. */
const unleash = {
  version: 2,
  features: [] as { name: string; enabled: boolean; strategies: unknown[] }[],
};
const outboundJson: Record<string, unknown> = { [UNLEASH_FEATURES]: unleash };
const standard = { name: 'default', parameters: {}, constraints: [] };

/**
 * The API reading its flags from Unleash (`FEATURE_FLAG_PROVIDER=unleash`), as production does: a
 * toggle switched off there refuses its feature on the next read (the cache is 1 ms here), toggles
 * of other names change nothing, and an unreachable Unleash keeps the toggles last read.
 */
describeContract(
  'feature-flag-provider',
  (context) => {
    const flags = async () =>
      (await context.client.call('GET /api/config/feature-flags', { as: context.alice, status: 200 })).body;
    const nextRead = () => new Promise((resolve) => setTimeout(resolve, 5));

    it('serves the toggles of Unleash over FEATURE_FLAGS, and refuses a feature switched off there', async () => {
      const { alice } = context;
      unleash.features = [
        { name: 'ai', enabled: false, strategies: [standard] },
        { name: 'cloudSync', enabled: true, strategies: [{ name: 'flexibleRollout', parameters: { rollout: '100' }, constraints: [] }] },
        { name: 'anotherAppsToggle', enabled: false, strategies: [] },
      ];
      expect(await flags()).toEqual({ ai: false, bookConverter: false, cloudSync: true, publicSharing: true });
      await context.client.call('POST /api/ai/fix-writing', {
        as: alice,
        json: { content: 'i has a dog', mode: 'grammar' },
        status: 503,
        code: 'FEATURE_DISABLED',
      });

      unleash.features = [{ name: 'ai', enabled: true, strategies: [standard] }];
      await nextRead();
      expect(await flags()).toEqual({ ai: true, bookConverter: false, cloudSync: false, publicSharing: true });
      expect(context.api.blockedRequests).toEqual([]);
    });

    it('keeps the toggles last read while Unleash cannot be reached, and logs no token', async () => {
      unleash.features = [{ name: 'publicSharing', enabled: false, strategies: [] }];
      await nextRead();
      expect(await flags()).toMatchObject({ publicSharing: false });

      delete outboundJson[UNLEASH_FEATURES];
      await nextRead();
      expect(await flags()).toMatchObject({ publicSharing: false });
      expect(context.api.blockedRequests).toContain(UNLEASH_FEATURES);
      expect(context.api.logger.lines.join('\n')).toContain('Feature flag provider unavailable');
      expect(context.api.logger.lines.join('\n')).not.toContain(UNLEASH_TOKEN);
    });
  },
  {
    env: {
      FEATURE_FLAG_PROVIDER: 'unleash',
      FEATURE_FLAG_PROVIDER_URL: UNLEASH_API,
      FEATURE_FLAG_PROVIDER_TOKEN: UNLEASH_TOKEN,
      FEATURE_FLAG_CACHE_TTL_MS: '1',
      // A flag Unleash leaves out keeps this value; one it names wins over it
      FEATURE_FLAGS: 'bookConverter=false,cloudSync=false',
    },
    outboundJson,
  },
);
