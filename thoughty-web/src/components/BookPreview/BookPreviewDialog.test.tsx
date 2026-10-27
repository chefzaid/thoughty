import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getTranslation, type Language } from '../../utils/translations';
import type { BookPdf } from './bookPdf';
import { BookPreviewDialog } from './BookPreviewDialog';

const openBookPdf = vi.hoisted(() => vi.fn());
vi.mock('./bookPdf', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./bookPdf')>()),
    openBookPdf,
}));

const tFor = (language: Language) => (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

function fakePdf(overrides: Partial<BookPdf> = {}) {
    const cancel = vi.fn();
    const pdf = {
        pageCount: 6,
        chapters: [
            { title: 'Chapter 1: ideas', pageNumber: 3 },
            { title: 'Chapter 2: travel', pageNumber: 4 },
            { title: 'Chapter 3: work', pageNumber: 6 },
        ],
        pageSize: vi.fn(async () => ({ width: 794, height: 1123 })),
        renderPage: vi.fn(() => ({ done: Promise.resolve(), cancel })),
        pageText: vi.fn(async (page: number) => `Text of page ${page}`),
        destroy: vi.fn(async () => undefined),
        ...overrides,
    } satisfies BookPdf;
    return { pdf, cancel };
}

// jsdom's Blob cannot read itself; the browser's can
const PDF_FILE = { arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Blob;

function renderDialog(props: Partial<Parameters<typeof BookPreviewDialog>[0]> = {}, language: Language = 'en') {
    const onClose = vi.fn();
    const onDownload = vi.fn();
    const view = render(
        <BookPreviewDialog open file={PDF_FILE} isLight={false} onClose={onClose} onDownload={onDownload} t={tFor(language)} {...props} />,
    );
    return { ...view, onClose, onDownload };
}

const pageStatus = () => screen.getByRole('toolbar').querySelector('[role="status"]');

describe('BookPreviewDialog', () => {
    let book: ReturnType<typeof fakePdf>;

    beforeEach(() => {
        book = fakePdf();
        openBookPdf.mockResolvedValue(book.pdf);
    });

    afterEach(() => {
        openBookPdf.mockReset();
    });

    it('renders nothing while closed', () => {
        renderDialog({ open: false });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(openBookPdf).not.toHaveBeenCalled();
    });

    it('says the book is being generated, with Download disabled and focus on Close', () => {
        renderDialog({ file: null });

        const dialog = screen.getByRole('dialog', { name: 'Book preview' });
        expect(dialog).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByRole('status')).toHaveTextContent('Generating the book...');
        expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    });

    it('shows the first page with its text, then turns pages with the buttons', async () => {
        renderDialog();

        expect(screen.getByRole('status')).toHaveTextContent('Opening the pages...');
        await waitFor(() => expect(pageStatus()).toHaveTextContent('Page 1 of 6'));
        expect(await screen.findByText('Text of page 1')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Page 1 of 6' })).toHaveAccessibleDescription(/arrows/);
        await waitFor(() => expect(book.pdf.renderPage).toHaveBeenCalledWith(1, expect.any(HTMLCanvasElement), 1));
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
        expect(pageStatus()).toHaveTextContent('Page 2 of 6');
        expect(await screen.findByText('Text of page 2')).toBeInTheDocument();
        await waitFor(() => expect(book.pdf.renderPage).toHaveBeenCalledWith(2, expect.any(HTMLCanvasElement), 1));
        expect(book.cancel).toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
        expect(pageStatus()).toHaveTextContent('Page 1 of 6');
    });

    it('jumps from the book contents and keeps the list on the chapter being read', async () => {
        renderDialog();
        const jump = await screen.findByLabelText('Go to');

        expect([...jump.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
            'Title page',
            'Table of contents',
            'Chapter 1: ideas (page 3)',
            'Chapter 2: travel (page 4)',
            'Chapter 3: work (page 6)',
        ]);
        fireEvent.change(jump, { target: { value: '3' } });
        expect(pageStatus()).toHaveTextContent('Page 4 of 6');

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
        expect(pageStatus()).toHaveTextContent('Page 5 of 6');
        expect(jump).toHaveValue('3');
    });

    it('turns pages and zooms from the keyboard, but not while a control has focus', async () => {
        renderDialog();
        const region = await screen.findByRole('region', { name: 'Page 1 of 6' });

        fireEvent.keyDown(region, { key: 'ArrowRight' });
        expect(pageStatus()).toHaveTextContent('Page 2 of 6');
        fireEvent.keyDown(region, { key: 'PageDown' });
        fireEvent.keyDown(region, { key: 'End' });
        expect(pageStatus()).toHaveTextContent('Page 6 of 6');
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
        fireEvent.keyDown(region, { key: 'ArrowRight' });
        expect(pageStatus()).toHaveTextContent('Page 6 of 6');
        fireEvent.keyDown(region, { key: 'PageUp' });
        fireEvent.keyDown(region, { key: 'ArrowLeft' });
        expect(pageStatus()).toHaveTextContent('Page 4 of 6');
        fireEvent.keyDown(region, { key: 'Home' });
        expect(pageStatus()).toHaveTextContent('Page 1 of 6');

        fireEvent.keyDown(region, { key: '+' });
        expect(screen.getByText('125%')).toBeInTheDocument();
        fireEvent.keyDown(region, { key: '=' });
        expect(screen.getByText('150%')).toBeInTheDocument();
        fireEvent.keyDown(region, { key: '-' });
        expect(screen.getByText('125%')).toBeInTheDocument();
        fireEvent.keyDown(region, { key: '0' });
        expect(screen.getByText('100%')).toBeInTheDocument();
        fireEvent.keyDown(region, { key: 'ArrowRight', ctrlKey: true });
        fireEvent.keyDown(region, { key: 'x' });
        fireEvent.keyDown(screen.getByLabelText('Go to'), { key: 'ArrowRight' });
        expect(pageStatus()).toHaveTextContent('Page 1 of 6');
    });

    it('zooms in steps between 50% and 300%, and back to the whole page', async () => {
        renderDialog();
        const zoomIn = await screen.findByRole('button', { name: 'Zoom in' });
        const fit = screen.getByRole('button', { name: 'Fit page' });

        expect(fit).toBeDisabled();
        for (let step = 0; step < 6; step += 1) fireEvent.click(zoomIn);
        expect(screen.getByText('300%')).toBeInTheDocument();
        expect(zoomIn).toBeDisabled();
        await waitFor(() => expect(book.pdf.renderPage).toHaveBeenLastCalledWith(1, expect.any(HTMLCanvasElement), 3));

        fireEvent.click(fit);
        const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
        fireEvent.click(zoomOut);
        fireEvent.click(zoomOut);
        expect(screen.getByText('50%')).toBeInTheDocument();
        expect(zoomOut).toBeDisabled();
    });

    it('downloads the shown PDF, closes, and shows a notice', async () => {
        const { onClose, onDownload } = renderDialog({ notice: 'The preview shows the PDF edition.' });

        expect(screen.getByText('The preview shows the PDF edition.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
        expect(onDownload).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalled();
        await screen.findByRole('toolbar');
    });

    it('says when the pages cannot be shown, and still offers the download', async () => {
        openBookPdf.mockRejectedValue(new Error('Invalid PDF'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        renderDialog({}, 'fr');

        expect(await screen.findByRole('alert')).toHaveTextContent("Les pages n'ont pas pu être affichées.");
        expect(screen.getByRole('button', { name: 'Télécharger le PDF' })).toBeEnabled();
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    it('treats an empty PDF as one it cannot show', async () => {
        openBookPdf.mockResolvedValue(fakePdf({ pageCount: 0 }).pdf);
        renderDialog();

        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('logs a page that fails to draw or read, but not a cancelled one', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const cancelled = Object.assign(new Error('cancelled'), { name: 'RenderingCancelledException' });
        openBookPdf.mockResolvedValue(fakePdf({
            renderPage: vi.fn()
                .mockImplementationOnce(() => ({ done: Promise.reject(cancelled), cancel: vi.fn() }))
                .mockImplementation(() => ({ done: Promise.reject(new Error('Bad page')), cancel: vi.fn() })),
            pageText: vi.fn(async () => {
                throw new Error('No text');
            }),
        }).pdf);
        renderDialog();
        await screen.findByRole('toolbar');
        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

        await waitFor(() => expect(error).toHaveBeenCalledWith('Book preview could not draw the page:', expect.any(Error)));
        expect(error).toHaveBeenCalledWith('Book preview could not read the page text:', expect.any(Error));
        expect(error).not.toHaveBeenCalledWith(expect.anything(), cancelled);
    });

    it('releases the document when closed, even one still opening', async () => {
        const { rerender, onClose, onDownload } = renderDialog();
        await screen.findByRole('toolbar');

        rerender(<BookPreviewDialog open={false} file={PDF_FILE} isLight onClose={onClose} onDownload={onDownload} t={tFor('en')} />);
        await waitFor(() => expect(book.pdf.destroy).toHaveBeenCalled());

        let resolveOpen!: (pdf: BookPdf) => void;
        const late = fakePdf();
        openBookPdf.mockReturnValue(new Promise<BookPdf>((resolve) => { resolveOpen = resolve; }));
        rerender(<BookPreviewDialog open file={PDF_FILE} isLight onClose={onClose} onDownload={onDownload} t={tFor('en')} />);
        rerender(<BookPreviewDialog open={false} file={PDF_FILE} isLight onClose={onClose} onDownload={onDownload} t={tFor('en')} />);
        await act(async () => resolveOpen(late.pdf));
        expect(late.pdf.destroy).toHaveBeenCalled();
    });

    it('fits the page to the measured viewport', async () => {
        const observers: Array<() => void> = [];
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: () => void) {
                observers.push(callback);
            }
            observe() {}
            disconnect() {}
        });
        const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(421);
        const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(2000);
        renderDialog();

        await waitFor(() => expect(book.pdf.renderPage).toHaveBeenLastCalledWith(1, expect.any(HTMLCanvasElement), (421 - 24) / 794));
        width.mockReturnValue(818);
        act(() => observers.forEach((notify) => notify()));
        await waitFor(() => expect(book.pdf.renderPage).toHaveBeenLastCalledWith(1, expect.any(HTMLCanvasElement), 1));

        width.mockRestore();
        height.mockRestore();
        vi.unstubAllGlobals();
    });
});
