import { describe, expect, it } from 'vitest';

import {
  addMonths,
  buildCalendarWeeks,
  calendarDate,
  daysInMonth,
  formatCalendarMonth,
  mondayWeekday,
  monthOfDate,
  moveCalendarFocus,
  parseCalendarMonth,
  sameMonth,
} from './calendarMonth';

describe('calendar months', () => {
  it('reads and writes YYYY-MM months', () => {
    expect(parseCalendarMonth('2026-10')).toEqual({ year: 2026, month: 10 });
    expect(parseCalendarMonth('0999-01')).toEqual({ year: 999, month: 1 });
    for (const value of [null, undefined, '', '2026-13', '2026-00', '2026-1', '0000-05', '2026-10-01']) {
      expect(parseCalendarMonth(value)).toBeNull();
    }
    expect(formatCalendarMonth({ year: 999, month: 3 })).toBe('0999-03');
    expect(monthOfDate('2019-07-14')).toEqual({ year: 2019, month: 7 });
    expect(sameMonth({ year: 2019, month: 7 }, { year: 2019, month: 7 })).toBe(true);
    expect(sameMonth({ year: 2019, month: 7 }, { year: 2020, month: 7 })).toBe(false);
  });

  it('moves by months across years, within the years 1 to 9999', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 5 }, -24)).toEqual({ year: 2024, month: 5 });
    expect(addMonths({ year: 1, month: 1 }, -1)).toEqual({ year: 1, month: 1 });
    expect(addMonths({ year: 9999, month: 12 }, 1)).toEqual({ year: 9999, month: 12 });
  });

  it('counts the days of a month, leap years included, and keeps a day within its month', () => {
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(calendarDate({ year: 2026, month: 2 }, 31)).toBe('2026-02-28');
    expect(calendarDate({ year: 2026, month: 10 }, 5)).toBe('2026-10-05');
  });

  it('lays a month out in weeks from Monday to Sunday', () => {
    expect(mondayWeekday('2026-10-05')).toBe(0);
    expect(mondayWeekday('2026-10-04')).toBe(6);
    const october = buildCalendarWeeks({ year: 2026, month: 10 });
    expect(october).toHaveLength(5);
    expect(october[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(october[4]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    // February 2027 starts on a Monday and fills exactly four weeks
    expect(buildCalendarWeeks({ year: 2027, month: 2 })).toHaveLength(4);
  });

  it('moves the focus as the date picker grid pattern does', () => {
    expect(moveCalendarFocus('2026-10-01', 'ArrowLeft')).toBe('2026-09-30');
    expect(moveCalendarFocus('2026-10-31', 'ArrowRight')).toBe('2026-11-01');
    expect(moveCalendarFocus('2026-10-03', 'ArrowUp')).toBe('2026-09-26');
    expect(moveCalendarFocus('2026-10-28', 'ArrowDown')).toBe('2026-11-04');
    expect(moveCalendarFocus('2026-10-01', 'Home')).toBe('2026-09-28');
    expect(moveCalendarFocus('2026-10-01', 'End')).toBe('2026-10-04');
    expect(moveCalendarFocus('2026-03-31', 'PageUp')).toBe('2026-02-28');
    expect(moveCalendarFocus('2026-01-31', 'PageDown')).toBe('2026-02-28');
    expect(moveCalendarFocus('2024-02-29', 'PageDown', true)).toBe('2025-02-28');
    expect(moveCalendarFocus('2026-10-15', 'PageUp', true)).toBe('2025-10-15');
    expect(moveCalendarFocus('2026-10-15', 'Enter')).toBeNull();
  });

  it('does not move the focus out of the years 1 to 9999', () => {
    expect(moveCalendarFocus('0001-01-01', 'ArrowLeft')).toBe('0001-01-01');
    expect(moveCalendarFocus('9999-12-31', 'ArrowDown')).toBe('9999-12-31');
    expect(moveCalendarFocus('0001-01-03', 'Home')).toBe('0001-01-01');
  });
});
