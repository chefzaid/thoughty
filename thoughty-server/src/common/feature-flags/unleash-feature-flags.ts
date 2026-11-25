import { hostname } from 'node:os';

/** The application name Unleash shows for this API and its worker (`UNLEASH-APPNAME`). */
export const UNLEASH_APP_NAME = 'thoughty-server';

interface UnleashStrategy {
  name?: unknown;
  disabled?: unknown;
  constraints?: unknown;
  segments?: unknown;
  parameters?: { rollout?: unknown } | null;
}

interface UnleashToggle {
  name?: unknown;
  enabled?: unknown;
  strategies?: unknown;
}

export interface UnleashRequest {
  /** Unleash's API address, as its SDKs take it (`http://unleash:4242/api`); the server root works too. */
  apiUrl: string;
  /** A backend (client) token, sent as Unleash expects it: the bare token, no `Bearer`. */
  token?: string;
  signal: AbortSignal;
}

/** `GET <api>/client/features`, whether the address ends with `/api` or is the server root. */
export function unleashFeaturesUrl(apiUrl: string): string {
  const base = apiUrl.trim().replace(/\/+$/, '');
  return `${base.endsWith('/api') ? base : `${base}/api`}/client/features`;
}

const hasItems = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

/**
 * Whether a strategy turns its toggle on for everyone: the standard strategy (`default`), or a
 * gradual rollout at 100%, active and without constraints or segments. The API reads one value per
 * flag for every writer, so anything that depends on who asks (a partial rollout, user IDs, IP
 * addresses, constraints, segments) cannot be evaluated here and does not turn the toggle on.
 */
function turnsOnForEveryone(strategy: UnleashStrategy | null): boolean {
  if (!strategy || typeof strategy !== 'object' || strategy.disabled === true) {
    return false;
  }
  if (hasItems(strategy.constraints) || hasItems(strategy.segments)) {
    return false;
  }
  if (strategy.name === 'default') {
    return true;
  }
  return strategy.name === 'flexibleRollout' && Number(strategy.parameters?.rollout) === 100;
}

/** Enabled in the token's environment, with no strategy or one that is on for everyone. */
function isToggleOn(toggle: UnleashToggle): boolean {
  if (toggle.enabled !== true) {
    return false;
  }
  const strategies = Array.isArray(toggle.strategies) ? (toggle.strategies as (UnleashStrategy | null)[]) : [];
  return strategies.length === 0 || strategies.some(turnsOnForEveryone);
}

/**
 * The flags an Unleash client answer sets: each toggle named after one of `knownFlags`, on or off.
 * Toggles with other names (another app's, or a typo) are ignored, and a flag with no toggle keeps
 * its fallback value. An answer without a `features` list is an error, so the last flags stay.
 */
export function readUnleashToggles(payload: unknown, knownFlags: readonly string[]): Record<string, boolean> {
  const toggles = (payload as { features?: unknown } | null)?.features;
  if (!Array.isArray(toggles)) {
    throw new Error('Unleash answered without a features list');
  }

  const flags: Record<string, boolean> = {};
  for (const toggle of toggles as (UnleashToggle | null)[]) {
    const name = toggle?.name;
    if (typeof name === 'string' && knownFlags.includes(name) && typeof toggle?.enabled === 'boolean') {
      flags[name] = isToggleOn(toggle);
    }
  }
  return flags;
}

/** Reads the toggles from Unleash's client API (`GET /api/client/features`). */
export async function fetchUnleashToggles(
  { apiUrl, token, signal }: UnleashRequest,
  knownFlags: readonly string[],
): Promise<Record<string, boolean>> {
  const response = await fetch(unleashFeaturesUrl(apiUrl), {
    headers: {
      Accept: 'application/json',
      'UNLEASH-APPNAME': UNLEASH_APP_NAME,
      'UNLEASH-INSTANCEID': hostname(),
      ...(token ? { Authorization: token } : {}),
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unleash returned ${response.status}`);
  }
  return readUnleashToggles(await response.json(), knownFlags);
}
