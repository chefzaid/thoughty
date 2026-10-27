import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useImportExportBook } from './useImportExportBook';

const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock('../../utils/downloadFile', () => ({ downloadBlob }));

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

function bookResponse(filename = 'thoughty_book_Letters_2026-10-27.pdf', blob = pdfBlob): Response {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Disposition': `attachment; filename="${filename}"` }),
        blob: async () => blob,
    } as unknown as Response;
}

const refusal = () => ({
    ok: false,
    status: 400,
    json: async () => ({ code: 'BOOK_AI_NARRATIVE_KEY_REQUIRED', message: 'Add an AI key' }),
    clone() { return this; },
}) as unknown as Response;

function renderBook(authFetch: Mock<AuthFetch>) {
    const showMessage = vi.fn();
    const hook = renderHook(() => useImportExportBook({
        authFetch,
        connectedProviders: [],
        diaryId: 2,
        showMessage,
        t: (key) => `t:${key}`,
    }));
    return { ...hook, showMessage };
}

/** Answers book exports with `answer`, and version history loads with an empty list. */
function respond(answer: (url: string, options?: RequestInit) => Promise<Response>) {
    return vi.fn<AuthFetch>((url, options) => (url.startsWith('/api/books/export')
        ? answer(url, options)
        : Promise.resolve({ ok: true, json: async () => [] } as unknown as Response)));
}

const exportCalls = (authFetch: Mock<AuthFetch>) => authFetch.mock.calls.filter(([url]) => url.startsWith('/api/books/export'));

describe('useImportExportBook page preview', () => {
    beforeEach(() => {
        downloadBlob.mockReset();
    });

    it('generates the PDF with the current settings, without a format or a saved version', async () => {
        const authFetch = respond(async () => bookResponse());
        const { result } = renderBook(authFetch);
        act(() => result.current.changeOption('format', 'epub'));

        await act(() => result.current.handlePagePreview());

        const [url, options] = exportCalls(authFetch)[0]!;
        expect(url).toBe('/api/books/export?diaryId=2');
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        expect(options?.method).toBe('GET');
        expect(result.current.pagePreview?.file).toEqual({ blob: pdfBlob, filename: 'thoughty_book_Letters_2026-10-27.pdf' });
        expect(authFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    });

    it('opens the dialog while generating and closes it if the server refuses', async () => {
        let answer!: (response: Response) => void;
        const authFetch = respond(() => new Promise<Response>((resolve) => { answer = resolve; }));
        const { result, showMessage } = renderBook(authFetch);

        let pending!: Promise<void>;
        act(() => { pending = result.current.handlePagePreview(); });
        expect(result.current.pagePreview).toEqual({ file: null });

        await act(async () => {
            answer(refusal());
            await pending;
        });
        expect(result.current.pagePreview).toBeNull();
        expect(showMessage).toHaveBeenCalledWith('error', 't:apiError_BOOK_AI_NARRATIVE_KEY_REQUIRED');
    });

    it('closes on a network failure with the export error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const authFetch = respond(async () => {
            throw new TypeError('Failed to fetch');
        });
        const { result, showMessage } = renderBook(authFetch);

        await act(() => result.current.handlePagePreview());

        expect(result.current.pagePreview).toBeNull();
        expect(showMessage).toHaveBeenCalledWith('error', 't:bookExportError');
    });

    it('stops generating when closed, and ignores the late answer', async () => {
        let answer!: (response: Response) => void;
        const authFetch = respond((_url, options) => new Promise<Response>((resolve, reject) => {
            answer = resolve;
            options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));
        const { result, showMessage } = renderBook(authFetch);

        let pending!: Promise<void>;
        act(() => { pending = result.current.handlePagePreview(); });
        const signal = exportCalls(authFetch)[0]![1]!.signal!;
        act(() => result.current.closePagePreview());
        await act(() => pending);

        expect(signal.aborted).toBe(true);
        expect(result.current.pagePreview).toBeNull();
        expect(showMessage).not.toHaveBeenCalled();
        answer(bookResponse());
    });

    it('ignores an answer that arrives after closing even if the request was not cancelled', async () => {
        let answer!: (response: Response) => void;
        const authFetch = respond(() => new Promise<Response>((resolve) => { answer = resolve; }));
        const { result } = renderBook(authFetch);

        let pending!: Promise<void>;
        act(() => { pending = result.current.handlePagePreview(); });
        act(() => result.current.closePagePreview());
        await act(async () => {
            answer(bookResponse());
            await pending;
        });

        expect(result.current.pagePreview).toBeNull();
    });

    it('downloads the previewed PDF, and reuses it for a preview or a PDF download with the same settings', async () => {
        const authFetch = respond(async () => bookResponse());
        const { result, showMessage } = renderBook(authFetch);

        await act(() => result.current.handlePagePreview());
        act(() => result.current.downloadPagePreview());
        expect(downloadBlob).toHaveBeenCalledWith(pdfBlob, 'thoughty_book_Letters_2026-10-27.pdf');
        expect(showMessage).toHaveBeenCalledWith('success', 't:bookExportSuccess', 3000);

        act(() => result.current.closePagePreview());
        await act(() => result.current.handlePagePreview());
        expect(result.current.pagePreview?.file?.blob).toBe(pdfBlob);
        await act(() => result.current.handleDownload());
        expect(downloadBlob).toHaveBeenCalledTimes(2);
        expect(exportCalls(authFetch)).toHaveLength(1);
    });

    it('generates again once a setting, the cover image or the format changes', async () => {
        const authFetch = respond(async (url) => bookResponse(url.includes('format=md') ? 'book.md' : 'book.pdf'));
        const { result } = renderBook(authFetch);

        await act(() => result.current.handlePagePreview());
        act(() => result.current.changeOption('includeDates', false));
        await act(() => result.current.handlePagePreview());
        expect(exportCalls(authFetch)).toHaveLength(2);

        act(() => result.current.changeOption('coverImage', new File(['png'], 'cover.png', { type: 'image/png' })));
        await act(() => result.current.handlePagePreview());
        expect(exportCalls(authFetch)).toHaveLength(3);
        expect(exportCalls(authFetch)[2]![1]?.method).toBe('POST');

        // Another format is generated and downloaded on its own; the PDF stays cached
        act(() => result.current.changeOption('format', 'md'));
        await act(() => result.current.handleDownload());
        expect(downloadBlob).toHaveBeenLastCalledWith(pdfBlob, 'book.md');
        act(() => result.current.changeOption('format', 'pdf'));
        await act(() => result.current.handleDownload());
        expect(exportCalls(authFetch)).toHaveLength(4);
    });

    it('lets a PDF download feed the next preview', async () => {
        const authFetch = respond(async () => bookResponse());
        const { result } = renderBook(authFetch);

        await act(() => result.current.handleDownload());
        await act(() => result.current.handlePagePreview());

        expect(exportCalls(authFetch)).toHaveLength(1);
        expect(result.current.pagePreview?.file?.filename).toBe('thoughty_book_Letters_2026-10-27.pdf');
    });

    it('does nothing when asked to download before the PDF is ready', () => {
        const { result } = renderBook(respond(() => new Promise<Response>(() => undefined)));

        act(() => { void result.current.handlePagePreview(); });
        act(() => result.current.downloadPagePreview());

        expect(downloadBlob).not.toHaveBeenCalled();
    });

    it('cancels a preview still generating when the converter closes', () => {
        const authFetch = respond(() => new Promise<Response>(() => undefined));
        const { result, unmount } = renderBook(authFetch);

        act(() => { void result.current.handlePagePreview(); });
        const signal = exportCalls(authFetch)[0]![1]!.signal!;
        unmount();

        expect(signal.aborted).toBe(true);
    });
});
