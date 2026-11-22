import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserTimeZone, DELIVERY_HOURS, formatDeliveryHour, timeZoneOptions } from './timeZone';

describe('time zones', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the browser’s zone, falling back to UTC', () => {
    expect(browserTimeZone()).toBeTruthy();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw new Error('no Intl'); });
    expect(browserTimeZone()).toBe('UTC');
  });

  it('lists the known zones once each, sorted, with UTC and the current one', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue(['Europe/Paris', 'America/New_York']);
    expect(timeZoneOptions('Europe/Paris')).toEqual(['America/New_York', 'Europe/Paris', 'UTC']);
    expect(timeZoneOptions('Mars/Olympus')).toEqual(['America/New_York', 'Europe/Paris', 'Mars/Olympus', 'UTC']);
  });

  it('still offers UTC and the current zone when the browser cannot list zones', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => { throw new Error('unsupported'); });
    expect(timeZoneOptions('Europe/Paris')).toEqual(['Europe/Paris', 'UTC']);
  });

  it('offers every hour of the day, written as each language writes a clock time', () => {
    expect(DELIVERY_HOURS).toHaveLength(24);
    expect(DELIVERY_HOURS[0]).toBe(0);
    expect(DELIVERY_HOURS[23]).toBe(23);
    expect(formatDeliveryHour(20, 'en')).toBe('8:00 PM');
    expect(formatDeliveryHour(21, 'fr')).toBe('21:00');
  });
});
