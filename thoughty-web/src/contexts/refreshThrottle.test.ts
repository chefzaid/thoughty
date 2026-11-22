import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backoffMs,
  clearRefreshThrottle,
  clearSessionUserThrottle,
  noteSessionUserThrottled,
  sessionUserWaitMs,
  noteRefreshThrottled,
  parseRetryAfter,
  REFRESH_FIRST_WAIT_MS,
  REFRESH_MAX_WAIT_MS,
  refreshWaitMs,
} from './refreshThrottle';

const NOW = Date.parse('2026-11-22T12:00:00Z');

describe('refreshThrottle', () => {
  beforeEach(() => {
    localStorage.clear();
    clearRefreshThrottle();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads Retry-After as seconds or as an HTTP date', () => {
    expect(parseRetryAfter('120', NOW)).toBe(120_000);
    expect(parseRetryAfter(new Date(NOW + 30_000).toUTCString(), NOW)).toBe(30_000);
    expect(parseRetryAfter(new Date(NOW - 30_000).toUTCString(), NOW)).toBe(0);
    expect(parseRetryAfter(null, NOW)).toBeNull();
    expect(parseRetryAfter(' ', NOW)).toBeNull();
    expect(parseRetryAfter('-5', NOW)).toBeNull();
    expect(parseRetryAfter('soon', NOW)).toBeNull();
  });

  it('waits as long as the API asks, then lets refreshes go', () => {
    expect(refreshWaitMs(NOW)).toBe(0);

    expect(noteRefreshThrottled('90', NOW)).toBe(90_000);

    expect(refreshWaitMs(NOW)).toBe(90_000);
    expect(refreshWaitMs(NOW + 89_000)).toBe(1_000);
    expect(refreshWaitMs(NOW + 90_000)).toBe(0);
  });

  it('backs off without Retry-After, doubling up to the API’s window, and starts again after an answer', () => {
    const waits = Array.from({ length: 10 }, () => noteRefreshThrottled(null, NOW));

    expect(waits.slice(0, 4)).toEqual([1, 2, 4, 8].map((factor) => REFRESH_FIRST_WAIT_MS * factor));
    expect(Math.max(...waits)).toBe(REFRESH_MAX_WAIT_MS);

    clearRefreshThrottle();
    expect(refreshWaitMs(NOW)).toBe(0);
    expect(noteRefreshThrottled(null, NOW)).toBe(REFRESH_FIRST_WAIT_MS);
  });

  it('never waits longer than the window or less than a second, whatever the answer says', () => {
    expect(noteRefreshThrottled('86400', NOW)).toBe(REFRESH_MAX_WAIT_MS);
    expect(noteRefreshThrottled('0', NOW)).toBe(1_000);
  });

  it('spreads the retries of browsers sharing an address over a quarter of the wait, at most 30 seconds', () => {
    vi.mocked(Math.random).mockReturnValue(1);

    expect(noteRefreshThrottled('60', NOW)).toBe(75_000);
    expect(noteRefreshThrottled('900', NOW)).toBe(930_000);
    expect(refreshWaitMs(NOW)).toBe(930_000);
  });

  it('is shared through storage, and ignores what it cannot read or a clock set back', () => {
    noteRefreshThrottled('60', NOW);
    expect(JSON.parse(localStorage.getItem('thoughty.refreshRetryAt') ?? 'null')).toEqual({ until: NOW + 60_000, strikes: 1 });

    localStorage.setItem('thoughty.refreshRetryAt', '{"until":"soon","strikes":1}');
    expect(refreshWaitMs(NOW)).toBe(0);
    localStorage.setItem('thoughty.refreshRetryAt', 'not json');
    expect(refreshWaitMs(NOW)).toBe(0);
    localStorage.setItem('thoughty.refreshRetryAt', JSON.stringify({ until: NOW + 24 * 3_600_000, strikes: 1 }));
    expect(refreshWaitMs(NOW)).toBe(0);
  });

  it('holds the wait in this tab when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    noteRefreshThrottled('30', NOW);
    expect(refreshWaitMs(NOW)).toBe(30_000);
    clearRefreshThrottle();
    expect(refreshWaitMs(NOW)).toBe(0);
  });

  it('backs off from five seconds, doubling, to at most fifteen minutes', () => {
    expect(backoffMs(0)).toBe(REFRESH_FIRST_WAIT_MS);
    expect(backoffMs(1)).toBe(REFRESH_FIRST_WAIT_MS);
    expect(backoffMs(2)).toBe(2 * REFRESH_FIRST_WAIT_MS);
    expect(backoffMs(30)).toBe(REFRESH_MAX_WAIT_MS);
  });

  it('keeps the wait for `/me` apart from the refresh’s', () => {
    expect(noteSessionUserThrottled('60', NOW)).toBe(60_000);

    expect(sessionUserWaitMs(NOW)).toBe(60_000);
    expect(refreshWaitMs(NOW)).toBe(0);
    clearSessionUserThrottle();
    expect(sessionUserWaitMs(NOW)).toBe(0);
  });
});
