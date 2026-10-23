import type { ZipEntry } from '../../../utils/zipReader';
import { attachmentTypeFor, cleanSourceId, cleanTags, cleanTitle, fileExtension, localDate, localTime } from './appImportMedia';
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
  title?: unknown;
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

/**
 * Day One shows an entry's first line as its title, and exports a titled entry with that line
 * as a Markdown heading. A heading on the first line becomes the title; other text is kept whole.
 */
export function splitDayOneTitle(text: string): { title?: string; content: string } {
  const match = /^#{1,6}[ \t]+(.+?)[ \t#]*(?:\n|$)/.exec(text);
  const title = match ? cleanTitle(unescapeDayOneMarkdown(match[1] ?? '')) : undefined;
  if (!match || !title) {
    return { content: text };
  }
  return { title, content: text.slice(match[0].length).trim() };
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
    const timeZone = typeof entry.timeZone === 'string' ? entry.timeZone : undefined;
    const text = typeof entry.text === 'string' ? cleanDayOneText(entry.text) : '';
    const explicitTitle = cleanTitle(entry.title);
    const { title, content } = explicitTitle ? { title: explicitTitle, content: text } : splitDayOneTitle(text);
    entries.push({
      sourceId: cleanSourceId(sourceId),
      date: localDate(timestamp, timeZone),
      timeOfDay: localTime(timestamp, timeZone),
      timestamp,
      ...(title ? { title } : {}),
      content,
      tags: cleanTags(entry.tags),
      favorite: entry.starred === true,
      journal,
      media,
    });
  }
  return { entries, skippedMedia };
}
