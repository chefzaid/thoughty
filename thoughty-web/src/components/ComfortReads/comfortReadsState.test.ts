import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callsForComfortReads, markOfferedOn, wasOfferedOn } from './comfortReadsState';

describe('comfortReadsState', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('calls for the offer after a very low mood only, with the setting on', () => {
    expect(callsForComfortReads({ id: 1, mood: 1 }, true)).toBe(true);
    expect(callsForComfortReads({ id: 1, mood: 1 }, false)).toBe(false);
    expect(callsForComfortReads({ id: 1, mood: 2 }, true)).toBe(false);
    expect(callsForComfortReads({ id: 1, mood: null }, true)).toBe(false);
    expect(callsForComfortReads(null, true)).toBe(false);
  });

  it('remembers the day of the offer for each writer', () => {
    markOfferedOn(7, '2026-10-27');
    expect(wasOfferedOn(7, '2026-10-27')).toBe(true);
    expect(wasOfferedOn(7, '2026-10-28')).toBe(false);
    expect(wasOfferedOn(8, '2026-10-27')).toBe(false);
  });

  it('lets the offer appear when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(() => markOfferedOn(7, '2026-10-27')).not.toThrow();
    expect(wasOfferedOn(7, '2026-10-27')).toBe(false);
  });
});
