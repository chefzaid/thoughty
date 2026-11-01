import type { ZipEntry } from '../../../utils/zipReader';

export type AppImportSource = 'dayone' | 'journey' | 'daily-notes';

/** What the writer said they are importing: another journaling app's export, or a folder of daily notes. */
export type AppImportKind = 'apps' | 'daily-notes';

/** Markdown files of a daily-notes archive left out, by reason. */
export interface SkippedNotes {
  /** Not named by a day (`2024-03-14.md`, `2024_03_14.md`), or named by one that does not exist. */
  readonly undated: number;
  /** Nothing left once the front matter and empty outline bullets are gone. */
  readonly empty: number;
  /** Over the size one note may have. */
  readonly tooLarge: number;
  /** A link, a path that could leave the archive, or a name that is not UTF-8. */
  readonly unsafe: number;
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
  /** The source journal, for a diary of the same name; empty for daily notes, which go into one diary. */
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
  /** Daily notes only: the Markdown files that did not become entries. */
  readonly skippedNotes?: SkippedNotes;
}
