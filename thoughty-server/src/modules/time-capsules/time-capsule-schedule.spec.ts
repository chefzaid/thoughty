import {
  DEFAULT_TIME_CAPSULE_HOUR,
  earliestOpeningDay,
  latestOpeningDay,
  scheduleTimeCapsule,
} from './time-capsule-schedule';

const openAt = (opensOn: string, timeZone: string, now: Date, openHour?: number) => {
  const result = scheduleTimeCapsule({ opensOn, openHour, timeZone }, now);
  return 'schedule' in result ? result.schedule.openAt.toISOString() : result.error;
};

describe('time capsule schedule', () => {
  // 22:30 UTC on 27 October 2026: still the 27th in New York, already the 28th in Tokyo.
  const now = new Date('2026-10-27T22:30:00Z');

  it('opens at 9:00 on the writer’s clock unless another hour is chosen', () => {
    expect(DEFAULT_TIME_CAPSULE_HOUR).toBe(9);
    expect(openAt('2027-10-27', 'Europe/Paris', now)).toBe('2027-10-27T07:00:00.000Z');
    expect(openAt('2027-01-15', 'Europe/Paris', now)).toBe('2027-01-15T08:00:00.000Z');
    expect(openAt('2027-01-15', 'Europe/Paris', now, 0)).toBe('2027-01-14T23:00:00.000Z');
    expect(openAt('2027-01-15', 'America/Los_Angeles', now, 23)).toBe('2027-01-16T07:00:00.000Z');
    expect(openAt('2027-01-15', 'Asia/Kolkata', now, 9)).toBe('2027-01-15T03:30:00.000Z');
  });

  it('counts tomorrow from the writer’s own day, not the server’s', () => {
    // It is the 27th in New York, so the 28th is tomorrow there; in Tokyo it is already the 28th
    expect(openAt('2026-10-28', 'America/New_York', now)).toBe('2026-10-28T13:00:00.000Z');
    expect(openAt('2026-10-28', 'Asia/Tokyo', now)).toBe('date');
    expect(openAt('2026-10-29', 'Asia/Tokyo', now)).toBe('2026-10-29T00:00:00.000Z');
    expect(openAt('2026-10-27', 'America/New_York', now)).toBe('date');
  });

  it('allows up to fifty years ahead, to the same day', () => {
    expect(openAt('2076-10-27', 'America/New_York', now)).toBe('2076-10-27T13:00:00.000Z');
    expect(openAt('2076-10-28', 'America/New_York', now)).toBe('date');
    expect(latestOpeningDay('2028-02-29')).toBe('2078-02-28');
    expect(latestOpeningDay('2026-10-27')).toBe('2076-10-27');
    expect(earliestOpeningDay('2026-12-31')).toBe('2027-01-01');
  });

  it('follows daylight-saving changes on the opening day: a skipped hour later, a repeated one at its first occurrence', () => {
    // 2027-03-28 in Paris: 02:00 jumps to 03:00. 2027-10-31: 02:00 happens twice, first at UTC+2.
    expect(openAt('2027-03-28', 'Europe/Paris', now, 2)).toBe('2027-03-28T01:00:00.000Z');
    expect(openAt('2027-10-31', 'Europe/Paris', now, 2)).toBe('2027-10-31T00:00:00.000Z');
    // 2027-04-04 in Sydney: 03:00 goes back to 02:00, first at UTC+11.
    expect(openAt('2027-04-04', 'Australia/Sydney', now, 2)).toBe('2027-04-03T15:00:00.000Z');
  });

  it('refuses unknown zones and dates that do not exist', () => {
    expect(openAt('2027-01-15', 'Mars/Olympus', now)).toBe('time-zone');
    expect(openAt('2027-02-30', 'UTC', now)).toBe('date');
    expect(openAt('2027-1-15', 'UTC', now)).toBe('date');
  });

  it('keeps what was asked with the instant it opens', () => {
    expect(scheduleTimeCapsule({ opensOn: '2027-06-01', openHour: 18, timeZone: 'Europe/Paris' }, now)).toEqual({
      schedule: { opensOn: '2027-06-01', openHour: 18, timeZone: 'Europe/Paris', openAt: new Date('2027-06-01T16:00:00Z') },
    });
  });
});
