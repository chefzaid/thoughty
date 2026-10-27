import type { PDFDocumentProxy } from 'pdfjs-dist';

/** A chapter of the generated book and the page it starts on (1-based, as printed in its footer). */
export interface BookPdfChapter {
    readonly title: string;
    readonly pageNumber: number;
}

/** A page being drawn; `cancel` stops it so the canvas can take the next page. */
export interface BookPdfRender {
    readonly done: Promise<void>;
    cancel(): void;
}

/** The generated PDF, opened for reading page by page. */
export interface BookPdf {
    readonly pageCount: number;
    readonly chapters: readonly BookPdfChapter[];
    /** The page's width and height in CSS pixels at 100%. */
    pageSize(pageNumber: number): Promise<{ width: number; height: number }>;
    /** Draws the page on the canvas at `scale` (1 = 100%), sharp on high-density screens. */
    renderPage(pageNumber: number, canvas: HTMLCanvasElement, scale: number): BookPdfRender;
    /** The page's text, line by line, for screen readers. */
    pageText(pageNumber: number): Promise<string>;
    destroy(): Promise<void>;
}

/** PDF points are 1/72 in, CSS pixels 1/96 in. */
const CSS_PIXELS_PER_POINT = 96 / 72;

/**
 * PDF.js is loaded only when a preview opens, from the app's own bundle: the legacy build, which
 * carries its own polyfills for older phones and browsers, and its worker, served from the app's
 * origin as the CSP's `script-src 'self'` requires. Nothing is fetched at run time: no WebAssembly,
 * CMaps or standard font files, so the PDF's fonts fall back to the system's sans-serif and
 * page breaks stay exactly those of the PDF.
 */
async function loadPdfJs() {
    const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
}

/** Whether an error only says that a render was cancelled for the next one. */
export function isCancelledRender(error: unknown): boolean {
    return error instanceof Error && error.name === 'RenderingCancelledException';
}

async function destinationPage(document: PDFDocumentProxy, dest: string | unknown[] | null): Promise<number | null> {
    const explicit = typeof dest === 'string' ? await document.getDestination(dest) : dest;
    const target: unknown = explicit?.[0];
    if (typeof target === 'number') return target + 1;
    if (target && typeof target === 'object' && 'num' in target && 'gen' in target) {
        return (await document.getPageIndex(target as { num: number; gen: number })) + 1;
    }
    return null;
}

/** The book's chapters from the PDF outline, which the server writes one item per chapter. */
async function readChapters(document: PDFDocumentProxy): Promise<BookPdfChapter[]> {
    const outline = (await document.getOutline()) ?? [];
    const chapters = await Promise.all(outline.map(async (item) => {
        try {
            const pageNumber = await destinationPage(document, item.dest);
            return pageNumber ? { title: item.title, pageNumber } : null;
        } catch {
            return null;
        }
    }));
    return chapters.filter((chapter): chapter is BookPdfChapter => chapter !== null);
}

export async function openBookPdf(data: ArrayBuffer): Promise<BookPdf> {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(data),
        useWasm: false,
        useWorkerFetch: false,
    });
    const document = await loadingTask.promise;
    let chapters: BookPdfChapter[];
    try {
        chapters = await readChapters(document);
    } catch (error) {
        await loadingTask.destroy();
        throw error;
    }

    return {
        pageCount: document.numPages,
        chapters,
        async pageSize(pageNumber) {
            const viewport = (await document.getPage(pageNumber)).getViewport({ scale: CSS_PIXELS_PER_POINT });
            return { width: viewport.width, height: viewport.height };
        },
        renderPage(pageNumber, canvas, scale) {
            let cancelled = false;
            let cancelTask: (() => void) | null = null;
            const done = document.getPage(pageNumber).then(async (page) => {
                if (cancelled) return;
                const pixelRatio = globalThis.devicePixelRatio || 1;
                const viewport = page.getViewport({ scale: scale * CSS_PIXELS_PER_POINT * pixelRatio });
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
                canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
                const task = page.render({ canvas, viewport });
                cancelTask = () => task.cancel();
                await task.promise;
            });
            return {
                done,
                cancel() {
                    cancelled = true;
                    cancelTask?.();
                },
            };
        },
        async pageText(pageNumber) {
            const content = await (await document.getPage(pageNumber)).getTextContent();
            return content.items
                .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ''}` : ''))
                .join('')
                .trim();
        },
        destroy: () => loadingTask.destroy(),
    };
}
