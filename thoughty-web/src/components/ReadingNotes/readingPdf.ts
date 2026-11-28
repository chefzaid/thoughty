import { loadPdfJs, pdfPageText } from '../BookPreview/bookPdf';
import { cleanMetadata, type ParsedReadingBook } from './readingBookTypes';

/**
 * A PDF read page by page as text, with PDF.js from the app's own bundle (nothing fetched at run
 * time, as for the book preview). The title and author come from the document's information.
 */
export async function openPdfReadingBook(data: ArrayBuffer): Promise<ParsedReadingBook> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useWasm: false, useWorkerFetch: false });
  const document = await loadingTask.promise;
  let info: Record<string, unknown> = {};
  try {
    info = ((await document.getMetadata()).info ?? {}) as Record<string, unknown>;
  } catch {
    // A PDF without readable information is still read, named after its file
  }

  return {
    title: cleanMetadata(info.Title),
    author: cleanMetadata(info.Author),
    sections: Array.from({ length: document.numPages }, (_, index) => ({ kind: 'page' as const, number: index + 1, heading: null })),
    async readSection(index) {
      const text = await pdfPageText(await document.getPage(index + 1));
      return text ? [text] : [];
    },
    destroy: () => loadingTask.destroy(),
  };
}
