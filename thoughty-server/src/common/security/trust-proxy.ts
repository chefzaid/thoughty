/**
 * Express `trust proxy` setting, so `req.ip` (and with it the throttler tracker) is the
 * client address instead of the ingress proxy's.
 *
 * TRUST_PROXY accepts what Express accepts: `true`/`false`, a hop count (`2`), or a comma
 * list of addresses, CIDRs and the names `loopback`, `linklocal` and `uniquelocal`.
 * When unset, production trusts only loopback and private-network proxies (in-cluster
 * ingress); development trusts nothing, so X-Forwarded-For cannot be spoofed locally.
 */
export const DEFAULT_PRODUCTION_TRUST_PROXY = 'loopback, linklocal, uniquelocal';

export type TrustProxySetting = boolean | number | string[];

interface TrustProxyEnv extends Record<string, string | undefined> {
  NODE_ENV?: string;
  TRUST_PROXY?: string;
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getTrustProxySetting(env: TrustProxyEnv = process.env): TrustProxySetting {
  const raw = env.TRUST_PROXY?.trim();

  if (!raw) {
    return env.NODE_ENV === 'production' ? parseList(DEFAULT_PRODUCTION_TRUST_PROXY) : false;
  }

  const lower = raw.toLowerCase();
  if (lower === 'true') {
    return true;
  }
  if (lower === 'false') {
    return false;
  }
  if (/^\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }

  return parseList(raw);
}

interface SettingsHost {
  set(setting: string, value: unknown): unknown;
}

/** Express compiles the value immediately, so an invalid address fails at startup. */
export function useTrustProxy(app: SettingsHost, env: TrustProxyEnv = process.env): TrustProxySetting {
  const setting = getTrustProxySetting(env);
  app.set('trust proxy', setting);
  return setting;
}
