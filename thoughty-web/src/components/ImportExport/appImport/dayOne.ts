import type { ZipEntry } from '../../../utils/zipReader';
import { attachmentTypeFor, cleanSourceId, cleanTags, fileExtension, localDate } from './appImportMedia';
import type { ImportedEntry, ImportedMedia } from './appImportTypes';

interface DayOneMedia {
  md5?: unknown;
  type?: unknown;
  format?: unknown;
}

interface DayOneEntry {
  uuid?: unknown;
  creationDate?: unknown;
  timeZone?: unknown;
  text?: unknown;
  tags?: unknown;
  starred?: unknown;
  photos?: unknown;
  audios?: unknown;
  videos?: unknown;
  pdfAttachments?: unknown;
}

/** Finds an export file by folder and MD5, e.g. `photos/5f2b…`, whatever its extension. */
export type DayOneMediaLookup = (folder: string, md5: string) => ZipEntry | undefined;

// Each media list in the JSON and the folder its files sit in
const MEDIA_FOLDERS = [
  ['photos', 'photos'],
  ['audios', 'audios'],
  ['videos', 'videos'],
  ['pdfAttachments', 'pdfs'],
] as const;

// Inline references to photos and recordings, which become attachments instead
const MOMENT_REFERENCE = /!\[[^\]]*\]\(dayone-moment:\/*[^)]*\)/g;

export function isDayOneJournal(data: unknown): data is { entries: DayOneEntry[] } {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { entries?: unknown }).entries)) {
    return false;
  }
  const { entries, metadata } = data as { entries: DayOneEntry[]; metadata?: unknown };
  return Boolean(metadata) || entries.length === 0 || typeof entries[0]?.creationDate === 'string';
}

/**
 * Day One escapes punctuation in its Markdown. Drops the escapes that change
 * nothing, keeping those that stop a line from turning into a list, heading,
 * image, or link.
 */
export function unescapeDayOneMarkdown(text: string): string {
  return text.replaceAll(/\\([.!()\-+#])/g, (match, character: string, offset: number) => {
    const before = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);
    switch (character) {
      case '.':
        return /^\s*\d+$/.test(before) ? match : character;
      case '!':
        return text[offset + 2] === '[' ? match : character;
      case '(':
        return before.endsWith(']') ? match : character;
      case ')':
        return character;
      default:
        return before.trim() === '' ? match : character;
    }
  });
}

export function cleanDayOneText(text: string): string {
  return unescapeDayOneMarkdown(text.replaceAll(MOMENT_REFERENCE, ''))
    .replaceAll(/[ \t]+$/gm, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

function entryMedia(entry: DayOneEntry, lookup: DayOneMediaLookup): { media: ImportedMedia[]; skipped: number } {
  const media: ImportedMedia[] = [];
  let skipped = 0;
  for (const [field, folder] of MEDIA_FOLDERS) {
    const items = entry[field];
    if (!Array.isArray(items)) {
      continue;
    }
    for (const item of items as DayOneMedia[]) {
      const file = typeof item?.md5 === 'string' ? lookup(folder, item.md5.toLowerCase()) : undefined;
      const type = file ? attachmentTypeFor(file.name) : null;
      if (!file || !type) {
        skipped++;
        continue;
      }
      media.push({ name: `${item.md5 as string}.${fileExtension(file.name)}`, file, ...type });
    }
  }
  return { media, skipped };
}

/** Entries of one Day One journal; `journal` is the JSON file's name. */
export function parseDayOneJournal(
  data: { entries: DayOneEntry[] },
  journal: string,
  lookup: DayOneMediaLookup,
): { entries: ImportedEntry[]; skippedMedia: number } {
  const entries: ImportedEntry[] = [];
  let skippedMedia = 0;

  for (const entry of data.entries) {
    const timestamp = typeof entry.creationDate === 'string' ? Date.parse(entry.creationDate) : Number.NaN;
    if (Number.isNaN(timestamp)) {
      continue;
    }
    const { media, skipped } = entryMedia(entry, lookup);
    skippedMedia += skipped;
    const sourceId = typeof entry.uuid === 'string' && entry.uuid ? entry.uuid : (entry.creationDate as string);
    entries.push({
      sourceId: cleanSourceId(sourceId),
      date: localDate(timestamp, typeof entry.timeZone === 'string' ? entry.timeZone : undefined),
      timestamp,
      content: typeof entry.text === 'string' ? cleanDayOneText(entry.text) : '',
      tags: cleanTags(entry.tags),
      favorite: entry.starred === true,
      journal,
      media,
    });
  }
  return { entries, skippedMedia };
}
