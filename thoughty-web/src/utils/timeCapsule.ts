import { formatEntryDate } from './entryDate';
import type { Language } from './translations';

/** How far ahead a capsule can be sealed for, as the API allows. */
export const MAX_TIME_CAPSULE_YEARS = 50;
/** The hour a capsule opens at unless the writer picks another. */
export const DEFAULT_TIME_CAPSULE_HOUR = 9;

/** A time capsule being set up in the composer: the local day it opens on and the hour. */
export interface TimeCapsuleDraft {
  opensOn: string;
  openHour: number;
}

/** The same calendar day `years` later on the local clock (the 28th for a 29 February). */
function yearsAfter(today: Date, years: number): Date {
  const later = new Date(today.getFullYear() + years, today.getMonth(), today.getDate());
  if (later.getMonth() !== today.getMonth()) later.setDate(0);
  return later;
}

/** The first and last days a capsule sealed today can open on: tomorrow, and fifty years ahead. */
export function timeCapsuleDateBounds(today: Date): { min: string; max: string } {
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return { min: formatEntryDate(tomorrow), max: formatEntryDate(yearsAfter(today, MAX_TIME_CAPSULE_YEARS)) };
}

/** A new capsule opens a year from today at 9:00, unless a template asks for more years. */
export function defaultTimeCapsule(today: Date, years = 1): TimeCapsuleDraft {
  return { opensOn: formatEntryDate(yearsAfter(today, years)), openHour: DEFAULT_TIME_CAPSULE_HOUR };
}

/** Whether the draft's day is one the API accepts. */
export function isValidTimeCapsuleDate(opensOn: string, today: Date): boolean {
  const { min, max } = timeCapsuleDateBounds(today);
  return /^\d{4}-\d{2}-\d{2}$/.test(opensOn) && opensOn >= min && opensOn <= max;
}

/** The IANA time zone of the writer's clock, which the capsule opens in. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** When a capsule opens, as the reader's language writes a date and time ("27 October 2031 at 09:00"). */
export function formatTimeCapsuleMoment(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

/** A day the capsule was sealed on, in the reader's language. */
export function formatTimeCapsuleDay(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(iso));
}

/** Whether an entry is a time capsule that is still sealed. */
export function isSealedEntry(entry: { sealed_until?: string | null }): boolean {
  return Boolean(entry.sealed_until);
}
