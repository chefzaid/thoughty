import { BadRequestException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { assertValidPersonDate, daysInMonth, isLeapYear, personDateDaysOn, toPersonDate, yearsOn } from './person-dates';

describe('person dates', () => {
  const now = new Date('2026-10-31T10:30:00Z');
  const check = (month: number, day: number, year?: number | null) => () => assertValidPersonDate({ month, day, year }, now);

  it('knows the leap years and the days of each month, February having 29 when the year is not known', () => {
    expect([2024, 2000, 2023, 1900].map(isLeapYear)).toEqual([true, true, false, false]);
    expect([1, 4, 6, 9, 11, 12].map((month) => daysInMonth(month, 2026))).toEqual([31, 30, 30, 30, 30, 31]);
    expect([daysInMonth(2, null), daysInMonth(2, 2024), daysInMonth(2, 2023)]).toEqual([29, 29, 28]);
  });

  it('takes any real day, 29 February without a year or in a leap year', () => {
    for (const [month, day, year] of [[1, 1, null], [12, 31, 1990], [2, 29, null], [2, 29, 2000], [4, 30, 1000]] as const) {
      expect(check(month, day, year)).not.toThrow();
    }
    expect(check(3, 14)).not.toThrow();
  });

  it('refuses a day the month never has, or 29 February in a year that had none', () => {
    for (const [month, day, year] of [[0, 1, null], [13, 1, null], [1, 0, null], [1, 32, null], [4, 31, null], [2, 30, null], [2, 29, 2023], [2, 29, 1900]] as const) {
      expect(() => check(month, day, year)()).toThrow(BadRequestException);
    }
    return expectApiError(Promise.resolve().then(check(2, 29, 2023)), BadRequestException, 'PERSON_DATE_INVALID');
  });

  it('refuses a year before 1000 and a day still to come everywhere on Earth', async () => {
    await expectApiError(Promise.resolve().then(check(3, 14, 999)), BadRequestException, 'PERSON_DATE_YEAR_INVALID');
    // 10:30 UTC on 31 October is already 00:30 on 1 November in Kiritimati (UTC+14)
    expect(check(11, 1, 2026)).not.toThrow();
    await expectApiError(Promise.resolve().then(check(11, 2, 2026)), BadRequestException, 'PERSON_DATE_IN_FUTURE');
    await expectApiError(Promise.resolve().then(check(1, 1, 2027)), BadRequestException, 'PERSON_DATE_IN_FUTURE');
  });

  it('shows 29 February dates on 28 February in a year without a 29th', () => {
    expect(personDateDaysOn('2026-02-28')).toEqual([{ month: 2, day: 28 }, { month: 2, day: 29 }]);
    expect(personDateDaysOn('2028-02-28')).toEqual([{ month: 2, day: 28 }]);
    expect(personDateDaysOn('2028-02-29')).toEqual([{ month: 2, day: 29 }]);
    expect(personDateDaysOn('2026-03-01')).toEqual([{ month: 3, day: 1 }]);
  });

  it('counts the years from the writer’s year, or none without the year', () => {
    expect(yearsOn(1992, '2026-03-14')).toBe(34);
    expect(yearsOn(2026, '2026-03-14')).toBe(0);
    expect(yearsOn(null, '2026-03-14')).toBeNull();
  });

  it('reads a date from its columns, as numbers, or null when none is set', () => {
    expect(toPersonDate({ dateKind: 'birthday', dateMonth: '3', dateDay: '14', dateYear: '1992' })).toEqual({ kind: 'birthday', month: 3, day: 14, year: 1992 });
    expect(toPersonDate({ dateKind: 'anniversary', dateMonth: 6, dateDay: 1, dateYear: null })).toEqual({ kind: 'anniversary', month: 6, day: 1, year: null });
    expect(toPersonDate({ dateKind: null, dateMonth: null, dateDay: null, dateYear: null })).toBeNull();
  });
});
