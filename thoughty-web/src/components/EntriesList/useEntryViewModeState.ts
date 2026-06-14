import { useCallback, useEffect, useState as useLocalState } from 'react';
import type { RephraseMode } from '../../services/api/aiService';
import type { Entry, EntryBacklink, EntryRevision } from '../../types';

interface UseEntryViewModeStateParams {
    entry: Entry;
    onFetchHistory?: (entryId: number) => Promise<EntryRevision[]>;
    onFetchBacklinks?: (entryId: number) => Promise<EntryBacklink[]>;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onRephrase?: (entry: Entry, mode: RephraseMode) => Promise<void>;
}

export default function useEntryViewModeState({
    entry,
    onFetchHistory,
    onFetchBacklinks,
    onDeleteRevision,
    onRephrase,
}: Readonly<UseEntryViewModeStateParams>) {
    const [showHistory, setShowHistory] = useLocalState(false);
    const [revisions, setRevisions] = useLocalState<EntryRevision[]>([]);
    const [backlinks, setBacklinks] = useLocalState<EntryBacklink[]>([]);
    const [loadingHistory, setLoadingHistory] = useLocalState(false);
    const [loadingBacklinks, setLoadingBacklinks] = useLocalState(false);
    const [rephrasing, setRephrasing] = useLocalState(false);

    useEffect(() => {
        if (!onFetchBacklinks) {
            setBacklinks([]);
            return undefined;
        }

        let cancelled = false;
        setLoadingBacklinks(true);
        void onFetchBacklinks(entry.id)
            .then((data) => {
                if (!cancelled) {
                    setBacklinks(data);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingBacklinks(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [entry.id, onFetchBacklinks, setBacklinks, setLoadingBacklinks]);

    const handleToggleHistory = useCallback(async () => {
        if (showHistory) {
            setShowHistory(false);
            return;
        }

        if (!onFetchHistory) {
            return;
        }

        setLoadingHistory(true);
        try {
            const data = await onFetchHistory(entry.id);
            setRevisions(data);
        } finally {
            setLoadingHistory(false);
        }
        setShowHistory(true);
    }, [entry.id, onFetchHistory, setLoadingHistory, setRevisions, setShowHistory, showHistory]);

    const handleDeleteRevision = useCallback(async (revisionId: number) => {
        if (!onDeleteRevision) {
            return;
        }

        const success = await onDeleteRevision(entry.id, revisionId);
        if (success) {
            setRevisions((current) => current.filter((revision) => revision.id !== revisionId));
        }
    }, [entry.id, onDeleteRevision, setRevisions]);

    const handleRephrase = useCallback(async (mode: RephraseMode) => {
        if (!onRephrase) {
            return;
        }

        setRephrasing(true);
        try {
            await onRephrase(entry, mode);
        } finally {
            setRephrasing(false);
        }
    }, [entry, onRephrase, setRephrasing]);

    return {
        backlinks,
        handleDeleteRevision,
        handleRephrase,
        handleToggleHistory,
        loadingBacklinks,
        loadingHistory,
        rephrasing,
        revisions,
        showHistory,
    };
}
