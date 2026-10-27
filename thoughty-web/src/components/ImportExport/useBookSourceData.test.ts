import { describe, expect, it, vi, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBookSourceData } from './useBookSourceData';
import type { BookOptions } from './ImportExport.types';

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body, clone() { return this; } }) as unknown as Response;

const savedSearch = { id: 4, name: 'Family', diaryId: null, filters: {}, createdAt: '', updatedAt: '' };
const picked = (id: number) => ({ id, date: '2024-05-01', title: null, excerpt: `Entry ${id}`, diaryId: 1, diaryName: 'Home', isArchived: false });

type SourceOptions = Pick<BookOptions, 'source' | 'entryIds'>;

function renderSourceData(authFetch: Mock, options: SourceOptions) {
    return renderHook(({ current }) => useBookSourceData({ authFetch, options: current }), { initialProps: { current: options } });
}

describe('useBookSourceData', () => {
    it('loads nothing for a journal book', () => {
        const authFetch = vi.fn();
        const { result } = renderSourceData(authFetch, { source: 'journal', entryIds: [] });

        expect(authFetch).not.toHaveBeenCalled();
        expect(result.current.savedSearches.status).toBe('idle');
        expect(result.current.pickedEntries.status).toBe('idle');
    });

    it('loads the saved searches once, the first time that source is chosen', async () => {
        const authFetch = vi.fn().mockResolvedValue(json({ savedSearches: [savedSearch], limit: 50 }));
        const { result, rerender } = renderSourceData(authFetch, { source: 'journal', entryIds: [] });

        rerender({ current: { source: 'savedSearch', entryIds: [] } });
        await waitFor(() => expect(result.current.savedSearches).toEqual({ status: 'ready', data: [savedSearch] }));
        rerender({ current: { source: 'journal', entryIds: [] } });
        rerender({ current: { source: 'savedSearch', entryIds: [] } });

        expect(authFetch).toHaveBeenCalledTimes(1);
        expect(authFetch).toHaveBeenCalledWith('/api/saved-searches');
    });

    it('says when the saved searches could not be loaded', async () => {
        const authFetch = vi.fn().mockResolvedValue(json({}, false));
        const { result } = renderSourceData(authFetch, { source: 'savedSearch', entryIds: [] });

        await waitFor(() => expect(result.current.savedSearches).toEqual({ status: 'error', error: 'savedSearchesLoadFailed' }));
    });

    it('looks up new picks and drops removed ones without asking again', async () => {
        const authFetch = vi.fn()
            .mockResolvedValueOnce(json({ entries: [picked(3), picked(5)], missingIds: [9] }))
            .mockResolvedValueOnce(json({ entries: [picked(3), picked(7)], missingIds: [] }));
        const { result, rerender } = renderSourceData(authFetch, { source: 'entries', entryIds: [5, 3, 9] });

        expect(result.current.pickedEntries.status).toBe('loading');
        await waitFor(() => expect(result.current.pickedEntries.status).toBe('ready'));
        expect(authFetch).toHaveBeenCalledWith('/api/books/picked-entries?entryIds=5%2C3%2C9');

        rerender({ current: { source: 'entries', entryIds: [3] } });
        expect(result.current.pickedEntries).toEqual({ status: 'ready', data: { entries: [picked(3)], missingIds: [] } });
        expect(authFetch).toHaveBeenCalledTimes(1);

        rerender({ current: { source: 'entries', entryIds: [3, 7] } });
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith('/api/books/picked-entries?entryIds=3%2C7'));
        await waitFor(() => expect(result.current.pickedEntries).toEqual({
            status: 'ready', data: { entries: [picked(3), picked(7)], missingIds: [] },
        }));

        rerender({ current: { source: 'entries', entryIds: [] } });
        expect(result.current.pickedEntries.status).toBe('idle');
    });

    it('gives the API’s coded reason, or a fallback, when the picks cannot be looked up', async () => {
        const authFetch = vi.fn()
            .mockResolvedValueOnce(json({ code: 'BOOK_PICKED_ENTRIES_LIMIT', message: 'Too many' }, false))
            .mockRejectedValueOnce(new Error('offline'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { result, rerender } = renderSourceData(authFetch, { source: 'entries', entryIds: [1, 2] });

        await waitFor(() => expect(result.current.pickedEntries).toEqual({ status: 'error', error: 'apiError_BOOK_PICKED_ENTRIES_LIMIT' }));

        rerender({ current: { source: 'entries', entryIds: [1] } });
        await waitFor(() => expect(result.current.pickedEntries).toEqual({ status: 'error', error: 'bookPickedLoadError' }));
    });
});
