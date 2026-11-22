/**
 * The wait the API asked for after refusing a refresh, or a read of `GET /api/auth/me`, with `429`: until it
 * passes, no tab of this browser sends that request. It is kept in `localStorage`, which every tab reads (a
 * refresh's under the refresh lock), so tabs waiting their turn see the wait the tab before them was given,
 * and a reload during it sends nothing. A `429` says nothing about the session: it still works after the wait.
 */

/** Without a `Retry-After`, the first wait; each further refusal in a row doubles it. */
export const REFRESH_FIRST_WAIT_MS = 5_000;
/** The API counts refreshes over 15 minutes, so no wait is longer, whatever an answer says. */
export const REFRESH_MAX_WAIT_MS = 15 * 60 * 1000;
/** Up to a quarter of the wait (at most this) is added, so browsers sharing an address do not all retry at once. */
const MAX_JITTER_MS = 30_000;

interface RefreshThrottle {
  /** When the request may be sent again (epoch milliseconds). */
  until: number;
  /** Refusals in a row, for the backoff when the API gives no `Retry-After`. */
  strikes: number;
}

function isThrottle(value: unknown): value is RefreshThrottle {
  if (!value || typeof value !== 'object') return false;
  const { until, strikes } = value as Record<string, unknown>;
  return Number.isFinite(until) && Number.isInteger(strikes) && (strikes as number) > 0;
}

/** `Retry-After` in milliseconds: delay-seconds or an HTTP date; null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value?.trim()) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : null;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/** The wait before the next try after `strikes` refusals or failures in a row, when the API did not say how long. */
function backoffBase(strikes: number): number {
  return Math.min(REFRESH_FIRST_WAIT_MS * 2 ** (strikes - 1), REFRESH_MAX_WAIT_MS);
}

/** A wait of `base`, at least a second, plus its jitter. */
function withJitter(base: number): number {
  return Math.max(base, 1000) + Math.round(Math.random() * Math.min(base / 4, MAX_JITTER_MS));
}

/** How long to wait before trying again after `strikes` failures in a row that came with no wait asked (5 s doubling). */
export function backoffMs(strikes: number): number {
  return withJitter(backoffBase(Math.max(1, strikes)));
}

interface ApiWait {
  /** How long until a request may be sent, or 0 when it may be sent now. */
  waitMs: (now?: number) => number;
  /** Records a `429` and returns how long requests now wait. */
  note: (retryAfter: string | null, now?: number) => number;
  /** The API answered something other than `429`: requests go as usual again. */
  clear: () => void;
}

function createApiWait(key: string): ApiWait {
  /** Kept here too, for a browser whose storage is blocked: the wait then holds for this tab only. */
  let inMemory: RefreshThrottle | null = null;

  const read = (): RefreshThrottle | null => {
    let stored: string | null;
    try {
      const storage = globalThis.localStorage;
      if (!storage) return inMemory;
      stored = storage.getItem(key);
    } catch {
      return inMemory;
    }
    try {
      const parsed: unknown = stored === null ? null : JSON.parse(stored);
      return isThrottle(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  return {
    waitMs: (now = Date.now()) => {
      const throttle = read();
      if (!throttle) return 0;
      // A wait further away than the longest one (a clock set back since) is not kept
      const wait = throttle.until - now;
      return wait > 0 && wait <= REFRESH_MAX_WAIT_MS + MAX_JITTER_MS ? wait : 0;
    },
    note: (retryAfter, now = Date.now()) => {
      const strikes = (read()?.strikes ?? 0) + 1;
      const asked = parseRetryAfter(retryAfter, now);
      const wait = withJitter(asked === null ? backoffBase(strikes) : Math.min(asked, REFRESH_MAX_WAIT_MS));
      inMemory = { until: now + wait, strikes };
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(inMemory));
      } catch {
        // Storage blocked: the wait holds for this tab
      }
      return wait;
    },
    clear: () => {
      inMemory = null;
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // Nothing to remove when storage is blocked
      }
    },
  };
}

const refreshWait = createApiWait('thoughty.refreshRetryAt');
/** `GET /api/auth/me`, which says whose a session is, has its own limit and so its own wait. */
const sessionUserWait = createApiWait('thoughty.meRetryAt');

/** How long until a refresh may be sent, or 0 when it may be sent now. */
export const refreshWaitMs = refreshWait.waitMs;
/** Records a refused refresh (`429`) and returns how long refreshes now wait. */
export const noteRefreshThrottled = refreshWait.note;
export const clearRefreshThrottle = refreshWait.clear;

/** The same for `GET /api/auth/me`. */
export const sessionUserWaitMs = sessionUserWait.waitMs;
export const noteSessionUserThrottled = sessionUserWait.note;
export const clearSessionUserThrottle = sessionUserWait.clear;
