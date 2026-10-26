import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BookVersionData } from './ImportExport.types';
import { useImportExportBook } from './useImportExportBook';

const version = (id: number, versionNumber = id): BookVersionData => ({
    id,
    versionNumber,
    title: 'My Book',
    format: 'pdf',
    filename: `my-book-v${versionNumber}.pdf`,
    chapterCount: 1,
    entryCount: 2,
    addedEntryCount: 2,
    addedChapterTitles: ['Travel'],
    createdAt: '2026-10-26T10:00:00.000Z',
});

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

/** A request the test answers when it chooses, so the order of answers never depends on timing. */
function deferred() {
    let resolve!: (response: Response) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<Response>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

/** Lets the answered request's `then` callbacks (its `json()` and the state update) run. */
const settle = () => act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
});

describe('useImportExportBook version history', () => {
    let authFetch: Mock<(url: string, options?: RequestInit) => Promise<Response>>;
    let versionLoads: ReturnType<typeof deferred>[];

    function renderBook(diaryId: number | null = 1) {
        return renderHook(
            ({ diary }) => useImportExportBook({ authFetch, connectedProviders: [], diaryId: diary, showMessage: vi.fn(), t: (key) => key }),
            { initialProps: { diary: diaryId } },
        );
    }

    beforeEach(() => {
        versionLoads = [];
        authFetch = vi.fn((url: string, options?: RequestInit) => {
            if (url.startsWith('/api/books/versions?') && options?.method !== 'POST') {
                const load = deferred();
                versionLoads.push(load);
                return load.promise;
            }
            return Promise.resolve(json(version(9)));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads the versions of the selected diary', async () => {
        const { result } = renderBook(3);

        expect(authFetch).toHaveBeenCalledWith('/api/books/versions?diaryId=3');
        versionLoads[0]!.resolve(json([version(2), version(1)]));

        await waitFor(() => expect(result.current.versions).toEqual([version(2), version(1)]));
    });

    it('asks for every diary’s versions when no diary is selected', () => {
        renderBook(null);

        expect(authFetch).toHaveBeenCalledWith('/api/books/versions?');
    });

    it('drops the versions of a diary that is no longer selected', async () => {
        const { result, rerender } = renderBook(1);
        rerender({ diary: 2 });

        versionLoads[1]!.resolve(json([version(5)]));
        await waitFor(() => expect(result.current.versions).toEqual([version(5)]));
        versionLoads[0]!.resolve(json([version(1)]));
        await settle();

        expect(result.current.versions).toEqual([version(5)]);
    });

    it('keeps a version saved while the history was still loading', async () => {
        const { result } = renderBook(1);

        await act(async () => {
            await result.current.handleCreateVersion();
        });
        versionLoads[0]!.resolve(json([version(1)]));
        await settle();

        expect(result.current.versions).toEqual([version(9)]);
    });

    it('ignores versions that arrive after the panel closed', async () => {
        const { result, unmount } = renderBook(1);
        const shown = result.current.versions;
        unmount();

        versionLoads[0]!.resolve(json([version(1)]));
        await settle();

        expect(result.current.versions).toBe(shown);
    });

    it('shows no versions when the history is refused or cannot be loaded', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { result, rerender } = renderBook(1);

        versionLoads[0]!.resolve(json({ statusCode: 503 }, false));
        await settle();
        expect(result.current.versions).toEqual([]);

        rerender({ diary: 2 });
        versionLoads[1]!.reject(new Error('offline'));
        await settle();

        expect(result.current.versions).toEqual([]);
        expect(consoleError).toHaveBeenCalledWith('Book version history failed:', expect.any(Error));
    });
});
