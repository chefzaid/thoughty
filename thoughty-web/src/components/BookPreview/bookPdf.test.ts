import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfjs = vi.hoisted(() => ({
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => pdfjs);
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url', () => ({ default: '/assets/pdf.worker.js' }));

import { isCancelledRender, openBookPdf } from './bookPdf';

const ref = (num: number) => ({ num, gen: 0 });

function fakePage(texts: Array<{ str: string; hasEOL: boolean } | { type: string }> = []) {
    const task = { promise: Promise.resolve(), cancel: vi.fn() };
    return {
        task,
        getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale })),
        render: vi.fn(() => task),
        getTextContent: vi.fn(async () => ({ items: texts })),
    };
}

function fakeDocument(outline: unknown[] | null, page = fakePage()) {
    return {
        numPages: 6,
        getOutline: vi.fn(async () => outline),
        getDestination: vi.fn(async (name: string) => (name === 'travel' ? [ref(40)] : null)),
        getPageIndex: vi.fn(async ({ num }: { num: number }) => {
            if (num === 99) throw new Error('Invalid page reference');
            return num / 10;
        }),
        getPage: vi.fn(async () => page),
    };
}

function load(document: ReturnType<typeof fakeDocument>) {
    const loadingTask = { promise: Promise.resolve(document), destroy: vi.fn(async () => undefined) };
    pdfjs.getDocument.mockReturnValue(loadingTask);
    return loadingTask;
}

describe('openBookPdf', () => {
    beforeEach(() => {
        pdfjs.getDocument.mockReset();
        pdfjs.GlobalWorkerOptions.workerSrc = '';
    });

    it('opens the PDF with the bundled worker and nothing fetched at run time', async () => {
        load(fakeDocument([]));

        const pdf = await openBookPdf(new ArrayBuffer(4));

        expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe('/assets/pdf.worker.js');
        expect(pdfjs.getDocument).toHaveBeenCalledWith(expect.objectContaining({ useWasm: false, useWorkerFetch: false }));
        expect(pdf.pageCount).toBe(6);
        expect(pdf.chapters).toEqual([]);
    });

    it('reads the chapters from the outline, skipping items that name no page', async () => {
        load(fakeDocument([
            { title: 'Chapter 1: ideas', dest: [ref(20), { name: 'XYZ' }] },
            { title: 'Chapter 2: travel', dest: 'travel' },
            { title: 'Chapter 3: work', dest: [5] },
            { title: 'Unknown name', dest: 'missing' },
            { title: 'Broken reference', dest: [ref(99)] },
            { title: 'A web link', dest: null },
            { title: 'Not a reference', dest: ['page'] },
        ]));

        const pdf = await openBookPdf(new ArrayBuffer(4));

        expect(pdf.chapters).toEqual([
            { title: 'Chapter 1: ideas', pageNumber: 3 },
            { title: 'Chapter 2: travel', pageNumber: 5 },
            { title: 'Chapter 3: work', pageNumber: 6 },
        ]);
    });

    it('treats a PDF without an outline as having no chapters', async () => {
        load(fakeDocument(null));

        expect((await openBookPdf(new ArrayBuffer(4))).chapters).toEqual([]);
    });

    it('releases the document when its outline cannot be read', async () => {
        const document = fakeDocument([]);
        document.getOutline.mockRejectedValue(new Error('Corrupt outline'));
        const loadingTask = load(document);

        await expect(openBookPdf(new ArrayBuffer(4))).rejects.toThrow('Corrupt outline');
        expect(loadingTask.destroy).toHaveBeenCalled();
    });

    it('measures and draws a page at the zoom, sharp on high-density screens', async () => {
        const page = fakePage();
        load(fakeDocument([], page));
        vi.stubGlobal('devicePixelRatio', 2);
        const pdf = await openBookPdf(new ArrayBuffer(4));
        const canvas = document.createElement('canvas');

        expect(await pdf.pageSize(1)).toEqual({ width: 595 * (96 / 72), height: 842 * (96 / 72) });
        const render = pdf.renderPage(2, canvas, 0.5);
        await render.done;

        expect(page.render).toHaveBeenCalledWith(expect.objectContaining({ canvas }));
        expect(canvas.width).toBe(Math.floor(595 * (96 / 72)));
        expect(canvas.style.width).toBe(`${Math.floor((595 * (96 / 72)) / 2)}px`);
        render.cancel();
        expect(page.task.cancel).toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('does not start drawing a page cancelled before it loaded', async () => {
        const page = fakePage();
        load(fakeDocument([], page));
        const pdf = await openBookPdf(new ArrayBuffer(4));

        const render = pdf.renderPage(1, document.createElement('canvas'), 1);
        render.cancel();
        await render.done;

        expect(page.render).not.toHaveBeenCalled();
    });

    it('reads a page as lines of text and releases the document', async () => {
        const page = fakePage([
            { str: 'Chapter 1', hasEOL: true },
            { type: 'beginMarkedContent' },
            { str: 'ideas', hasEOL: false },
            { str: ' and more', hasEOL: true },
        ]);
        const loadingTask = load(fakeDocument([], page));
        const pdf = await openBookPdf(new ArrayBuffer(4));

        expect(await pdf.pageText(3)).toBe('Chapter 1\nideas and more');
        await pdf.destroy();
        expect(loadingTask.destroy).toHaveBeenCalled();
    });
});

describe('isCancelledRender', () => {
    it('recognizes only the cancellation of a render', () => {
        const cancelled = new Error('Rendering cancelled, page 1');
        cancelled.name = 'RenderingCancelledException';

        expect(isCancelledRender(cancelled)).toBe(true);
        expect(isCancelledRender(new Error('Invalid PDF'))).toBe(false);
        expect(isCancelledRender('RenderingCancelledException')).toBe(false);
    });
});
