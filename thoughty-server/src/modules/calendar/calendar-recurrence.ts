/**
 * Repeating calendar events: reading an `RRULE` (RFC 5545 §3.3.10) and listing the days it repeats on.
 * Daily, weekly, monthly and yearly rules are followed, with `INTERVAL`, `COUNT`, `BYDAY` (with an
 * ordinal such as `-1FR` in monthly and yearly rules), `BYMONTHDAY`, `BYMONTH`, `BYSETPOS` and `WKST`.
 * Rules that repeat within a day (`HOURLY`, `BYHOUR`…) or by year day or week number are not read.
 */

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** A `BYDAY` value: a weekday (0 = Sunday) and, in monthly and yearly rules, its rank (1 = first, -1 = last). */
export interface RecurrenceWeekday {
  weekday: number;
  ordinal?: number;
}

export interface RecurrenceRule {
  freq: RecurrenceFrequency;
  interval: number;
  /** How many times the event happens, its first day included. */
  count?: number;
  byDay?: RecurrenceWeekday[];
  byMonthDay?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  /** The first day of the week (0 = Sunday), Monday unless the rule says otherwise. */
  weekStart: number;
}

/**
 * How an imported event repeats, kept with it: its rule, last occurrence, extra and removed
 * occurrences. Days are `YYYY-MM-DD` for an all-day event; a timed event's are instants (ISO 8601),
 * or a day for every occurrence starting on it.
 */
export interface EventRecurrence {
  rule: RecurrenceRule | null;
  /** The last day an all-day event can repeat on, or the last instant a timed one can start at. */
  until: string | null;
  rdates: string[];
  exdates: string[];
  /** The zone whose wall clock a timed event repeats in. */
  timeZone: string;
}

/** An `RRULE` with its `UNTIL` as written, to be read as a day or an instant by the event. */
export interface ParsedRrule {
  rule: RecurrenceRule;
  until: string | null;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const FREQUENCIES: readonly RecurrenceFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const MAX_INTERVAL = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Periods a rule with a `COUNT` is followed for from its first day, so a rule that never matches still ends. */
const MAX_COUNTED_PERIODS = 100_000;

/** An integer from `min` to `max` that is not 0, or null. */
function readInteger(value: string, min: number, max: number): number | null {
  if (!/^[+-]?\d{1,6}$/.test(value)) return null;
  const number = Number(value);
  return number !== 0 && number >= min && number <= max ? number : null;
}

function readList(value: string, min: number, max: number): number[] | null {
  const numbers = value.split(',').map((part) => readInteger(part.trim(), min, max));
  return numbers.every((number): number is number => number !== null) ? numbers : null;
}

function readWeekdays(value: string, ranked: boolean): RecurrenceWeekday[] | null {
  const days: RecurrenceWeekday[] = [];
  for (const part of value.split(',')) {
    const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(part.trim());
    if (!match) return null;
    const weekday = WEEKDAYS.indexOf(match[2]);
    if (match[1] === undefined) {
      days.push({ weekday });
      continue;
    }
    const ordinal = readInteger(match[1], -53, 53);
    if (ordinal === null || !ranked) return null;
    days.push({ weekday, ordinal });
  }
  return days;
}

/** Sets one rule part on the rule; false when its value is not one this reader follows. */
function readPart(rule: RecurrenceRule, key: string, value: string): boolean {
  const ranked = rule.freq === 'MONTHLY' || rule.freq === 'YEARLY';
  switch (key) {
    case 'INTERVAL': {
      const interval = readInteger(value, 1, MAX_INTERVAL);
      if (interval !== null) rule.interval = interval;
      return interval !== null;
    }
    case 'COUNT':
      rule.count = readInteger(value, 1, 999_999) ?? undefined;
      return rule.count !== undefined;
    case 'BYDAY':
      rule.byDay = readWeekdays(value, ranked) ?? undefined;
      return rule.byDay !== undefined;
    case 'BYMONTHDAY':
      rule.byMonthDay = readList(value, -31, 31) ?? undefined;
      return rule.byMonthDay !== undefined;
    case 'BYMONTH':
      rule.byMonth = readList(value, 1, 12) ?? undefined;
      return rule.byMonth !== undefined;
    case 'BYSETPOS':
      rule.bySetPos = readList(value, -366, 366) ?? undefined;
      return rule.bySetPos !== undefined;
    case 'WKST':
      rule.weekStart = WEEKDAYS.indexOf(value);
      return rule.weekStart !== -1;
    default:
      return false;
  }
}

/** Reads an `RRULE` value, or null for a rule this reader does not follow. */
export function parseRrule(value: string): ParsedRrule | null {
  const parts = new Map<string, string>();
  for (const part of value.trim().toUpperCase().split(';').filter(Boolean)) {
    const [key, ...rest] = part.split('=');
    if (parts.has(key.trim()) || rest.length === 0) return null;
    parts.set(key.trim(), rest.join('=').trim());
  }
  const freq = FREQUENCIES.find((candidate) => candidate === parts.get('FREQ'));
  if (!freq) return null;
  const rule: RecurrenceRule = { freq, interval: 1, weekStart: 1 };
  for (const [key, part] of parts) {
    if (key !== 'FREQ' && key !== 'UNTIL' && !readPart(rule, key, part)) return null;
  }
  return { rule, until: parts.get('UNTIL') ?? null };
}

interface Civil {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  weekday: number;
}

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const dayText = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const firstDayOf = (year: number, month: number) => Math.round(Date.UTC(year, month - 1, 1) / DAY_MS);

function civil(day: number): Civil {
  const date = new Date(day * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: date.getUTCDay() };
}

/** The rule's implied parts (RFC 5545): a weekly rule repeats on its first day's weekday, and so on. */
function withDefaults(rule: RecurrenceRule, first: Civil): RecurrenceRule {
  const filled = { ...rule };
  if (rule.freq === 'WEEKLY' && !rule.byDay) filled.byDay = [{ weekday: first.weekday }];
  if ((rule.freq === 'MONTHLY' || rule.freq === 'YEARLY') && !rule.byDay && !rule.byMonthDay) {
    filled.byMonthDay = [first.day];
    if (rule.freq === 'YEARLY' && !rule.byMonth) filled.byMonth = [first.month];
  }
  return filled;
}

/** Whether `day` is the `ordinal`-th (or from the end, when negative) of its weekday within the days `[start, start + length)`. */
function hasRank(day: number, start: number, length: number, ordinal: number): boolean {
  return ordinal > 0 ? Math.floor((day - start) / 7) + 1 === ordinal : -(Math.floor((start + length - 1 - day) / 7) + 1) === ordinal;
}

function matches(rule: RecurrenceRule, day: number): boolean {
  const date = civil(day);
  const monthLength = daysIn(date.year, date.month);
  if (rule.byMonth && !rule.byMonth.includes(date.month)) return false;
  if (rule.byMonthDay && !rule.byMonthDay.some((monthDay) => (monthDay > 0 ? monthDay : monthLength + monthDay + 1) === date.day)) {
    return false;
  }
  if (!rule.byDay) return true;
  const inYear = rule.freq === 'YEARLY' && !rule.byMonth;
  const scopeStart = inYear ? firstDayOf(date.year, 1) : firstDayOf(date.year, date.month);
  const scopeLength = inYear ? firstDayOf(date.year + 1, 1) - scopeStart : monthLength;
  return rule.byDay.some(({ weekday, ordinal }) =>
    weekday === date.weekday && (ordinal === undefined || hasRank(day, scopeStart, scopeLength, ordinal)));
}

/** The days `[start, end)` of the rule's `index`-th period from the first day. */
function period(rule: RecurrenceRule, first: number, firstDate: Civil, index: number): [number, number] {
  const step = index * rule.interval;
  switch (rule.freq) {
    case 'DAILY':
      return [first + step, first + step + 1];
    case 'WEEKLY': {
      const start = first - ((firstDate.weekday - rule.weekStart + 7) % 7) + 7 * step;
      return [start, start + 7];
    }
    case 'MONTHLY': {
      const month = firstDate.year * 12 + firstDate.month - 1 + step;
      const year = Math.floor(month / 12);
      return [firstDayOf(year, (month % 12) + 1), firstDayOf(year, (month % 12) + 2)];
    }
    default:
      return [firstDayOf(firstDate.year + step, 1), firstDayOf(firstDate.year + step + 1, 1)];
  }
}

/** The index of the period that holds `day` (or the last one before it). */
function periodIndexAt(rule: RecurrenceRule, first: number, firstDate: Civil, day: number): number {
  const date = civil(day);
  switch (rule.freq) {
    case 'DAILY':
      return Math.floor((day - first) / rule.interval);
    case 'WEEKLY':
      return Math.floor((day - period(rule, first, firstDate, 0)[0]) / (7 * rule.interval));
    case 'MONTHLY':
      return Math.floor(((date.year - firstDate.year) * 12 + date.month - firstDate.month) / rule.interval);
    default:
      return Math.floor((date.year - firstDate.year) / rule.interval);
  }
}

/** The period's days the rule picks, then those `BYSETPOS` keeps among them. */
function periodDays(rule: RecurrenceRule, [start, end]: [number, number]): number[] {
  const days: number[] = [];
  for (let day = start; day < end; day += 1) {
    if (matches(rule, day)) days.push(day);
  }
  if (!rule.bySetPos) return days;
  return days.filter((_day, index) => rule.bySetPos?.some((position) => (position > 0 ? position - 1 : days.length + position) === index));
}

/**
 * The days (`YYYY-MM-DD`) from `from` to `to`, both included, that a rule starting on `first` repeats
 * on. The first day always counts as the first occurrence, as RFC 5545 has it, even off the rule.
 */
export function repeatDays(rule: RecurrenceRule, first: string, from: string, to: string): string[] {
  const firstDay = dayNumber(first);
  const fromDay = dayNumber(from);
  const toDay = dayNumber(to);
  const firstDate = civil(firstDay);
  const filled = withDefaults(rule, firstDate);
  const found = firstDay >= fromDay && firstDay <= toDay ? [first] : [];
  const counted = rule.count !== undefined;
  let occurrences = 1;
  const startIndex = counted ? 0 : Math.max(0, periodIndexAt(filled, firstDay, firstDate, fromDay));
  for (let index = startIndex; !counted || index < MAX_COUNTED_PERIODS; index += 1) {
    const range = period(filled, firstDay, firstDate, index);
    if (range[0] > toDay) break;
    for (const day of periodDays(filled, range)) {
      if (day <= firstDay) continue;
      occurrences += 1;
      if ((counted && occurrences > (rule.count ?? 0)) || day > toDay) return found;
      if (day >= fromDay) found.push(dayText(day));
    }
  }
  return found;
}
