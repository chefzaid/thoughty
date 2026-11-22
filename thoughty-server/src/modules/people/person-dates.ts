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

/** The latest day (`YYYY-MM-DD`) any writer can be living at `now`: the day in Kiritimati (UTC+14). */
export function latestDayOnEarth(now: Date): string {
  return utcDay(new Date(now.getTime() + LATEST_OFFSET_MS));
}

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
  if (`${year}-${pad(month)}-${pad(day)}` > latestDayOnEarth(now)) {
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

/** The most important dates a save keeps on a person; merging two people may leave more. */
export const PERSON_DATES_MAX = 10;
/** The longest label (what a date marks) a save keeps. */
export const PERSON_DATE_LABEL_MAX_LENGTH = 40;

/** A person's date as the API shows it. */
export interface PersonDateValue {
  kind: PersonDateKind;
  label: string | null;
  month: number;
  day: number;
  year: number | null;
}

/** A person's date as the database returns it (a driver may read a `SMALLINT` as text). */
export interface PersonDateColumns {
  kind: PersonDateKind;
  label: string | null;
  month: number | string;
  day: number | string;
  year: number | string | null;
}

/** The order a person's dates are listed in: through the year, a birthday before an anniversary on the same day. */
export const PERSON_DATES_ORDER_SQL = (alias: string) => `${alias}.month, ${alias}.day, ${alias}.kind <> 'birthday', ${alias}.id`;

/** A JSON array of the dates of person `p` in their order, empty when they have none. */
export const PERSON_DATES_JSON_SQL = `COALESCE((
  SELECT json_agg(json_build_object('kind', d.kind, 'label', d.label, 'month', d.month, 'day', d.day, 'year', d.year)
                  ORDER BY ${PERSON_DATES_ORDER_SQL('d')})
    FROM person_dates d WHERE d.person_id = p.id), '[]'::json)`;

export function toPersonDate(row: PersonDateColumns): PersonDateValue {
  return { kind: row.kind, label: row.label, month: Number(row.month), day: Number(row.day), year: row.year === null ? null : Number(row.year) };
}

/** Refuses dates that give a person more than one birthday (`PERSON_DATE_BIRTHDAY_TWICE`), then each impossible one. */
export function assertValidPersonDates(dates: ReadonlyArray<PersonDateParts & { kind: PersonDateKind }>, now = new Date()): void {
  if (dates.filter((date) => date.kind === 'birthday').length > 1) {
    throw apiError(BadRequestException, 'PERSON_DATE_BIRTHDAY_TWICE');
  }
  for (const date of dates) {
    assertValidPersonDate(date, now);
  }
}
