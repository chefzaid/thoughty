import { afterEach, describe, expect, it, vi } from 'vitest';

import { weekdayName } from '../../utils/calendarNames';
import { browserTimeZone, formatDeliveryDate, localize, todayIn, WEEKDAYS } from './memoirFormat';

describe('memoirFormat', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the French copy when there is one', () => {
    expect(localize({ en: 'Childhood', fr: 'Enfance' }, 'fr')).toBe('Enfance');
    expect(localize({ en: 'Childhood', fr: '' }, 'fr')).toBe('Childhood');
  });

  it('names weekdays in the interface language, Monday first', () => {
    expect(WEEKDAYS.map((day) => weekdayName(day, 'en'))).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(weekdayName(0, 'fr')).toBe('dimanche');
  });

  it('formats the next delivery in the program time zone', () => {
    expect(formatDeliveryDate('2026-10-25T08:00:00.000Z', 'Europe/Paris', 'en')).toBe('Sunday, October 25');
    expect(formatDeliveryDate('2026-10-25T08:00:00.000Z', 'Europe/Paris', 'fr')).toBe('dimanche 25 octobre');
  });

  it('falls back to UTC when the browser cannot tell its time zone', () => {
    expect(browserTimeZone()).toBeTruthy();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('no zone');
    });
    expect(browserTimeZone()).toBe('UTC');
  });

  it('reads today in the memoir’s time zone, or the browser’s when the zone is unknown', () => {
    const now = new Date('2026-10-27T23:30:00Z');
    expect(todayIn('Europe/Paris', now)).toBe('2026-10-28');
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-10-27');
    expect(todayIn('Not/AZone', now)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
