import { inlineImageMarkdown } from '../../../utils/inlineImages';
import { browserTimeZone } from '../../../utils/timeZone';
import type { ZipEntry } from '../../../utils/zipReader';
import { pathHash } from './appImportArchive';
import { attachmentTypeFor, baseName, cleanTags, cleanTitle, localDate, localTime, storedMediaName } from './appImportMedia';
import type { ImportedEntry, ImportedMedia } from './appImportTypes';

/**
 * A note of Google Keep's Takeout (`Takeout/Keep/<name>.json`). Google documents no schema for it, so
 * every field is read defensively: a missing field or one of another type is as if it were absent.
 */
interface KeepNote {
  title?: unknown;
  textContent?: unknown;
  listContent?: unknown;
  labels?: unknown;
  attachments?: unknown;
  isTrashed?: unknown;
  isArchived?: unknown;
  isPinned?: unknown;
  createdTimestampUsec?: unknown;
  userEditedTimestampUsec?: unknown;
}

/** Finds a file a note names (`filePath`) in the note's own folder. */
export type KeepFileLookup = (filePath: string) => ZipEntry | undefined;

/** Why a Keep note did not become an entry. */
export type KeepSkipReason = 'trashed' | 'noDate' | 'empty';

export type ParsedKeepNote =
  | { readonly entry: ImportedEntry; readonly skippedMedia: number }
  | { readonly skipped: KeepSkipReason; readonly skippedMedia: 0 };

// The import reference is `keep:<name>`, within the 100 characters the API takes, with room for `.part<n>`
const READABLE_SOURCE_ID = /^[A-Za-z0-9._-]{1,90}$/;
// The latest time a JavaScript date holds, in milliseconds
const MAX_TIME = 8.64e15;
const NOTE_FIELDS = ['textContent', 'listContent', 'isTrashed', 'createdTimestampUsec', 'userEditedTimestampUsec'];

/** A JSON object with one of the fields only a Keep note has. */
export function isKeepNote(data: unknown): data is KeepNote {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data) && NOTE_FIELDS.some((field) => field in (data as object));
}

/** A time in microseconds since 1970 (Keep writes a number; a numeric string is read too) as milliseconds, or null. */
export function keepTime(usec: unknown): number | null {
  const value = typeof usec === 'string' && /^\d+$/.test(usec) ? Number(usec) : usec;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value / 1000 > MAX_TIME) {
    return null;
  }
  return Math.floor(value / 1000);
}

/**
 * The note's ID for import references (`keep:<name>`): its file name without `.json`, or, when the
 * name has spaces, accents or is long, its day and a hash of the name. Takeout names each file of its
 * Keep folder apart, so either stays the same each time the same Takeout is imported, however it is zipped.
 */
export function keepNoteSourceId(fileName: string, date: string): string {
  const stem = fileName.replace(/\.json$/i, '');
  return READABLE_SOURCE_ID.test(stem) ? stem : `${date}.${pathHash(fileName)}`;
}

function objects(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
}

function plainText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/^\uFEFF/, '').replaceAll(/\r\n?/g, '\n').trim() : '';
}

/** Checklist items as a Markdown task list; an item over several lines continues under its box. */
export function keepChecklist(listContent: unknown): string {
  return objects(listContent)
    .map((item) => ({ text: plainText(item.text), checked: item.isChecked === true }))
    .filter((item) => item.text)
    .map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text.replaceAll('\n', '\n  ')}`)
    .join('\n');
}

/** The note's files: pictures placed at the top of the text, as Keep shows them, other files attached below. */
function noteFiles(attachments: unknown, lookup: KeepFileLookup): { media: ImportedMedia[]; pictures: string[]; skipped: number } {
  const media: ImportedMedia[] = [];
  const pictures: string[] = [];
  let skipped = 0;
  for (const attachment of objects(attachments)) {
    const filePath = typeof attachment.filePath === 'string' ? baseName(attachment.filePath.trim()) : '';
    const file = filePath ? lookup(filePath) : undefined;
    const type = file ? attachmentTypeFor(file.name) : null;
    if (!file || !type) {
      skipped++;
      continue;
    }
    if (media.some((known) => known.file.name === file.name)) {
      continue;
    }
    const imported = { name: baseName(file.name), file, ...type };
    media.push(imported);
    if (type.mimetype.startsWith('image/')) {
      // Keep gives a picture no description
      pictures.push(inlineImageMarkdown(storedMediaName(imported), ''));
    }
  }
  return { media, pictures, skipped };
}

/**
 * One Keep note as a Markdown entry on the day it was created, in the browser's time zone: its title,
 * its pictures inline, its text as written and its checklist as `- [ ]` / `- [x]` items; its labels
 * become tags. A note in the bin, one with no time to date it by, and one with nothing in it are left out.
 * The note's colour is not kept.
 */
export function parseKeepNote(data: KeepNote, fileName: string, lookup: KeepFileLookup): ParsedKeepNote {
  if (data.isTrashed === true) {
    return { skipped: 'trashed', skippedMedia: 0 };
  }
  const timestamp = keepTime(data.createdTimestampUsec) ?? keepTime(data.userEditedTimestampUsec);
  // Keep keeps no zone with a note: the writer's day is the browser's, as everywhere in the app
  const timeZone = browserTimeZone();
  const date = timestamp === null ? '' : localDate(timestamp, timeZone);
  if (timestamp === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { skipped: 'noDate', skippedMedia: 0 };
  }

  const files = noteFiles(data.attachments, lookup);
  const content = [...files.pictures, plainText(data.textContent), keepChecklist(data.listContent)].filter(Boolean).join('\n\n');
  const title = cleanTitle(data.title);
  if (!content && !title && files.media.length === 0) {
    return { skipped: 'empty', skippedMedia: 0 };
  }

  return {
    entry: {
      sourceId: keepNoteSourceId(fileName, date),
      date,
      timeOfDay: localTime(timestamp, timeZone),
      timestamp,
      ...(title ? { title } : {}),
      content,
      tags: cleanTags(objects(data.labels).map((label) => label.name)),
      favorite: false,
      ...(data.isArchived === true ? { archived: true } : {}),
      ...(data.isPinned === true ? { pinned: true } : {}),
      journal: '',
      media: files.media,
    },
    skippedMedia: files.skipped,
  };
}
