import { openPdfReadingBook } from './readingPdf';
import { openEpubReadingBook } from './readingEpub';
import { cleanMetadata, ReadingBookError, type ParsedReadingBook, type ReadingBook } from './readingBookTypes';

export { ReadingBookError, type ReadingBook, type ReadingBookProblem, type ReadingSection } from './readingBookTypes';

/** PDF.js reads the whole file in memory, so larger books are refused before reading them. */
export const MAX_READING_BOOK_BYTES = 100 * 1024 * 1024;
const FINGERPRINT_HEX_LENGTH = 16;
const PDF_MAGIC = '%PDF-';
const ZIP_MAGIC = 'PK\u0003\u0004';

async function fingerprintOf(data: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, FINGERPRINT_HEX_LENGTH);
}

function titleFromFileName(name: string): string {
  return cleanMetadata(name.replace(/\.[^.]+$/, '').replaceAll(/[_]+/g, ' ')) ?? name;
}

/** Opens a PDF or EPUB file, recognized by its first bytes whatever its name. */
export async function openReadingBook(file: File): Promise<ReadingBook> {
  if (file.size > MAX_READING_BOOK_BYTES) throw new ReadingBookError('tooLarge');
  const data = await file.arrayBuffer();
  const magic = new TextDecoder('latin1').decode(new Uint8Array(data, 0, Math.min(5, data.byteLength)));
  const fingerprint = await fingerprintOf(data);

  let parsed: ParsedReadingBook;
  let format: ReadingBook['format'];
  try {
    if (magic.startsWith(PDF_MAGIC)) {
      format = 'pdf';
      parsed = await openPdfReadingBook(data);
    } else if (magic.startsWith(ZIP_MAGIC)) {
      format = 'epub';
      parsed = await openEpubReadingBook(file);
    } else {
      throw new ReadingBookError('unsupported');
    }
  } catch (error) {
    if (error instanceof ReadingBookError) throw error;
    console.error('Could not open the book:', error);
    throw new ReadingBookError('damaged');
  }

  if (parsed.sections.length === 0) {
    await parsed.destroy();
    throw new ReadingBookError('empty');
  }
  return {
    fingerprint,
    format,
    title: parsed.title ?? titleFromFileName(file.name),
    author: parsed.author,
    sections: parsed.sections,
    readSection: (index) => parsed.readSection(index),
    destroy: () => parsed.destroy(),
  };
}
