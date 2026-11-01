import { describe, expect, it } from 'vitest';

import { isValidRereadDay, rereadDateBounds, rereadPresetDay } from './rereadReminder';

describe('reread reminder days', () => {
  const today = new Date(2026, 9, 31);

  it('turns the presets into a day a week, a month and a year ahead', () => {
    expect(rereadPresetDay('week', today)).toBe('2026-11-07');
    // 31 October has no 31 November: the month's last day
    expect(rereadPresetDay('month', today)).toBe('2026-11-30');
    expect(rereadPresetDay('year', today)).toBe('2027-10-31');
    expect(rereadPresetDay('year', new Date(2028, 1, 29))).toBe('2029-02-28');
    expect(rereadPresetDay('month', new Date(2026, 11, 15))).toBe('2027-01-15');
  });

  it('accepts days from tomorrow up to fifty years ahead', () => {
    expect(rereadDateBounds(today)).toEqual({ min: '2026-11-01', max: '2076-10-31' });
    expect(isValidRereadDay('2026-11-01', today)).toBe(true);
    expect(isValidRereadDay('2076-10-31', today)).toBe(true);
    expect(isValidRereadDay('2026-10-31', today)).toBe(false);
    expect(isValidRereadDay('2076-11-01', today)).toBe(false);
    expect(isValidRereadDay('', today)).toBe(false);
  });
});
