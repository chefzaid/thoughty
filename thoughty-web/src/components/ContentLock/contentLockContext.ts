import { createContext, useContext } from 'react';

/** What the signed-in app knows and can do about the PIN lock, for the cards, menus and settings that use it. */
export interface ContentLockApi {
    readonly pinSet: boolean;
    readonly hasLockedContent: boolean;
    /** Whether this tab holds a live unlock. */
    readonly unlocked: boolean;
    /** Asks for the PIN; resolves true once unlocked. */
    readonly requestUnlock: () => Promise<boolean>;
    /** Asks for the PIN, then shows entry text again (lifts the privacy blur). */
    readonly unblur: () => Promise<void>;
    /** Ends the unlock, on the server too. */
    readonly lock: () => Promise<void>;
    /** Asks for a first PIN when there is none; resolves true once one is set. */
    readonly ensurePin: () => Promise<boolean>;
    /** Reads the state again (after the PIN changed in the profile). */
    readonly refresh: () => Promise<void>;
    /** Locks or unlocks an entry, asking for a PIN or the unlock first; resolves true once done. */
    readonly setEntryLocked: (entryId: number, locked: boolean) => Promise<boolean>;
    /** The same for a diary. */
    readonly setDiaryLocked: (diaryId: number, locked: boolean) => Promise<boolean>;
}

export const ContentLockContext = createContext<ContentLockApi | null>(null);

/** The PIN lock of the signed-in app, or null outside it (where nothing can be locked). */
export function useContentLock(): ContentLockApi | null {
    return useContext(ContentLockContext);
}
