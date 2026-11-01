import { isRereadDayAllowed } from './reread-reminder-dates';

describe('reread reminder days', () => {
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
