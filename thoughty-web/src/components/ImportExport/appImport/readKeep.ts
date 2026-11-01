import { readZipText, safeZipPath, type ZipEntry } from '../../../utils/zipReader';
import { checkNotesSize, isHiddenPath, MAX_NOTE_BYTES, NOTE_READ_CONCURRENCY, readNotesArchiveEntries } from './appImportArchive';
import { attachmentTypeFor } from './appImportMedia';
import type { AppExport, ImportedEntry, SkippedNotes } from './appImportTypes';
import { isKeepNote, parseKeepNote, type KeepFileLookup } from './keep';

/** No Keep note in the archive. */
export class NoKeepNotesError extends Error {}

type KeepSkipped = { -readonly [Reason in 'trashed' | 'noDate' | 'empty' | 'tooLarge' | 'unsafe' | 'unreadable']-?: NonNullable<SkippedNotes[Reason]> };

interface NoteFile {
  readonly entry: ZipEntry;
  readonly folder: string;
  readonly fileName: string;
  /** In a folder named `Keep`, where every JSON file is a note. */
  readonly inKeepFolder: boolean;
}

function stem(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Finds a note's file in the note's folder by its name, or by the same name with another extension
 * the import can keep: Takeout names some pictures `.jpeg` in the note and `.jpg` on disk.
 */
function fileFinder(files: ReadonlyArray<{ entry: ZipEntry; folder: string; fileName: string }>): (folder: string) => KeepFileLookup {
  const byName = new Map<string, ZipEntry>();
  const byStem = new Map<string, ZipEntry>();
  for (const file of files) {
    const name = `${file.folder}/${file.fileName}`.toLowerCase();
    byName.set(name, file.entry);
    const key = stem(name);
    if (attachmentTypeFor(file.fileName) && !byStem.has(key)) {
      byStem.set(key, file.entry);
    }
  }
  return (folder) => (filePath) => {
    const name = `${folder}/${filePath}`.toLowerCase();
    return byName.get(name) ?? byStem.get(stem(name));
  };
}

/** Sorts the archive's safe files into the notes to read (the `Keep` folder's JSON files when there is one) and the others. */
function sortFiles(entries: ZipEntry[], skipped: KeepSkipped): { notes: NoteFile[]; others: Array<{ entry: ZipEntry; folder: string; fileName: string }> } {
  const json: NoteFile[] = [];
  const others: Array<{ entry: ZipEntry; folder: string; fileName: string }> = [];
  for (const entry of entries) {
    if (isHiddenPath(entry.name)) {
      continue;
    }
    const isJson = entry.name.toLowerCase().endsWith('.json');
    const path = safeZipPath(entry.name);
    if (!path || entry.symlink || !entry.utf8Name || entry.encrypted) {
      skipped.unsafe += isJson ? 1 : 0;
      continue;
    }
    const file = { entry, folder: path.slice(0, -1).join('/'), fileName: path.at(-1)! };
    if (isJson) {
      json.push({ ...file, inKeepFolder: path.at(-2)?.toLowerCase() === 'keep' });
    } else {
      others.push(file);
    }
  }
  // A Takeout of several Google products holds other JSON files; only a zip of the notes alone has none in a Keep folder
  const inKeep = json.filter((file) => file.inKeepFolder);
  return { notes: inKeep.length > 0 ? inKeep : json, others };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Reads Google Keep's Takeout (the ZIP Google Takeout makes, or a ZIP of its `Keep` folder): one
 * Markdown entry for each note, read from its JSON file (the `.html` twin is not read), with the
 * pictures and recordings it holds. Notes in the bin are counted and left out.
 */
export async function readKeepArchive(archive: Blob): Promise<AppExport> {
  const skipped: KeepSkipped = { trashed: 0, noDate: 0, empty: 0, tooLarge: 0, unsafe: 0, unreadable: 0 };
  const { notes: candidates, others } = sortFiles(await readNotesArchiveEntries(archive), skipped);
  const notes = candidates.filter((note) => {
    if (note.entry.size > MAX_NOTE_BYTES) {
      skipped.tooLarge++;
      return false;
    }
    return true;
  });
  checkNotesSize(notes);

  const lookupIn = fileFinder(others);
  const imported: ImportedEntry[] = [];
  let skippedMedia = 0;
  for (let start = 0; start < notes.length; start += NOTE_READ_CONCURRENCY) {
    const batch = notes.slice(start, start + NOTE_READ_CONCURRENCY);
    const texts = await Promise.all(batch.map((note) => readZipText(archive, note.entry)));
    texts.forEach((text, offset) => {
      const note = batch[offset]!;
      const data = parseJson(text);
      if (!isKeepNote(data)) {
        skipped.unreadable += note.inKeepFolder ? 1 : 0;
        return;
      }
      const parsed = parseKeepNote(data, note.fileName, lookupIn(note.folder));
      if ('skipped' in parsed) {
        skipped[parsed.skipped]++;
        return;
      }
      imported.push(parsed.entry);
      skippedMedia += parsed.skippedMedia;
    });
  }

  const { unsafe, ...recognized } = skipped;
  if (imported.length === 0 && Object.values(recognized).every((count) => count === 0)) {
    throw new NoKeepNotesError(`No Google Keep note in this archive${unsafe > 0 ? ` (${unsafe} unsafe files)` : ''}`);
  }
  return {
    source: 'keep',
    archive,
    entries: imported.sort((first, second) => first.timestamp - second.timestamp),
    journals: [],
    skippedMedia,
    skippedNotes: skipped,
  };
}
