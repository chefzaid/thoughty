/** Entry titles are one line of at most this many characters. */
export const MAX_ENTRY_TITLE_LENGTH = 200;

interface SameDayOrderable {
  readonly id?: number;
  readonly index?: number;
  readonly time_of_day?: string | null;
}

/**
 * The order of one day's entries, as the server lists them: entries without a time first, in
 * their manual order (`index`), then entries with a time, earliest first. Times never renumber
 * entries, so `[[2024-01-15#2]]` keeps pointing at the same entry whatever times are set.
 */
export function compareSameDayEntries(left: SameDayOrderable, right: SameDayOrderable): number {
  const leftTime = left.time_of_day || null;
  const rightTime = right.time_of_day || null;
  if (leftTime !== rightTime) {
    if (leftTime === null) return -1;
    if (rightTime === null) return 1;
    return leftTime.localeCompare(rightTime);
  }
  return (left.index ?? 0) - (right.index ?? 0);
}

/** Entries without a time keep a manual order, so only they can be dragged. */
export function isManuallyOrdered(entry: SameDayOrderable): boolean {
  return !entry.time_of_day;
}

/**
 * The index each reordered entry gets: the listed entries trade the indexes they already hold,
 * in the new order, as the server does, so the rest of the day keeps its numbers.
 */
export function reassignSameDayIndexes(dayEntries: readonly SameDayOrderable[], orderedIds: readonly number[]): Map<number, number> {
  const byId = new Map(dayEntries.filter((entry) => entry.id !== undefined).map((entry) => [entry.id as number, entry]));
  const listed = [...new Set(orderedIds)].filter((id) => byId.has(id));
  const indexes = listed.map((id) => byId.get(id)?.index ?? 0).sort((left, right) => left - right);
  return new Map(listed.map((id, position) => [id, indexes[position] ?? 0]));
}

/** The current local time as `HH:MM`, for the composer's "Now" shortcut. */
export function currentTimeOfDay(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** `08:30` as the writer's language shows a time of day ("8:30 AM", "08:30"). */
export function formatTimeOfDay(time: string, language = 'en'): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return time;
  }
  try {
    return new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hours, minutes));
  } catch {
    return time;
  }
}

/** A title to send: trimmed, on one line, or null when nothing is left. */
export function cleanEntryTitle(title: string): string | null {
  const cleaned = title.replaceAll(/\s+/g, ' ').trim().slice(0, MAX_ENTRY_TITLE_LENGTH);
  return cleaned || null;
}
