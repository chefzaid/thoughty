import type { ZipEntry } from '../../../utils/zipReader';

export type AppImportSource = 'dayone' | 'journey';

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
  readonly content: string;
  readonly tags: string[];
  readonly favorite: boolean;
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
  /** Videos, missing files, and other files Thoughty cannot keep. */
  readonly skippedMedia: number;
}
