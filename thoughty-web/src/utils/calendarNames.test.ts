import { describe, expect, it } from 'vitest';

import { monthName, weekdayName } from './calendarNames';

describe('calendarNames', () => {
  it('names months in the interface language', () => {
    expect(monthName(1, 'en')).toBe('January');
    expect(monthName(12, 'fr')).toBe('décembre');
    expect(monthName(3, 'en', 'short')).toBe('Mar');
  });

  it('names weekdays from Sunday as 0', () => {
    expect(weekdayName(0, 'en')).toBe('Sunday');
    expect(weekdayName(1, 'fr')).toBe('lundi');
  });
});
