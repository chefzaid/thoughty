import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserTimeZone, formatDeliveryDate, localize, resolveMemoirLanguage, weekdayName, WEEKDAYS } from './memoirFormat';

describe('memoirFormat', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses French copy for French and English for everything else', () => {
    expect(resolveMemoirLanguage('fr')).toBe('fr');
    expect(resolveMemoirLanguage('de')).toBe('en');
    expect(resolveMemoirLanguage(undefined)).toBe('en');
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
});
