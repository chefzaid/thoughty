/** A life era as books group entries by it. */
export interface BookEra {
  name: string;
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** `YYYY-MM-DD`, or null while the era is still going on. */
  endDate: string | null;
}

/** The chapter of an era book that holds the entries dated outside every era. */
export const OUTSIDE_ERAS_CHAPTER_TITLE = 'Other';

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

/** Whether an era covers the day `date` (`YYYY-MM-DD`), its first and last days included. */
export function eraContains(era: BookEra, date: string): boolean {
  return date >= era.startDate && (era.endDate === null || date <= era.endDate);
}

/**
 * The era an entry dated `date` belongs to when eras overlap: the shortest of those that cover it
 * (an ongoing era lasts until `today`, or the entry's date if later), then the one that started
 * last, then the first by name. Undefined when no era covers the date.
 */
export function mostSpecificEra<T extends BookEra>(eras: readonly T[], date: string, today: string): T | undefined {
  const until = date > today ? date : today;
  const length = (era: T) => dayNumber(era.endDate ?? until) - dayNumber(era.startDate);
  return eras
    .filter((era) => eraContains(era, date))
    .sort((left, right) => length(left) - length(right)
      || right.startDate.localeCompare(left.startDate)
      || left.name.localeCompare(right.name))[0];
}

/** Eras in the order an era book prints them: by start date, then the shorter first, then by name. */
export function compareErasChronologically(left: BookEra, right: BookEra): number {
  return left.startDate.localeCompare(right.startDate)
    || (left.endDate ?? '9999-12-31').localeCompare(right.endDate ?? '9999-12-31')
    || left.name.localeCompare(right.name);
}
