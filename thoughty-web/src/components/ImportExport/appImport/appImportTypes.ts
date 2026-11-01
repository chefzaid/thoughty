import type { ZipEntry } from '../../../utils/zipReader';

export type AppImportSource = 'dayone' | 'journey' | 'daily-notes' | 'keep';

/** What the writer said they are importing: another journaling app's export, a folder of daily notes, or Google Keep's Takeout. */
export type AppImportKind = 'apps' | 'daily-notes' | 'keep';

/** Notes of a daily-notes archive or a Keep Takeout left out, by reason; a reason that cannot happen for the source is absent. */
export interface SkippedNotes {
  /** Daily notes: not named by a day (`2024-03-14.md`, `2024_03_14.md`), or named by one that does not exist. */
  readonly undated?: number;
  /** Nothing left once the front matter and empty outline bullets are gone; a Keep note with no title, text, list or file. */
  readonly empty?: number;
  /** Over the size one note may have. */
  readonly tooLarge?: number;
  /** A link, a path that could leave the archive, or a name that is not UTF-8. */
  readonly unsafe?: number;
  /** Keep: in the bin. */
  readonly trashed?: number;
  /** Keep: no creation or edit time to date it by. */
  readonly noDate?: number;
  /** Keep: a note's JSON that cannot be read. */
  readonly unreadable?: number;
}

export interface ImportedMedia {
  /** Attachment name; also how a repeated import recognizes files it already sent. */
  readonly name: string;
  readonly mimetype: string;
  readonly file: ZipEntry;
  /** Photo formats the server does not store (HEIC, TIFF), re-encoded as JPEG when the browser can read them. */
  readonly convert: boolean;
}

export interface ImportedEntry {
  readonly sourceId: string;
  readonly date: string;
  /** Local time of day it was written (`HH:MM`), in the entry's own time zone. */
  readonly timeOfDay?: string;
  readonly timestamp: number;
  readonly title?: string;
  /** Mood from 1 (very low) to 5 (very good), when the source app recorded one. */
  readonly mood?: number;
  readonly content: string;
  readonly tags: string[];
  readonly favorite: boolean;
  /** Archived in the source app (Keep). */
  readonly archived?: boolean;
  /** Pinned in the source app (Keep); the server pins it while the writer's pinned-entry limit allows. */
  readonly pinned?: boolean;
  /** The source journal, for a diary of the same name; empty for daily notes and Keep notes, which go into one diary. */
  readonly journal: string;
  readonly media: ImportedMedia[];
}

export interface AppExport {
  readonly source: AppImportSource;
  /** The export file, read again for each photo; null for a Day One JSON file without media. */
  readonly archive: Blob | null;
  /** Oldest first. */
  readonly entries: ImportedEntry[];
  readonly journals: string[];
  /** Missing files, and files of a type Thoughty cannot keep. */
  readonly skippedMedia: number;
  /** Daily notes and Keep only: the notes that did not become entries. */
  readonly skippedNotes?: SkippedNotes;
}
