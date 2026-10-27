import { useEffect, useMemo, useRef, useState } from 'react';
import { readApiErrorMessage } from '../../services/api/base';
import { createSavedSearchesService, type SavedSearch } from '../../services/api/savedSearchesService';
import type { BookOptions, BookPickedEntries } from './ImportExport.types';

const NO_IDS: readonly number[] = [];

export type BookSourceLoad<T> =
    | { status: 'idle' | 'loading' }
    | { status: 'ready'; data: T }
    | { status: 'error'; error: string };

interface UseBookSourceDataProps {
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
    options: Pick<BookOptions, 'source' | 'entryIds'>;
}

/**
 * What the book source picker shows: the writer's saved searches, loaded the first time that source is
 * chosen, and the picked entries (with the ones that are gone), looked up whenever entries are picked.
 * Errors are translation keys, or the API's coded reason.
 */
export function useBookSourceData({ authFetch, options }: UseBookSourceDataProps) {
    const savedSearchesService = useMemo(() => createSavedSearchesService(authFetch), [authFetch]);
    const [savedSearches, setSavedSearches] = useState<BookSourceLoad<SavedSearch[]>>({ status: 'idle' });
    const [pickedLoad, setPickedLoad] = useState<BookSourceLoad<BookPickedEntries>>({ status: 'idle' });
    const savedSearchesRequested = useRef(false);
    const needsSavedSearches = options.source === 'savedSearch';
    const pickedIds = options.source === 'entries' ? options.entryIds : NO_IDS;
    const loadedPicks = pickedLoad.status === 'ready' ? pickedLoad.data : null;
    // Removing a pick needs no request; picks the last answer did not cover are looked up again
    const lookupKey = useMemo(() => {
        const known = new Set([...(loadedPicks?.entries.map((entry) => entry.id) ?? []), ...(loadedPicks?.missingIds ?? [])]);
        return pickedIds.some((id) => !known.has(id)) ? pickedIds.join(',') : '';
    }, [loadedPicks, pickedIds]);

    useEffect(() => {
        if (!needsSavedSearches || savedSearchesRequested.current) return;
        savedSearchesRequested.current = true;
        setSavedSearches({ status: 'loading' });
        void savedSearchesService.list().then(({ data, error }) => {
            setSavedSearches(data ? { status: 'ready', data: data.savedSearches } : { status: 'error', error: error ?? 'savedSearchesLoadFailed' });
        });
    }, [needsSavedSearches, savedSearchesService]);

    useEffect(() => {
        if (!lookupKey) return undefined;
        let active = true;
        setPickedLoad({ status: 'loading' });
        const params = new URLSearchParams({ entryIds: lookupKey });
        authFetch(`/api/books/picked-entries?${params}`)
            .then(async (response) => {
                const next: BookSourceLoad<BookPickedEntries> = response.ok
                    ? { status: 'ready', data: await response.json() as BookPickedEntries }
                    : { status: 'error', error: await readApiErrorMessage(response, 'bookPickedLoadError') };
                if (active) setPickedLoad(next);
            })
            .catch((error: unknown) => {
                console.error('Picked book entries failed:', error);
                if (active) setPickedLoad({ status: 'error', error: 'bookPickedLoadError' });
            });
        return () => {
            active = false;
        };
    }, [authFetch, lookupKey]);

    const pickedEntries = useMemo<BookSourceLoad<BookPickedEntries>>(() => {
        if (pickedIds.length === 0) return { status: 'idle' };
        if (!loadedPicks || lookupKey) return pickedLoad.status === 'error' ? pickedLoad : { status: 'loading' };
        const current = new Set(pickedIds);
        return {
            status: 'ready',
            data: {
                entries: loadedPicks.entries.filter((entry) => current.has(entry.id)),
                missingIds: loadedPicks.missingIds.filter((id) => current.has(id)),
            },
        };
    }, [loadedPicks, lookupKey, pickedIds, pickedLoad]);

    return { savedSearches, pickedEntries };
}
