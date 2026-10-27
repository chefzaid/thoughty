import { describe, expect, it, vi, type Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BookVersionData } from './ImportExport.types';
import { useImportExportBook } from './useImportExportBook';

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body, clone() { return this; } }) as unknown as Response;

const preview = { title: 'Letters', chapterCount: 1, entryCount: 2, chapters: [] };
const pickedVersion: BookVersionData = {
    id: 7,
    versionNumber: 1,
    title: 'Letters',
    format: 'pdf',
    filename: 'letters_v1.pdf',
    chapterCount: 1,
    entryCount: 2,
    addedEntryCount: 2,
    addedChapterTitles: ['Letters'],
    source: { kind: 'entries', entryIds: [8, 6] },
    createdAt: '2026-10-27T10:00:00.000Z',
};

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

function renderBook(authFetch: Mock<AuthFetch>, initialEntryIds?: number[]) {
    const showMessage = vi.fn();
    const hook = renderHook(() => useImportExportBook({
        authFetch,
        connectedProviders: [],
        diaryId: 2,
        initialEntryIds,
        showMessage,
        t: (key) => `t:${key}`,
    }));
    return { ...hook, showMessage };
}

function respond(handlers: Record<string, () => Response>) {
    return vi.fn<AuthFetch>((url: string) => {
        const path = url.split('?')[0]!;
        return Promise.resolve(handlers[path]?.() ?? json([]));
    });
}

describe('useImportExportBook sources', () => {
    it('opens on the entries picked in the journal and builds the book from them', async () => {
        const authFetch = respond({
            '/api/books/picked-entries': () => json({ entries: [], missingIds: [] }),
            '/api/books/preview': () => json(preview),
        });
        const { result } = renderBook(authFetch, [5, 3, 5]);

        expect(result.current.options).toEqual(expect.objectContaining({ source: 'entries', entryIds: [5, 3] }));
        expect(result.current.sourceReady).toBe(true);
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith('/api/books/versions?source=entries'));

        await act(async () => { await result.current.handlePreview(); });

        const previewUrl = new URL(authFetch.mock.calls.find(([url]) => url.startsWith('/api/books/preview'))![0], 'http://test');
        expect(previewUrl.searchParams.get('source')).toBe('entries');
        expect(previewUrl.searchParams.get('entryIds')).toBe('5,3');
        expect(previewUrl.searchParams.has('diaryId')).toBe(false);
        expect(result.current.preview).toEqual(preview);

        act(() => result.current.changeOption('entryIds', [5]));
        expect(result.current.preview).toBeNull();
    });

    it('follows the chosen saved search’s history and leaves it empty until one is chosen', async () => {
        const authFetch = respond({ '/api/saved-searches': () => json({ savedSearches: [], limit: 50 }) });
        const { result } = renderBook(authFetch);
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith('/api/books/versions?diaryId=2'));

        act(() => result.current.changeOption('source', 'savedSearch'));
        expect(result.current.sourceReady).toBe(false);
        act(() => result.current.changeOption('savedSearchId', 4));

        await waitFor(() => expect(authFetch).toHaveBeenCalledWith('/api/books/versions?source=savedSearch&savedSearchId=4'));
        expect(authFetch.mock.calls.filter(([url]) => url.startsWith('/api/books/versions'))).toHaveLength(2);
    });

    it('builds the next hand-picked version from a saved version’s entries', async () => {
        const authFetch = respond({ '/api/books/picked-entries': () => json({ entries: [], missingIds: [] }) });
        const { result } = renderBook(authFetch);

        act(() => result.current.pickVersionEntries(pickedVersion));

        expect(result.current.options).toEqual(expect.objectContaining({ source: 'entries', entryIds: [8, 6] }));
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith('/api/books/picked-entries?entryIds=8%2C6'));
    });

    it('shows the API’s reason when a book cannot be built from the source', async () => {
        const refusal = () => json({ statusCode: 400, code: 'BOOK_PICKED_ENTRIES_UNAVAILABLE', message: 'Gone' }, false);
        const authFetch = respond({
            '/api/books/picked-entries': () => json({ entries: [], missingIds: [3] }),
            '/api/books/preview': refusal,
            '/api/books/export': refusal,
            '/api/books/versions': () => json([]),
        });
        const { result, showMessage } = renderBook(authFetch, [3]);

        await act(async () => { await result.current.handlePreview(); });
        await act(async () => { await result.current.handleDownload(); });

        expect(showMessage).toHaveBeenCalledWith('error', 't:apiError_BOOK_PICKED_ENTRIES_UNAVAILABLE');
        expect(showMessage).toHaveBeenCalledTimes(2);
    });
});
