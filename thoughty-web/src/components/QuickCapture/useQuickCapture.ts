import { useCallback, useRef, useState } from 'react';

import type { Notifier } from '../../hooks/useAppNotice';
import type { createEntriesService } from '../../services/api/entriesService';
import { writersToday } from '../../utils/entryDate';

interface QuickCaptureOptions {
    readonly entriesService: Pick<ReturnType<typeof createEntriesService>, 'createEntry'>;
    /** Says the entry was saved, with a link to it, in the app's notice toast. */
    readonly notifier: Notifier;
    /** Runs after a save, so the journal and the views measured from it read the new entry. */
    readonly onSaved: () => void;
    /** The address of an entry in the journal (its permalink). */
    readonly entryPath: (entryId: number) => string;
    /** Shows a saved entry in the journal. */
    readonly onOpenEntry: (entryId: number) => void;
    /** Carries the text to the journal's composer, where the writer goes on with every field at hand. */
    readonly onOpenInFull: (text: string) => void;
}

export interface QuickCaptureState {
    readonly isOpen: boolean;
    readonly text: string;
    readonly setText: (text: string) => void;
    readonly saving: boolean;
    /** A translation key (or the API's message) when the text is empty or could not be saved; empty otherwise. */
    readonly error: string;
    readonly open: () => void;
    /** Closes the box; the text stays for the next time it opens. */
    readonly close: () => void;
    readonly save: () => Promise<void>;
    readonly openInFull: () => void;
}

/**
 * Quick capture: a one-line box, open on any page of the signed-in app, whose text is saved as a
 * private plain entry for the writer's own today in the default diary (the API's choice when no diary
 * is sent), through the same `POST /api/entries` as the composer. A failed save keeps the text.
 */
export function useQuickCapture({
    entriesService,
    notifier,
    onSaved,
    entryPath,
    onOpenEntry,
    onOpenInFull,
}: QuickCaptureOptions): QuickCaptureState {
    const [isOpen, setIsOpen] = useState(false);
    const [text, setText] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const savingRef = useRef(false);

    const open = useCallback(() => {
        setError('');
        setIsOpen(true);
    }, []);
    const close = useCallback(() => setIsOpen(false), []);

    const save = useCallback(async () => {
        const entryText = text.trim();
        if (!entryText) {
            setError('entryTextRequired');
            return;
        }
        if (savingRef.current) {
            return;
        }

        savingRef.current = true;
        setSaving(true);
        setError('');
        const result = await entriesService.createEntry({
            text: entryText,
            tags: [],
            date: writersToday(),
            visibility: 'private',
            format: 'plain',
            diaryId: null,
        });
        savingRef.current = false;
        setSaving(false);

        const { entryId } = result;
        if (!result.success || !entryId) {
            setError(result.error || 'entrySaveFailed');
            return;
        }

        setText('');
        setIsOpen(false);
        onSaved();
        notifier.notify(notifier.t('quickCaptureSaved'), {
            label: notifier.t('quickCaptureViewEntry'),
            href: entryPath(entryId),
            run: () => onOpenEntry(entryId),
        });
    }, [entriesService, entryPath, notifier, onOpenEntry, onSaved, text]);

    const openInFull = useCallback(() => {
        const carried = text.trim();
        setText('');
        setError('');
        setIsOpen(false);
        onOpenInFull(carried);
    }, [onOpenInFull, text]);

    return { isOpen, text, setText, saving, error, open, close, save, openInFull };
}
