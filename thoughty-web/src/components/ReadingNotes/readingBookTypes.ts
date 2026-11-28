/** A page of a PDF, or a chapter of an EPUB (with its first heading, when it has one). */
export interface ReadingSection {
  readonly kind: 'page' | 'chapter';
  /** 1-based, in reading order. */
  readonly number: number;
  readonly heading: string | null;
}

/** A book opened on this device for reading: nothing of it leaves the browser. */
export interface ReadingBook {
  /** The start of the file's SHA-256, so notes taken on it come back when the same file is opened again. */
  readonly fingerprint: string;
  readonly format: 'pdf' | 'epub';
  readonly title: string;
  readonly author: string | null;
  readonly sections: readonly ReadingSection[];
  /** The section's text as paragraphs (a PDF page keeps its line breaks inside one paragraph). */
  readSection(index: number): Promise<string[]>;
  destroy(): Promise<void>;
}

/** What a book parser gives; the fingerprint and fallbacks are added here. */
export interface ParsedReadingBook {
  readonly title: string | null;
  readonly author: string | null;
  readonly sections: readonly ReadingSection[];
  readSection(index: number): Promise<string[]>;
  destroy(): Promise<void>;
}

export type ReadingBookProblem = 'unsupported' | 'tooLarge' | 'damaged' | 'protected' | 'empty';

export class ReadingBookError extends Error {
  constructor(readonly reason: ReadingBookProblem) {
    super(reason);
  }
}

/** A whitespace-normalized line of metadata, or null when nothing is left. */
export function cleanMetadata(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replaceAll(/\s+/g, ' ').trim();
  return cleaned || null;
}
