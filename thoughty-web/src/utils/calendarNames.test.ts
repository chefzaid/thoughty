import { describe, expect, it } from 'vitest';

import { hourName, monthName, weekdayName } from './calendarNames';

describe('calendarNames', () => {
  it('names months in the interface language', () => {
    expect(monthName(1, 'en')).toBe('January');
    expect(monthName(12, 'fr')).toBe('décembre');
    expect(monthName(3, 'en', 'short')).toBe('Mar');
  });

  it('names weekdays from Sunday as 0', () => {
    expect(weekdayName(0, 'en')).toBe('Sunday');
    expect(weekdayName(1, 'fr')).toBe('lundi');
    expect(weekdayName(1, 'en', 'short')).toBe('Mon');
    expect(weekdayName(3, 'fr', 'short')).toBe('mer.');
  });

  it('names hours of the day in the interface language, whatever the browser’s zone', () => {
    expect(hourName(0, 'en')).toBe('12 AM');
    expect(hourName(21, 'en')).toBe('9 PM');
    expect(hourName(21, 'fr')).toBe('21 h');
  });
});
