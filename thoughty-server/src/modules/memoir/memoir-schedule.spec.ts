import { isValidTimeZone, localDateIn, memoirSnoozeReturnDay, nextWeeklyDelivery } from './memoir-schedule';

describe('memoir schedule', () => {
  it('recognizes IANA time zones', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  describe('nextWeeklyDelivery', () => {
    it('delivers at 09:00 later the same day when that weekday has not reached nine yet', () => {
      // Sunday 2026-10-18 07:30 UTC
      expect(nextWeeklyDelivery(new Date('2026-10-18T07:30:00Z'), 0, 'UTC').toISOString()).toBe(
        '2026-10-18T09:00:00.000Z',
      );
    });

    it('waits a full week when nine o’clock on that weekday has passed', () => {
      expect(nextWeeklyDelivery(new Date('2026-10-18T09:00:00Z'), 0, 'UTC').toISOString()).toBe(
        '2026-10-25T09:00:00.000Z',
      );
    });

    it('rolls over month ends to the next chosen weekday', () => {
      // Friday 2026-10-30 → Monday 2026-11-02
      expect(nextWeeklyDelivery(new Date('2026-10-30T12:00:00Z'), 1, 'UTC').toISOString()).toBe(
        '2026-11-02T09:00:00.000Z',
      );
    });

    it('uses the local wall clock, following daylight-saving changes', () => {
      // Paris is UTC+2 until 2026-10-25 03:00, then UTC+1.
      expect(nextWeeklyDelivery(new Date('2026-10-19T10:00:00Z'), 3, 'Europe/Paris').toISOString()).toBe(
        '2026-10-21T07:00:00.000Z',
      );
      expect(nextWeeklyDelivery(new Date('2026-10-21T07:00:00Z'), 3, 'Europe/Paris').toISOString()).toBe(
        '2026-10-28T08:00:00.000Z',
      );
    });

    it('computes the weekday in the writer’s zone, not in UTC', () => {
      // 2026-10-19 03:00 UTC is still Sunday evening in Los Angeles (UTC-7).
      expect(
        nextWeeklyDelivery(new Date('2026-10-19T03:00:00Z'), 1, 'America/Los_Angeles').toISOString(),
      ).toBe('2026-10-19T16:00:00.000Z');
    });
  });

  it('dates answers by the writer’s local calendar day', () => {
    expect(localDateIn(new Date('2026-10-19T03:00:00Z'), 'America/Los_Angeles')).toBe('2026-10-18');
    expect(localDateIn(new Date('2026-10-19T23:30:00Z'), 'Asia/Tokyo')).toBe('2026-10-20');
    expect(localDateIn(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
  });
  describe('memoirSnoozeReturnDay', () => {
    it('brings a question back three weeks after the next delivery, on the writer’s day', () => {
      // Tuesday 2026-11-03 in UTC; the next Monday delivery is 2026-11-09
      expect(memoirSnoozeReturnDay(new Date('2026-11-03T12:00:00Z'), 1, 'UTC')).toBe('2026-11-30');
    });

    it('follows Kiritimati (UTC+14) across the week boundary while UTC is still on Sunday', () => {
      // Sunday 18:30 UTC is Monday 08:30 in Kiritimati: this week's delivery is still ahead
      expect(memoirSnoozeReturnDay(new Date('2026-11-01T18:30:00Z'), 1, 'Pacific/Kiritimati')).toBe('2026-11-23');
      // An hour later Monday's 09:00 has passed there, so the question sits out one more week
      expect(memoirSnoozeReturnDay(new Date('2026-11-01T19:30:00Z'), 1, 'Pacific/Kiritimati')).toBe('2026-11-30');
      expect(memoirSnoozeReturnDay(new Date('2026-11-01T19:30:00Z'), 1, 'UTC')).toBe('2026-11-23');
    });

    it('follows Pago Pago (UTC-11) across the week boundary while UTC is already on Monday evening', () => {
      // Monday 19:30 UTC is Monday 08:30 in Pago Pago: its delivery has not happened yet
      expect(memoirSnoozeReturnDay(new Date('2026-11-02T19:30:00Z'), 1, 'Pacific/Pago_Pago')).toBe('2026-11-23');
      expect(memoirSnoozeReturnDay(new Date('2026-11-02T20:30:00Z'), 1, 'Pacific/Pago_Pago')).toBe('2026-11-30');
      expect(memoirSnoozeReturnDay(new Date('2026-11-02T19:30:00Z'), 1, 'UTC')).toBe('2026-11-30');
    });

    it('counts calendar days across a daylight-saving change and a month end', () => {
      // Paris leaves summer time on 2026-10-25, the next Sunday delivery
      expect(memoirSnoozeReturnDay(new Date('2026-10-20T10:00:00Z'), 0, 'Europe/Paris')).toBe('2026-11-15');
    });
  });
});
