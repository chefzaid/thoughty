/**
 * The writer's own model server, for the diaries set to "My own model only": an OpenAI-compatible address (Ollama,
 * LM Studio, llama.cpp's server), the model to ask, and the key it may want. It lives in this browser only, per
 * writer: Thoughty's server never learns it, and the key goes when the writer signs out (`forgetLocalModelKeys`).
 */
export interface LocalModelSettings {
  /**
   * The OpenAI-compatible base address, such as `http://localhost:11434/v1` or `https://models.home.example/v1`,
   * without a trailing slash.
   */
  readonly baseUrl: string;
  readonly model: string;
  /** Sent as a bearer token when set; most local servers want none. */
  readonly apiKey: string;
}

/** Why an address cannot be used: not a web address, or plain http to another device. */
export type LocalModelAddressProblem = 'localModelAddressInvalid' | 'localModelAddressNeedsHttps';

export type LocalModelAddress = { readonly baseUrl: string; readonly problem: null } | { readonly baseUrl: null; readonly problem: LocalModelAddressProblem };

const STORAGE_PREFIX = 'thoughty.localModel.';

/**
 * The hosts the web app may call over plain http (`connect-src` in nginx-security-headers.conf allows these on any
 * port, beside any https address): this device's loopback names, which the browser lets an https page call over
 * http. Plain http to any other host would cross the network in clear (and is mixed content for the browser).
 */
const LOOPBACK_HOSTS: readonly string[] = ['localhost', '127.0.0.1'];

/**
 * The base address of a model server, from what the writer typed: any https address, or an http one on this
 * device, with no credentials, query or fragment, and without its trailing slash.
 */
export function parseLocalModelAddress(input: string): LocalModelAddress {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { baseUrl: null, problem: 'localModelAddressInvalid' };
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) {
    return { baseUrl: null, problem: 'localModelAddressInvalid' };
  }
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.includes(url.hostname)) {
    return { baseUrl: null, problem: 'localModelAddressNeedsHttps' };
  }
  return { baseUrl: `${url.origin}${url.pathname.replace(/\/+$/, '')}`, problem: null };
}

function isSettings(value: unknown): value is LocalModelSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Record<string, unknown>;
  return typeof settings.baseUrl === 'string'
    && parseLocalModelAddress(settings.baseUrl).baseUrl === settings.baseUrl
    && typeof settings.model === 'string'
    && settings.model.trim() !== ''
    && typeof settings.apiKey === 'string';
}

/** The writer's model server on this browser, or null when they set none (or it cannot be read). */
export function readLocalModelSettings(userId: number | null | undefined): LocalModelSettings | null {
  if (userId == null) return null;
  try {
    const stored = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}${userId}`);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return isSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Saves the writer's model server on this browser; false when the browser keeps nothing (storage blocked or full). */
export function writeLocalModelSettings(userId: number, settings: LocalModelSettings): boolean {
  try {
    globalThis.localStorage?.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalModelSettings(userId: number): void {
  try {
    globalThis.localStorage?.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch {
    // Nothing to remove when storage is blocked
  }
}

/** Drops every writer's model server key from this browser as the writer signs out; the address and model stay. */
export function forgetLocalModelKeys(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key?.startsWith(STORAGE_PREFIX) ?? false);
    for (const key of keys) {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? 'null');
      if (isSettings(parsed) && parsed.apiKey) storage.setItem(key, JSON.stringify({ ...parsed, apiKey: '' }));
    }
  } catch {
    // Nothing to forget when storage is blocked
  }
}
