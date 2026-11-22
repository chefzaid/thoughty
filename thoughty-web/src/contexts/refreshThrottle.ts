/**
 * The wait the API asked for after refusing a refresh with `429`: until it passes, no tab of this browser
 * sends a refresh. It is kept in `localStorage`, which every tab reads under the refresh lock, so tabs
 * waiting their turn see the wait the tab before them was given, and a reload during it sends nothing.
 * A `429` says nothing about the session: the cookie still works once the wait is over.
 */
const KEY = 'thoughty.refreshRetryAt';

/** Without a `Retry-After`, the first wait; each further refusal in a row doubles it. */
export const REFRESH_FIRST_WAIT_MS = 5_000;
/** The API counts refreshes over 15 minutes, so no wait is longer, whatever an answer says. */
export const REFRESH_MAX_WAIT_MS = 15 * 60 * 1000;
/** Up to a quarter of the wait (at most this) is added, so browsers sharing an address do not all retry at once. */
const MAX_JITTER_MS = 30_000;

interface RefreshThrottle {
  /** When a refresh may be sent again (epoch milliseconds). */
  until: number;
  /** Refusals in a row, for the backoff when the API gives no `Retry-After`. */
  strikes: number;
}

/** Kept here too, for a browser whose storage is blocked: the wait then holds for this tab only. */
let inMemory: RefreshThrottle | null = null;

function isThrottle(value: unknown): value is RefreshThrottle {
  if (!value || typeof value !== 'object') return false;
  const { until, strikes } = value as Record<string, unknown>;
  return Number.isFinite(until) && Number.isInteger(strikes) && (strikes as number) > 0;
}

function readThrottle(): RefreshThrottle | null {
  let stored: string | null;
  try {
    const storage = globalThis.localStorage;
    if (!storage) return inMemory;
    stored = storage.getItem(KEY);
  } catch {
    return inMemory;
  }
  try {
    const parsed: unknown = stored === null ? null : JSON.parse(stored);
    return isThrottle(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** `Retry-After` in milliseconds: delay-seconds or an HTTP date; null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value?.trim()) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : null;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/** How long until a refresh may be sent, or 0 when it may be sent now. */
export function refreshWaitMs(now = Date.now()): number {
  const throttle = readThrottle();
  if (!throttle) return 0;
  // A wait further away than the longest one (a clock set back since) is not kept
  const wait = throttle.until - now;
  return wait > 0 && wait <= REFRESH_MAX_WAIT_MS + MAX_JITTER_MS ? wait : 0;
}

/** Records a `429` and returns how long refreshes now wait. */
export function noteRefreshThrottled(retryAfter: string | null, now = Date.now()): number {
  const strikes = (readThrottle()?.strikes ?? 0) + 1;
  const asked = parseRetryAfter(retryAfter, now);
  const base = Math.min(asked ?? REFRESH_FIRST_WAIT_MS * 2 ** (strikes - 1), REFRESH_MAX_WAIT_MS);
  const wait = Math.max(base, 1000) + Math.round(Math.random() * Math.min(base / 4, MAX_JITTER_MS));
  inMemory = { until: now + wait, strikes };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(inMemory));
  } catch {
    // Storage blocked: the wait holds for this tab
  }
  return wait;
}

/** The API answered something other than `429`: refreshes go as usual again. */
export function clearRefreshThrottle(): void {
  inMemory = null;
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Nothing to remove when storage is blocked
  }
}
