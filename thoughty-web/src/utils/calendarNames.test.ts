import { describe, expect, it } from 'vitest';

import { hourName, longDayName, longDaySpan, monthName, weekdayName } from './calendarNames';

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

  it('writes days and spans of days out in full, whatever the browser’s zone', () => {
    expect(longDayName('2024-03-03', 'en')).toBe('March 3, 2024');
    expect(longDayName('2024-03-03', 'fr')).toBe('3 mars 2024');
    // Ranges put thin spaces around their dash
    expect(longDaySpan('2025-03-01', '2025-03-12', 'en')).toBe('March 1\u2009–\u200912, 2025');
    expect(longDaySpan('2025-02-27', '2025-03-02', 'fr')).toBe('27 février\u2009–\u20092 mars 2025');
    expect(longDaySpan('2025-03-01', '2025-03-01', 'en')).toBe('March 1, 2025');
  });
});
