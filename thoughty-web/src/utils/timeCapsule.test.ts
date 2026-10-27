import { describe, expect, it } from 'vitest';
import {
  defaultTimeCapsule,
  formatTimeCapsuleDay,
  formatTimeCapsuleMoment,
  isSealedEntry,
  isValidTimeCapsuleDate,
  timeCapsuleDateBounds,
  browserTimeZone,
} from './timeCapsule';

describe('time capsule utils', () => {
  const today = new Date(2026, 9, 27, 15, 0);

  it('allows opening from tomorrow up to fifty years ahead', () => {
    expect(timeCapsuleDateBounds(today)).toEqual({ min: '2026-10-28', max: '2076-10-27' });
    expect(timeCapsuleDateBounds(new Date(2028, 1, 29))).toEqual({ min: '2028-03-01', max: '2078-02-28' });
    expect(isValidTimeCapsuleDate('2026-10-28', today)).toBe(true);
    expect(isValidTimeCapsuleDate('2026-10-27', today)).toBe(false);
    expect(isValidTimeCapsuleDate('2076-10-28', today)).toBe(false);
    expect(isValidTimeCapsuleDate('', today)).toBe(false);
  });

  it('opens a new capsule a year from today at 9:00, or as many years as a template asks', () => {
    expect(defaultTimeCapsule(today)).toEqual({ opensOn: '2027-10-27', openHour: 9 });
    expect(defaultTimeCapsule(today, 10)).toEqual({ opensOn: '2036-10-27', openHour: 9 });
  });

  it('writes when a capsule opens in the reader’s language and knows a sealed entry', () => {
    expect(formatTimeCapsuleMoment('2031-10-27T08:00:00Z', 'en')).toMatch(/October 27, 2031/);
    expect(formatTimeCapsuleMoment('2031-10-27T08:00:00Z', 'fr')).toMatch(/27 octobre 2031/);
    expect(formatTimeCapsuleDay('2031-10-27T12:00:00Z', 'fr')).toBe('27 octobre 2031');
    expect(isSealedEntry({ sealed_until: '2031-10-27T08:00:00Z' })).toBe(true);
    expect(isSealedEntry({ sealed_until: null })).toBe(false);
    expect(isSealedEntry({})).toBe(false);
    expect(browserTimeZone()).toEqual(expect.any(String));
  });
});
