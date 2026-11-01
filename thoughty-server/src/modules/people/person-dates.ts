import { BadRequestException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { dayParts, utcDay } from '@/common/utils/writers-day.util';
import type { PersonDateKind } from '@/database/entities/person.entity';

/** The earliest year a date on a person can have: four digits, so a year typed as `86` is refused, not kept. */
export const PERSON_DATE_MIN_YEAR = 1000;

/** UTC+14 (Kiritimati), the time zone furthest ahead: no writer's day is later than the UTC day at `now` plus this. */
const LATEST_OFFSET_MS = 14 * 60 * 60 * 1000;

export interface PersonDateParts {
  /** 1 to 12. */
  month: number;
  day: number;
  year?: number | null;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** The days `month` has in `year`; 29 for February when the year is not known, since it may have been a leap year. */
export function daysInMonth(month: number, year: number | null): number {
  if (month === 2) {
    return year === null || isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Refuses a date on a person that cannot be: a month outside 1 to 12 or a day the month never has
 * (`PERSON_DATE_INVALID`, 29 February too when the year given had none), a year before 1000
 * (`PERSON_DATE_YEAR_INVALID`), or, with the year, a day that has not come yet anywhere on Earth
 * (`PERSON_DATE_IN_FUTURE`). Without the year any real month and day is taken, 29 February included.
 */
export function assertValidPersonDate({ month, day, year = null }: PersonDateParts, now = new Date()): void {
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month, year)) {
    throw apiError(BadRequestException, 'PERSON_DATE_INVALID');
  }
  if (year === null) {
    return;
  }
  if (year < PERSON_DATE_MIN_YEAR) {
    throw apiError(BadRequestException, 'PERSON_DATE_YEAR_INVALID');
  }
  const latestDay = utcDay(new Date(now.getTime() + LATEST_OFFSET_MS));
  if (`${year}-${pad(month)}-${pad(day)}` > latestDay) {
    throw apiError(BadRequestException, 'PERSON_DATE_IN_FUTURE');
  }
}

/**
 * The month and day pairs whose people Highlights shows on the writer's day `today` (`YYYY-MM-DD`): the day
 * itself and, on 28 February of a year without a 29th, the people whose date is 29 February.
 */
export function personDateDaysOn(today: string): Array<{ month: number; day: number }> {
  const { year, month, day } = dayParts(today);
  const days = [{ month, day }];
  if (month === 2 && day === 28 && !isLeapYear(year)) {
    days.push({ month: 2, day: 29 });
  }
  return days;
}

/** How many years old a person is, or how many years an anniversary marks, on the writer's day; null without the year. */
export function yearsOn(year: number | null, today: string): number | null {
  return year === null ? null : dayParts(today).year - year;
}

/** A person's date as the database returns it (a driver may read a `SMALLINT` as text). */
export interface PersonDateColumns {
  dateKind: PersonDateKind | null;
  dateMonth: number | string | null;
  dateDay: number | string | null;
  dateYear: number | string | null;
}

/** A person's date as the API shows it, or null when none is set. */
export function toPersonDate(row: PersonDateColumns): { kind: PersonDateKind; month: number; day: number; year: number | null } | null {
  if (row.dateKind === null || row.dateMonth === null || row.dateDay === null) {
    return null;
  }
  return { kind: row.dateKind, month: Number(row.dateMonth), day: Number(row.dateDay), year: row.dateYear === null ? null : Number(row.dateYear) };
}
