import { isRereadDayAllowed, isWritersDay } from './reread-reminder-dates';

describe('reread reminder days', () => {
  it('takes the UTC day, or the day before or after it, as the writer’s day', () => {
    const now = new Date('2026-10-31T23:30:00Z');

    expect(isWritersDay('2026-10-31', now)).toBe(true);
    expect(isWritersDay('2026-10-30', now)).toBe(true);
    expect(isWritersDay('2026-11-01', now)).toBe(true);
    expect(isWritersDay('2026-11-02', now)).toBe(false);
    expect(isWritersDay('2026-10-29', now)).toBe(false);
  });

  it('allows a day from tomorrow up to fifty years ahead', () => {
    expect(isRereadDayAllowed('2026-10-31', '2026-10-31')).toBe(false);
    expect(isRereadDayAllowed('2026-11-01', '2026-10-31')).toBe(true);
    expect(isRereadDayAllowed('2076-10-31', '2026-10-31')).toBe(true);
    expect(isRereadDayAllowed('2076-11-01', '2026-10-31')).toBe(false);
    // Fifty years after a 29 February is the 28th
    expect(isRereadDayAllowed('2078-02-28', '2028-02-29')).toBe(true);
    expect(isRereadDayAllowed('2078-03-01', '2028-02-29')).toBe(false);
  });
});
