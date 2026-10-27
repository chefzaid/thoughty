/** A calendar month: `month` runs from 1 (January) to 12. */
export interface CalendarMonth {
  readonly year: number;
  readonly month: number;
}

const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** A `YYYY-MM` value, as the journal URL and the API write a month; null for anything else. */
export function parseCalendarMonth(value: string | null | undefined): CalendarMonth | null {
  const match = value ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value) : null;
  if (!match) return null;
  const year = Number(match[1]);
  return year >= MIN_YEAR ? { year, month: Number(match[2]) } : null;
}

export function formatCalendarMonth({ year, month }: CalendarMonth): string {
  return `${pad(year, 4)}-${pad(month)}`;
}

/** The month of a `YYYY-MM-DD` date. */
export function monthOfDate(date: string): CalendarMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

export function sameMonth(left: CalendarMonth, right: CalendarMonth): boolean {
  return left.year === right.year && left.month === right.month;
}

/** The month `count` months later (or earlier, when negative), kept within the years 1 to 9999. */
export function addMonths({ year, month }: CalendarMonth, count: number): CalendarMonth {
  const total = Math.min(MAX_YEAR * 12 + 11, Math.max(MIN_YEAR * 12, year * 12 + (month - 1) + count));
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function daysInMonth({ year, month }: CalendarMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day `day` of the month as `YYYY-MM-DD`, moved back to the month's last day when it has fewer. */
export function calendarDate(calendarMonth: CalendarMonth, day: number): string {
  return `${formatCalendarMonth(calendarMonth)}-${pad(Math.min(day, daysInMonth(calendarMonth)))}`;
}

function toUtc(date: string): Date {
  const utc = new Date(Date.UTC(2000, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))));
  utc.setUTCFullYear(Number(date.slice(0, 4)));
  return utc;
}

function fromUtc(utc: Date): string {
  return `${pad(utc.getUTCFullYear(), 4)}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

/** Days from Monday (0) to Sunday (6). */
export function mondayWeekday(date: string): number {
  return (toUtc(date).getUTCDay() + 6) % 7;
}

/** The weeks of the month from Monday to Sunday, each day as its date, or null outside the month. */
export function buildCalendarWeeks(calendarMonth: CalendarMonth): (string | null)[][] {
  const leading = mondayWeekday(calendarDate(calendarMonth, 1));
  const days: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth(calendarMonth) }, (_, index) => calendarDate(calendarMonth, index + 1)),
  ];
  while (days.length % 7 !== 0) days.push(null);
  return Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7));
}

function shiftDays(date: string, count: number): string {
  return fromUtc(new Date(toUtc(date).getTime() + count * DAY_MS));
}

function shiftMonths(date: string, count: number): string {
  return calendarDate(addMonths(monthOfDate(date), count), Number(date.slice(8, 10)));
}

/**
 * The day the focus moves to for a key of the month grid, as the date picker pattern has it: arrows by
 * a day or a week, Home and End to the week's Monday and Sunday, Page Up and Page Down by a month, and
 * by a year with Shift. Null for any other key.
 */
export function moveCalendarFocus(date: string, key: string, shiftKey = false): string | null {
  const next = focusTarget(date, key, shiftKey);
  if (next === null) return null;
  const year = Number(next.split('-')[0]);
  return year >= MIN_YEAR && year <= MAX_YEAR ? next : date;
}

function focusTarget(date: string, key: string, shiftKey: boolean): string | null {
  switch (key) {
    case 'ArrowLeft': return shiftDays(date, -1);
    case 'ArrowRight': return shiftDays(date, 1);
    case 'ArrowUp': return shiftDays(date, -7);
    case 'ArrowDown': return shiftDays(date, 7);
    case 'Home': return shiftDays(date, -mondayWeekday(date));
    case 'End': return shiftDays(date, 6 - mondayWeekday(date));
    case 'PageUp': return shiftMonths(date, shiftKey ? -12 : -1);
    case 'PageDown': return shiftMonths(date, shiftKey ? 12 : 1);
    default: return null;
  }
}
