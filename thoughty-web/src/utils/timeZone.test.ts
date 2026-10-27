import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserTimeZone, timeZoneOptions } from './timeZone';

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
});
