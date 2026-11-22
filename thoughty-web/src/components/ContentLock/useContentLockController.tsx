import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { JOURNAL_ENTRY_QUERY_KEYS } from '../../hooks/useEntriesState';
import {
    createContentLockService,
    getContentUnlockToken,
    setContentUnlockToken,
    subscribeContentUnlockToken,
    type ContentLockStatus,
} from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import PinSetDialog from './PinSetDialog';
import PinUnlockDialog from './PinUnlockDialog';
import { useIdleLock } from './useIdleLock';
import type { ContentLockApi } from './contentLockContext';

const CONTENT_LOCK_QUERY_KEY = ['app', 'content-lock'] as const;
const DIARIES_QUERY_KEY = ['app', 'diaries'] as const;
/** Settings the app needs to draw itself: kept when an unlock ends, unlike everything entries hold. */
const KEPT_ON_LOCK = new Set(['config', 'diaries', 'feature-flags', 'profile-stats', 'content-lock']);
const holdsEntryContent = ({ queryKey }: { queryKey: readonly unknown[] }) =>
    !(queryKey[0] === 'app' && KEPT_ON_LOCK.has(String(queryKey[1])));

/** The controller's side of the API; the layout adds `unblur`, which also lifts the privacy blur. */
export type ContentLockControllerApi = Omit<ContentLockApi, 'unblur'>;

type Pending = { kind: 'unlock' | 'set'; resolve: (done: boolean) => void };

interface ControllerOptions {
    readonly isDark: boolean;
    readonly language: Language;
    readonly t: TranslationFunction;
}

/**
 * The PIN lock of the signed-in app: its state from the API, the unlock this tab holds, the PIN dialogs, and
 * the lock changes. Each change of the unlock moves `epoch` on, so the views read again with or without it
 * (and drop what an ended unlock showed); 15 minutes without activity end it (`useIdleLock`).
 */
export function useContentLockController({ isDark, language, t }: ControllerOptions) {
    const service = useAuthenticatedService(createContentLockService);
    const queryClient = useQueryClient();
    const { getAccessToken } = useAuth();
    const [unlocked, setUnlocked] = useState(() => getContentUnlockToken() !== null);
    const [epoch, setEpoch] = useState(0);
    const [pending, setPending] = useState<Pending | null>(null);
    const pendingRef = useRef<Pending | null>(null);

    const status = useQuery({
        queryKey: CONTENT_LOCK_QUERY_KEY,
        queryFn: async (): Promise<ContentLockStatus | null> => (await service.status()).data,
    });
    const refresh = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: CONTENT_LOCK_QUERY_KEY });
    }, [queryClient]);

    useEffect(() => subscribeContentUnlockToken((token) => {
        setUnlocked(token !== null);
        setEpoch((current) => current + 1);
        // A session that ended took the unlock and the whole cache with it (`useSessionQueryClient`): nothing reads again
        if (getAccessToken() === null) return;
        // What the ended unlock showed leaves the cache at once; with a new one, everything reads again
        void (token === null ? queryClient.resetQueries({ predicate: holdsEntryContent }) : queryClient.invalidateQueries());
    }), [getAccessToken, queryClient]);

    // The server ended the unlock (15 minutes without a request): the tab lets go of it too
    const serverUnlocked = status.data?.unlocked;
    const statusReadAt = status.dataUpdatedAt;
    useEffect(() => {
        if (serverUnlocked === false && getContentUnlockToken() !== null) setContentUnlockToken(null);
    }, [serverUnlocked, statusReadAt]);

    const lock = useCallback(async () => {
        if (getContentUnlockToken() === null) return;
        await service.lock();
        setContentUnlockToken(null);
    }, [service]);

    useIdleLock({ active: unlocked, onIdle: lock, onActive: refresh });

    const ask = useCallback((kind: Pending['kind']) => new Promise<boolean>((resolve) => {
        pendingRef.current?.resolve(false);
        const next = { kind, resolve };
        pendingRef.current = next;
        setPending(next);
    }), []);
    const finish = useCallback((done: boolean) => {
        pendingRef.current?.resolve(done);
        pendingRef.current = null;
        setPending(null);
    }, []);

    const unlockWith = useCallback(async (pin: string): Promise<string | null> => {
        const result = await service.unlock(pin);
        if (result.data) {
            setContentUnlockToken(result.data.token);
            finish(true);
            return null;
        }
        const latest = (await service.status()).data;
        queryClient.setQueryData(CONTENT_LOCK_QUERY_KEY, latest);
        if (result.error === 'apiError_CONTENT_PIN_BLOCKED' && latest?.blockedUntil) {
            const time = new Date(latest.blockedUntil).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
            return t('pinBlocked', { time });
        }
        if (result.error === 'apiError_CONTENT_PIN_INCORRECT' && latest) {
            return t('pinWrong', { count: latest.attemptsLeft });
        }
        return t(result.error ?? 'pinUnlockFailed');
    }, [finish, language, queryClient, service, t]);

    const saveFirstPin = useCallback(async (pin: string): Promise<string | null> => {
        const result = await service.setPin(pin);
        if (result.data && 'success' in result.data) {
            await refresh();
            finish(true);
            return null;
        }
        return t(result.error ?? 'pinSaveFailed');
    }, [finish, refresh, service, t]);

    const requestUnlock = useCallback(async () => (getContentUnlockToken() !== null ? true : ask('unlock')), [ask]);
    const pinSet = status.data?.pinSet ?? false;
    const ensurePin = useCallback(async () => (pinSet ? true : ask('set')), [ask, pinSet]);

    const afterLockChange = useCallback(async () => {
        await Promise.all([
            refresh(),
            queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY }),
            ...JOURNAL_ENTRY_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        ]);
    }, [queryClient, refresh]);

    // Locking needs a PIN; lifting a lock needs the unlock
    const changeLock = useCallback(async (locked: boolean, send: () => Promise<{ data: unknown }>) => {
        if (!(locked ? await ensurePin() : await requestUnlock())) return false;
        const done = Boolean((await send()).data);
        if (done) await afterLockChange();
        return done;
    }, [afterLockChange, ensurePin, requestUnlock]);

    const api = useMemo((): ContentLockControllerApi => ({
        pinSet,
        hasLockedContent: status.data?.hasLockedContent ?? false,
        unlocked,
        requestUnlock,
        lock,
        ensurePin,
        refresh,
        setEntryLocked: (entryId: number, locked: boolean) => changeLock(locked, () => service.setEntryLocked(entryId, locked)),
        setDiaryLocked: (diaryId: number, locked: boolean) => changeLock(locked, () => service.setDiaryLocked(diaryId, locked)),
    }), [changeLock, ensurePin, lock, pinSet, refresh, requestUnlock, service, status.data?.hasLockedContent, unlocked]);

    let dialog: ReactNode = null;
    if (pending?.kind === 'unlock') {
        dialog = <PinUnlockDialog isDark={isDark} onUnlock={unlockWith} onClose={() => finish(false)} t={t} />;
    } else if (pending?.kind === 'set') {
        dialog = <PinSetDialog isDark={isDark} onSave={saveFirstPin} onClose={() => finish(false)} t={t} />;
    }

    return { api, epoch, dialog };
}
