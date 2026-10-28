import { describe, expect, it } from 'vitest';
import { customExpiryBounds, shareLinkExpiresAt } from './shareLinkExpiry';

describe('share link expiry', () => {
  const now = new Date(2026, 9, 28, 10, 30);

  it('counts the presets from now', () => {
    const DAY = 24 * 60 * 60 * 1000;
    expect(shareLinkExpiresAt('day', '', now)).toBe(new Date(now.getTime() + DAY).toISOString());
    expect(shareLinkExpiresAt('week', '', now)).toBe(new Date(now.getTime() + 7 * DAY).toISOString());
    expect(shareLinkExpiresAt('month', '', now)).toBe(new Date(now.getTime() + 30 * DAY).toISOString());
  });

  it('offers days from tomorrow to a year from today, ending the link with the picked day', () => {
    expect(customExpiryBounds(now)).toEqual({ min: '2026-10-29', max: '2027-10-28' });
    expect(shareLinkExpiresAt('custom', '2026-12-24', now)).toBe(new Date(2026, 11, 24, 23, 59).toISOString());
    for (const day of ['', '2026-10-28', '2027-10-29', '24/12/2026']) {
      expect(shareLinkExpiresAt('custom', day, now)).toBeNull();
    }
  });
});
