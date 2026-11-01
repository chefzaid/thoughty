import { readZipEntries, ZipLimitError, type ZipEntry } from '../../../utils/zipReader';

// An archive of notes (daily notes, Google Keep's Takeout) past these is refused before anything is
// unpacked (see docs/security.md)
export const MAX_NOTES_ARCHIVE_FILES = 50_000;
const MAX_DIRECTORY_BYTES = 32 * 1024 * 1024;
/** A note over the size of a text import is left out. */
export const MAX_NOTE_BYTES = 5 * 1024 * 1024;
/** What all the notes may unpack to, as the archive declares it (each file is held to its declared size). */
export const MAX_NOTES_BYTES = 200 * 1024 * 1024;
/** Notes unpacked at once. */
export const NOTE_READ_CONCURRENCY = 8;

/** The archive holds more than the import reads at once. */
export class ExportTooLargeError extends Error {}

/** The directory of an archive of notes, within the caps above. */
export async function readNotesArchiveEntries(archive: Blob): Promise<ZipEntry[]> {
  try {
    return await readZipEntries(archive, { maxEntries: MAX_NOTES_ARCHIVE_FILES, maxDirectoryBytes: MAX_DIRECTORY_BYTES });
  } catch (error) {
    throw error instanceof ZipLimitError ? new ExportTooLargeError(error.message) : error;
  }
}

/** Refuses notes that would unpack past what the import reads at once, by the sizes the archive declares. */
export function checkNotesSize(notes: ReadonlyArray<{ readonly entry: ZipEntry }>): void {
  const declared = notes.reduce((sum, note) => sum + note.entry.size, 0);
  if (declared > MAX_NOTES_BYTES) {
    throw new ExportTooLargeError(`The notes unpack to ${declared} bytes`);
  }
}

/** Folders the writer never sees: `.obsidian`, `.trash`, `.git`, and the Finder's `__MACOSX` copies. */
export function isHiddenPath(name: string): boolean {
  return name.split('/').some((segment) => /^\.[^.]/.test(segment) || segment === '__MACOSX');
}

/** FNV-1a, 64 bits: a short, stable name for a path the API would not take as it is. */
export function pathHash(path: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(path)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}
