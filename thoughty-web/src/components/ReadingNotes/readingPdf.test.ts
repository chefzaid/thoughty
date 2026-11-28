import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfjs = vi.hoisted(() => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => pdfjs);
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url', () => ({ default: '/assets/pdf.worker.js' }));

import { openPdfReadingBook } from './readingPdf';

function load(info: Promise<{ info?: unknown }>, pages: Record<number, string[]>) {
  const document = {
    numPages: 3,
    getMetadata: vi.fn(() => info),
    getPage: vi.fn(async (number: number) => ({
      getTextContent: async () => ({ items: (pages[number] ?? []).map((str) => ({ str, hasEOL: true })) }),
    })),
  };
  const loadingTask = { promise: Promise.resolve(document), destroy: vi.fn(async () => undefined) };
  pdfjs.getDocument.mockReturnValue(loadingTask);
  return { document, loadingTask };
}

describe('openPdfReadingBook', () => {
  beforeEach(() => {
    pdfjs.getDocument.mockReset();
  });

  it('reads the title and author from the document, and each page as text, with nothing fetched at run time', async () => {
    const { document, loadingTask } = load(Promise.resolve({ info: { Title: ' Walden ', Author: 'Henry David Thoreau' } }), {
      1: ['I went to the woods', 'because I wished to live deliberately'],
    });

    const book = await openPdfReadingBook(new ArrayBuffer(8));

    expect(pdfjs.getDocument).toHaveBeenCalledWith(expect.objectContaining({ useWasm: false, useWorkerFetch: false }));
    expect(book).toEqual(expect.objectContaining({ title: 'Walden', author: 'Henry David Thoreau' }));
    expect(book.sections).toEqual([
      { kind: 'page', number: 1, heading: null },
      { kind: 'page', number: 2, heading: null },
      { kind: 'page', number: 3, heading: null },
    ]);
    expect(await book.readSection(0)).toEqual(['I went to the woods\nbecause I wished to live deliberately']);
    expect(document.getPage).toHaveBeenCalledWith(1);
    // A page without text (a picture) has no paragraph
    expect(await book.readSection(1)).toEqual([]);
    await book.destroy();
    expect(loadingTask.destroy).toHaveBeenCalled();
  });

  it('opens a PDF whose information cannot be read, without a title or author', async () => {
    load(Promise.reject(new Error('Bad XRef')), {});
    expect(await openPdfReadingBook(new ArrayBuffer(8))).toEqual(expect.objectContaining({ title: null, author: null }));

    load(Promise.resolve({}), {});
    expect(await openPdfReadingBook(new ArrayBuffer(8))).toEqual(expect.objectContaining({ title: null, author: null }));
  });
});
