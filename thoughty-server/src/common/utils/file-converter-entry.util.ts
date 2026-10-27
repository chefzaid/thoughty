import { normalizeFeelings, normalizeMood } from './entry-mood.util';

export interface ParsedEntry {
  date: string;
  index: number;
  title?: string;
  timeOfDay?: string;
  mood?: number;
  feelings?: string[];
  tags: string[];
  content: string;
  format: EntryFormat;
  visibility?: EntryVisibility;
  diaryName?: string;
}

export type EntryFormat = 'plain' | 'markdown';
export type EntryVisibility = 'public' | 'private';

export interface EntryData {
  date: string | Date;
  index: number;
  title?: string | null;
  timeOfDay?: string | null;
  mood?: number | null;
  feelings?: string[] | null;
  tags: string[];
  content: string;
  format?: EntryFormat;
  visibility?: EntryVisibility;
  diaryName?: string;
  /** When a sealed time capsule opens; exports write it so the file says the entry is sealed. */
  sealedUntil?: Date | null;
}

/** When a sealed entry opens, as the exports write it (ISO 8601 in UTC), or null for an open entry. */
export function sealedUntilText(entry: Pick<EntryData, 'sealedUntil'>): string | null {
  return entry.sealedUntil ? entry.sealedUntil.toISOString() : null;
}

export function normalizeEntryDate(date: string | Date): string {
  return date instanceof Date
    ? date.toISOString().split('T')[0]
    : String(date).split('T')[0];
}

/**
 * Oldest day first and each day in its numbered order, so importing the file into an empty journal
 * numbers the entries as before and cross-references still point at the same entries. Times are
 * written with each entry and order the day again once it is imported.
 */
export function sortEntries(entries: EntryData[]): EntryData[] {
  return [...entries].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.index - b.index;
  });
}

/** A parsed entry's mood and feelings, only when it has them. */
export function moodFields(mood: unknown, feelings: unknown): Pick<ParsedEntry, 'mood' | 'feelings'> {
  const level = normalizeMood(mood);
  const words = normalizeFeelings(feelings);
  return { ...(level && { mood: level }), ...(words.length > 0 && { feelings: words }) };
}

/**
 * Find potential duplicates between imported entries and existing entries
 */
export function findDuplicates(
  importedEntries: ParsedEntry[],
  existingEntries: EntryData[],
): { imported: ParsedEntry; existing: EntryData }[] {
  const duplicates: { imported: ParsedEntry; existing: EntryData }[] = [];

  for (const imported of importedEntries) {
    for (const existing of existingEntries) {
      const sameDate = imported.date === normalizeEntryDate(existing.date);
      const sameContent = imported.content.trim() === (existing.content || '').trim();

      if (sameDate && sameContent) {
        duplicates.push({ imported, existing });
        break;
      }
    }
  }

  return duplicates;
}
