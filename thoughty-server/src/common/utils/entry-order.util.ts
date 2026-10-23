import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** Longest title an entry can have; titles are one line. */
export const MAX_ENTRY_TITLE_LENGTH = 200;

/** `HH:MM` on a 24-hour clock. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A title with its spaces trimmed and line breaks folded, or null when nothing is left. */
export function normalizeEntryTitle(title?: string | null): string | null {
  const cleaned = (title ?? '').replaceAll(/\s+/g, ' ').trim().slice(0, MAX_ENTRY_TITLE_LENGTH);
  return cleaned || null;
}

/** `08:30` from `08:30`, `8:30`, or `08:30:15`, or null when it is not a time of day. */
export function normalizeTimeOfDay(time?: string | null): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec((time ?? '').trim());
  if (!match) {
    return null;
  }
  const normalized = `${match[1].padStart(2, '0')}:${match[2]}`;
  return TIME_OF_DAY_PATTERN.test(normalized) ? normalized : null;
}

export interface SameDayOrderable {
  index: number;
  timeOfDay?: string | null;
}

/**
 * Order of the entries of one day: entries without a time first, in their manual order (`index`),
 * then entries with a time, earliest first. The order never renumbers entries, so the same-day
 * index that cross-references point at stays the same whatever times are set.
 */
export function compareSameDayEntries(left: SameDayOrderable, right: SameDayOrderable): number {
  const leftTime = left.timeOfDay ?? null;
  const rightTime = right.timeOfDay ?? null;
  if (leftTime !== rightTime) {
    if (leftTime === null) return -1;
    if (rightTime === null) return 1;
    return leftTime.localeCompare(rightTime);
  }
  return left.index - right.index;
}

/** Adds the same-day order (see `compareSameDayEntries`) after the query's date order. */
export function addSameDayOrder<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string): SelectQueryBuilder<T> {
  return qb.addOrderBy(`${alias}.timeOfDay`, 'ASC', 'NULLS FIRST').addOrderBy(`${alias}.index`, 'ASC');
}
