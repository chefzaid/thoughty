import type { ZipEntry } from '../../../utils/zipReader';
import { attachmentTypeFor, cleanSourceId, cleanTags, cleanTitle, localDate, localTime } from './appImportMedia';
import type { ImportedEntry, ImportedMedia } from './appImportTypes';
import { htmlToMarkdown, looksLikeHtml } from './htmlToMarkdown';

interface JourneyEntry {
  id?: unknown;
  date_journal?: unknown;
  timezone?: unknown;
  title?: unknown;
  text?: unknown;
  type?: unknown;
  tags?: unknown;
  favourite?: unknown;
  photos?: unknown;
  mood?: unknown;
}

/** Finds a photo by file name anywhere in the export. */
export type JourneyMediaLookup = (fileName: string) => ZipEntry | undefined;

export const JOURNEY_JOURNAL = 'Journey';

export function isJourneyEntry(data: unknown): data is JourneyEntry {
  return Boolean(data) && typeof data === 'object'
    && typeof (data as JourneyEntry).date_journal === 'number'
    && typeof (data as JourneyEntry).text === 'string';
}

/**
 * Journey stores its mood as a number, 0 when none was chosen; only the levels of Thoughty's own
 * scale, 1 to 5, are kept. The `sentiment` Journey computes itself is not a mood the writer chose.
 */
export function journeyMood(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5 ? value : undefined;
}

/** One entry from its JSON file; `fallbackId` is the file name, for entries without an ID. */
export function parseJourneyEntry(
  data: JourneyEntry,
  fallbackId: string,
  lookup: JourneyMediaLookup,
): { entry: ImportedEntry; skippedMedia: number } {
  const timestamp = data.date_journal as number;
  const timeZone = typeof data.timezone === 'string' ? data.timezone : undefined;
  const title = cleanTitle(data.title);
  const mood = journeyMood(data.mood);
  const text = data.text as string;
  const media: ImportedMedia[] = [];
  let skippedMedia = 0;

  for (const name of Array.isArray(data.photos) ? data.photos : []) {
    const file = typeof name === 'string' ? lookup(name.toLowerCase()) : undefined;
    const type = file ? attachmentTypeFor(file.name) : null;
    if (!file || !type) {
      skippedMedia++;
      continue;
    }
    media.push({ name: name as string, file, ...type });
  }

  return {
    entry: {
      sourceId: cleanSourceId(typeof data.id === 'string' && data.id ? data.id : fallbackId),
      date: localDate(timestamp, timeZone),
      timeOfDay: localTime(timestamp, timeZone),
      timestamp,
      ...(title ? { title } : {}),
      ...(mood ? { mood } : {}),
      content: data.type === 'html' || looksLikeHtml(text) ? htmlToMarkdown(text) : text.trim(),
      tags: cleanTags(data.tags),
      favorite: data.favourite === true,
      journal: JOURNEY_JOURNAL,
      media,
    },
    skippedMedia,
  };
}
