import { readZipEntries, readZipText, safeZipPath, ZipLimitError, type ZipEntry } from '../../../utils/zipReader';
import type { AppExport, ImportedEntry, SkippedNotes } from './appImportTypes';
import { dailyNoteDate, parseDailyNote, type DailyNoteFiles } from './dailyNotes';

// An archive past these is refused before anything is unpacked (see docs/security.md)
export const MAX_DAILY_NOTES_ARCHIVE_FILES = 50_000;
const MAX_DIRECTORY_BYTES = 32 * 1024 * 1024;
/** A note over the size of a text import is left out. */
export const MAX_DAILY_NOTE_BYTES = 5 * 1024 * 1024;
/** What all the notes may unpack to, as the archive declares it (each file is held to its declared size). */
export const MAX_DAILY_NOTES_BYTES = 200 * 1024 * 1024;
const NOTE_READ_CONCURRENCY = 8;
// The import reference is `daily-notes:<path>`, within the 100 characters the API takes, with room for `.part<n>`
const READABLE_SOURCE_ID = /^[A-Za-z0-9._/-]{1,90}$/;

/** The archive holds more than the import reads at once. */
export class ExportTooLargeError extends Error {}

/** No Markdown file of the archive is named by a day. */
export class NoDailyNotesError extends Error {}

interface ArchiveFile {
  readonly entry: ZipEntry;
  readonly path: string[];
}

interface DatedNote extends ArchiveFile {
  readonly date: string;
}

/** Folders the writer never sees: `.obsidian`, `.trash`, `.git`, and the Finder's `__MACOSX` copies. */
function isHidden(name: string): boolean {
  return name.split('/').some((segment) => /^\.[^.]/.test(segment) || segment === '__MACOSX');
}

function isMarkdown(name: string): boolean {
  return name.toLowerCase().endsWith('.md');
}

/** FNV-1a, 64 bits: a short, stable name for a path the API would not take as it is. */
function pathHash(path: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(path)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * The note's ID for import references (`daily-notes:<path>`): its path in the archive, or, when the
 * path has spaces, accents or is long, its day and a hash of the path. Either stays the same each
 * time the same archive is imported.
 */
export function dailyNoteSourceId(path: string, date: string): string {
  return READABLE_SOURCE_ID.test(path) ? path : `${date}.${pathHash(path)}`;
}

/** Resolves embedded files the way Obsidian and Logseq do, among the archive's safe files only. */
function fileFinder(files: ArchiveFile[]): DailyNoteFiles {
  const byPath = new Map<string, ZipEntry>();
  const byName = new Map<string, ArchiveFile[]>();
  for (const file of files) {
    const key = file.path.join('/').toLowerCase();
    byPath.set(key, file.entry);
    const name = file.path.at(-1)!.toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), file]);
  }
  const ending = (path: string[]): ZipEntry | undefined => {
    const suffix = path.join('/').toLowerCase();
    return byName.get(path.at(-1)!.toLowerCase())
      ?.find((file) => `/${file.path.join('/').toLowerCase()}`.endsWith(`/${suffix}`))?.entry;
  };
  const resolve = (from: readonly string[], path: string): string[] | null => {
    const segments = [...from];
    for (const segment of path.split('/')) {
      if (segment === '..') {
        if (segments.pop() === undefined) return null;
      } else if (segment && segment !== '.') {
        segments.push(segment);
      }
    }
    return segments.length > 0 ? segments : null;
  };

  return {
    byPath(noteFolder, path) {
      const fromNote = path.startsWith('/') ? null : resolve(noteFolder, path);
      const fromTop = resolve([], path);
      return (fromNote && byPath.get(fromNote.join('/').toLowerCase()))
        ?? (fromTop && (byPath.get(fromTop.join('/').toLowerCase()) ?? ending(fromTop)))
        ?? undefined;
    },
    byName(target) {
      const path = resolve([], target);
      return path ? ending(path) : undefined;
    },
  };
}

/** Sorts the archive's Markdown files into dated notes and the ones left out, and its other files. */
function sortFiles(entries: ZipEntry[]): { notes: DatedNote[]; others: ArchiveFile[]; skipped: SkippedNotes } {
  const skipped = { undated: 0, empty: 0, tooLarge: 0, unsafe: 0 };
  const notes: DatedNote[] = [];
  const others: ArchiveFile[] = [];
  for (const entry of entries) {
    if (isHidden(entry.name)) {
      continue;
    }
    const path = safeZipPath(entry.name);
    const markdown = isMarkdown(entry.name);
    if (!path || entry.symlink || !entry.utf8Name || entry.encrypted) {
      skipped.unsafe += markdown ? 1 : 0;
      continue;
    }
    if (!markdown) {
      others.push({ entry, path });
      continue;
    }
    const date = dailyNoteDate(path.at(-1)!);
    if (!date) {
      skipped.undated++;
    } else if (entry.size === 0) {
      skipped.empty++;
    } else if (entry.size > MAX_DAILY_NOTE_BYTES) {
      skipped.tooLarge++;
    } else {
      notes.push({ entry, path, date });
    }
  }
  return { notes, others, skipped };
}

/**
 * Reads a ZIP of daily notes (an Obsidian vault or daily-notes folder, a Logseq graph or its
 * `journals` folder): one Markdown entry for each note named by its day, at any depth, with the
 * pictures and recordings it embeds. Other Markdown files are counted, never dated by guess.
 */
export async function readDailyNotesArchive(archive: Blob): Promise<AppExport> {
  let entries: ZipEntry[];
  try {
    entries = await readZipEntries(archive, { maxEntries: MAX_DAILY_NOTES_ARCHIVE_FILES, maxDirectoryBytes: MAX_DIRECTORY_BYTES });
  } catch (error) {
    throw error instanceof ZipLimitError ? new ExportTooLargeError(error.message) : error;
  }

  const { notes, others, skipped } = sortFiles(entries);
  if (notes.length === 0 && skipped.empty + skipped.tooLarge === 0) {
    throw new NoDailyNotesError('No Markdown file in this archive is named by a day');
  }
  const declared = notes.reduce((sum, note) => sum + note.entry.size, 0);
  if (declared > MAX_DAILY_NOTES_BYTES) {
    throw new ExportTooLargeError(`The notes unpack to ${declared} bytes`);
  }

  notes.sort((first, second) => first.date.localeCompare(second.date) || first.entry.name.localeCompare(second.entry.name));
  const files = fileFinder(others);
  const imported: ImportedEntry[] = [];
  let skippedMedia = 0;
  let empty = skipped.empty;

  for (let start = 0; start < notes.length; start += NOTE_READ_CONCURRENCY) {
    const batch = notes.slice(start, start + NOTE_READ_CONCURRENCY);
    const texts = await Promise.all(batch.map((note) => readZipText(archive, note.entry)));
    texts.forEach((text, offset) => {
      const note = batch[offset]!;
      const parsed = parseDailyNote(text, note.path, files);
      skippedMedia += parsed.skippedMedia;
      if (!parsed.content && parsed.media.length === 0) {
        empty++;
        return;
      }
      imported.push({
        sourceId: dailyNoteSourceId(note.path.join('/'), note.date),
        date: note.date,
        timestamp: Date.parse(note.date),
        content: parsed.content,
        tags: parsed.tags,
        favorite: false,
        journal: '',
        media: parsed.media,
      });
    });
  }

  return {
    source: 'daily-notes',
    archive,
    entries: imported,
    journals: [],
    skippedMedia,
    skippedNotes: { ...skipped, empty },
  };
}
