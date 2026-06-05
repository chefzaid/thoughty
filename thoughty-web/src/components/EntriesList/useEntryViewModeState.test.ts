import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useEntryViewModeState from './useEntryViewModeState';
import { mockEntries, mockRevisions } from './EntriesList.test-utils';

type UseEntryViewModeStateParams = Parameters<typeof useEntryViewModeState>[0];

function createParams(
    overrides: Partial<UseEntryViewModeStateParams> = {},
): UseEntryViewModeStateParams {
    return {
        entry: mockEntries[0],
        onFetchHistory: vi.fn().mockResolvedValue(mockRevisions),
        onDeleteRevision: vi.fn().mockResolvedValue(true),
        onRephrase: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('useEntryViewModeState', () => {
    it('loads revisions and opens history on first toggle', async () => {
        const params = createParams();
        const { result } = renderHook(() => useEntryViewModeState(params));

        await act(async () => {
            await result.current.handleToggleHistory();
        });

        expect(params.onFetchHistory).toHaveBeenCalledWith(1);
        expect(result.current.showHistory).toBe(true);
        expect(result.current.revisions).toEqual(mockRevisions);
        expect(result.current.loadingHistory).toBe(false);
    });

    it('closes history without refetching when already visible', async () => {
        const params = createParams();
        const { result } = renderHook(() => useEntryViewModeState(params));

        await act(async () => {
            await result.current.handleToggleHistory();
        });

        await act(async () => {
            await result.current.handleToggleHistory();
        });

        expect(params.onFetchHistory).toHaveBeenCalledTimes(1);
        expect(result.current.showHistory).toBe(false);
    });

    it('removes a revision after successful deletion', async () => {
        const params = createParams();
        const { result } = renderHook(() => useEntryViewModeState(params));
        const loadedRevision = mockRevisions[0];

        if (!loadedRevision) {
            throw new Error('Expected a mock revision');
        }

        await act(async () => {
            await result.current.handleToggleHistory();
        });

        await act(async () => {
            await result.current.handleDeleteRevision(loadedRevision.id);
        });

        expect(params.onDeleteRevision).toHaveBeenCalledWith(1, loadedRevision.id);
        expect(result.current.revisions).toEqual([]);
    });

    it('tracks rephrasing while the rewrite request is in flight', async () => {
        let resolveRewrite: (() => void) | undefined;
        const onRephrase = vi.fn().mockImplementation(
            () => new Promise<void>((resolve) => {
                resolveRewrite = resolve;
            }),
        );
        const { result } = renderHook(() => useEntryViewModeState(createParams({ onRephrase })));

        act(() => {
            void result.current.handleRephrase('polish');
        });

        await waitFor(() => {
            expect(result.current.rephrasing).toBe(true);
        });

        await act(async () => {
            resolveRewrite?.();
        });

        await waitFor(() => {
            expect(result.current.rephrasing).toBe(false);
        });
        expect(onRephrase).toHaveBeenCalledWith(mockEntries[0], 'polish');
    });
});