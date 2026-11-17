import { useState, type ReactNode } from 'react';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type { Entry, TranslationFunction } from '../../types';
import { useContentLock } from './contentLockContext';

/** The lock item of an entry's More actions menu. */
export interface EntryLockMenuAction {
    readonly label: string;
    /** An entry locked with its diary is unlocked from the diary, not here. */
    readonly disabled: boolean;
    readonly onSelect: () => void;
}

/**
 * Locking or unlocking one entry from its menu. Locking asks to confirm (it makes the entry private) and for a
 * first PIN when there is none; removing the lock asks for the PIN when the tab is not unlocked.
 */
export function useEntryLockAction(entry: Entry, theme: 'light' | 'dark' | undefined, t: TranslationFunction): {
    action?: EntryLockMenuAction;
    dialog: ReactNode;
} {
    const contentLock = useContentLock();
    const [confirming, setConfirming] = useState(false);
    if (!contentLock || entry.sealed_until) return { dialog: null };

    const lockedByDiary = Boolean(entry.diary_locked);
    const locked = Boolean(entry.is_locked);
    let label = t(locked ? 'entryUnlockAction' : 'entryLockAction');
    if (lockedByDiary && !locked) label = t('entryLockedWithDiary');

    return {
        action: {
            label,
            disabled: lockedByDiary && !locked,
            onSelect: () => {
                if (locked) void contentLock.setEntryLocked(entry.id, false);
                else setConfirming(true);
            },
        },
        dialog: (
            <ConfirmModal
                isOpen={confirming}
                onClose={() => setConfirming(false)}
                onConfirm={() => {
                    setConfirming(false);
                    void contentLock.setEntryLocked(entry.id, true);
                }}
                title={t('entryLockTitle')}
                message={t('entryLockMessage')}
                confirmLabel={t('entryLockConfirm')}
                theme={theme}
                t={t}
            />
        ),
    };
}
