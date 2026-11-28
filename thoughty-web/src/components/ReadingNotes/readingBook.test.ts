// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const parsers = vi.hoisted(() => ({ pdf: vi.fn(), epub: vi.fn() }));
vi.mock('./readingPdf', () => ({ openPdfReadingBook: parsers.pdf }));
vi.mock('./readingEpub', () => ({ openEpubReadingBook: parsers.epub }));

import { MAX_READING_BOOK_BYTES, openReadingBook } from './readingBook';
import { ReadingBookError, type ParsedReadingBook } from './readingBookTypes';

const parsed = (overrides: Partial<ParsedReadingBook> = {}): ParsedReadingBook => ({
  title: 'Walden',
  author: 'Henry David Thoreau',
  sections: [{ kind: 'page', number: 1, heading: null }],
  readSection: vi.fn(async () => ['I went to the woods']),
  destroy: vi.fn(async () => undefined),
  ...overrides,
});

const pdfFile = (name = 'walden.pdf', body = '%PDF-1.7 rest of the file') => new File([body], name, { type: 'application/pdf' });

describe('openReadingBook', () => {
  beforeEach(() => {
    parsers.pdf.mockReset();
    parsers.epub.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('opens a PDF by its first bytes, with a fingerprint of its content that stays the same for the same file', async () => {
    const book = parsed();
    parsers.pdf.mockResolvedValue(book);

    const opened = await openReadingBook(pdfFile('renamed.bin'));
    const again = await openReadingBook(pdfFile('walden copy.pdf'));

    expect(parsers.pdf).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(opened).toEqual(expect.objectContaining({ format: 'pdf', title: 'Walden', author: 'Henry David Thoreau', sections: book.sections }));
    expect(opened.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(again.fingerprint).toBe(opened.fingerprint);
    expect((await openReadingBook(pdfFile('other.pdf', '%PDF-1.7 another book'))).fingerprint).not.toBe(opened.fingerprint);
    expect(await opened.readSection(0)).toEqual(['I went to the woods']);
    await opened.destroy();
    expect(book.destroy).toHaveBeenCalled();
  });

  it('opens an EPUB (a ZIP) and names a book without a title after its file', async () => {
    parsers.epub.mockResolvedValue(parsed({ title: null, author: null }));
    const file = new File(['PK\u0003\u0004 the archive'], 'the_little_prince.epub');

    const opened = await openReadingBook(file);

    expect(parsers.epub).toHaveBeenCalledWith(file);
    expect(opened).toEqual(expect.objectContaining({ format: 'epub', title: 'the little prince', author: null }));
  });

  it('turns down a file too large, of another kind, unreadable or without any text', async () => {
    const huge = pdfFile();
    Object.defineProperty(huge, 'size', { value: MAX_READING_BOOK_BYTES + 1 });
    await expect(openReadingBook(huge)).rejects.toEqual(new ReadingBookError('tooLarge'));
    await expect(openReadingBook(new File(['plain text'], 'notes.txt'))).rejects.toEqual(new ReadingBookError('unsupported'));

    parsers.pdf.mockRejectedValueOnce(new Error('PasswordException'));
    await expect(openReadingBook(pdfFile())).rejects.toEqual(new ReadingBookError('damaged'));
    parsers.epub.mockRejectedValueOnce(new ReadingBookError('protected'));
    await expect(openReadingBook(new File(['PK\u0003\u0004'], 'locked.epub'))).rejects.toEqual(new ReadingBookError('protected'));

    const empty = parsed({ sections: [] });
    parsers.pdf.mockResolvedValueOnce(empty);
    await expect(openReadingBook(pdfFile())).rejects.toEqual(new ReadingBookError('empty'));
    expect(empty.destroy).toHaveBeenCalled();
  });
});
