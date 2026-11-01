/** The mood a writer records on a very low day, the lowest of the 1 to 5 scale. */
export const VERY_LOW_MOOD = 1;

const OFFERED_STORAGE_PREFIX = 'thoughty.comfortReadsOfferedOn.';

/** The entry the composer just saved, as the offer needs it. A new object for every save. */
export interface SavedEntry {
  readonly id: number;
  readonly mood: number | null;
}

/** Whether a save calls for the offer: a very low mood, with the setting on. */
export function callsForComfortReads(saved: SavedEntry | null, enabled: boolean): saved is SavedEntry {
  return enabled && saved?.mood === VERY_LOW_MOOD;
}

/**
 * Whether the offer was already shown to this writer on this day (`YYYY-MM-DD`) on this device. False when
 * storage is unavailable, so the offer can still appear.
 */
export function wasOfferedOn(userId: number, day: string): boolean {
  try {
    return globalThis.localStorage?.getItem(`${OFFERED_STORAGE_PREFIX}${userId}`) === day;
  } catch {
    return false;
  }
}

/** Remembers that the offer was shown today, so it waits for another day. */
export function markOfferedOn(userId: number, day: string): void {
  try {
    globalThis.localStorage?.setItem(`${OFFERED_STORAGE_PREFIX}${userId}`, day);
  } catch {
    // Remembering is a convenience; the offer still shows only once in this visit.
  }
}
