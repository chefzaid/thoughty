import { describe, expect, it, vi, type Mock } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useImportExportBook } from './useImportExportBook';

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body, clone() { return this; } }) as unknown as Response;
const preview = { title: 'Letters', chapterCount: 0, entryCount: 0, chapters: [] };

function renderBook(authFetch: Mock<AuthFetch>) {
    const showMessage = vi.fn();
    const hook = renderHook(() => useImportExportBook({ authFetch, connectedProviders: [], diaryId: 2, showMessage, t: (key) => `t:${key}` }));
    return { ...hook, showMessage };
}

function previewParams(authFetch: Mock<AuthFetch>): URLSearchParams {
    const url = authFetch.mock.calls.find(([called]) => called.startsWith('/api/books/preview'))![0];
    return new URL(url, 'http://test').searchParams;
}

describe('useImportExportBook book pages', () => {
    it('sends the dedication and epigraph trimmed, line breaks kept', async () => {
        const authFetch = vi.fn<AuthFetch>(async () => json(preview));
        const { result } = renderBook(authFetch);

        act(() => {
            result.current.changeOption('dedication', '  For Marie,\nwho listened. ');
            result.current.changeOption('epigraph', '\n« Moments »\n— Pavese\n');
        });
        await act(async () => { await result.current.handlePreview(); });

        expect(previewParams(authFetch).get('dedication')).toBe('For Marie,\nwho listened.');
        expect(previewParams(authFetch).get('epigraph')).toBe('« Moments »\n— Pavese');
    });

    it('sends neither when they are blank', async () => {
        const authFetch = vi.fn<AuthFetch>(async () => json(preview));
        const { result } = renderBook(authFetch);

        act(() => result.current.changeOption('dedication', '   '));
        await act(async () => { await result.current.handlePreview(); });

        expect(previewParams(authFetch).has('dedication')).toBe(false);
        expect(previewParams(authFetch).has('epigraph')).toBe(false);
        expect(previewParams(authFetch).has('closingPage')).toBe(false);
    });

    it('asks for the closing page only when it is on', async () => {
        const authFetch = vi.fn<AuthFetch>(async () => json(preview));
        const { result } = renderBook(authFetch);

        act(() => result.current.changeOption('closingPage', true));
        await act(async () => { await result.current.handlePreview(); });

        expect(previewParams(authFetch).get('closingPage')).toBe('true');
    });

    it('says why the API refused a text that is too long, in the reader’s language', async () => {
        const authFetch = vi.fn<AuthFetch>(async (url) => (url.startsWith('/api/books/export')
            ? json({ code: 'BOOK_EPIGRAPH_TOO_LONG', message: 'The epigraph is too long' }, false)
            : json([])));
        const { result, showMessage } = renderBook(authFetch);

        act(() => result.current.changeOption('epigraph', 'A long quotation'));
        await act(async () => { await result.current.handleDownload(); });

        expect(showMessage).toHaveBeenCalledWith('error', 't:apiError_BOOK_EPIGRAPH_TOO_LONG');
    });
});
