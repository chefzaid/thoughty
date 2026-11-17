import { useEffect, useRef } from 'react';

/** An unlock ends after this long without the writer doing anything in the tab. */
export const CONTENT_UNLOCK_IDLE_MS = 15 * 60 * 1000;
/** While active, the server's own idle clock is kept in step at most this often. */
const KEEP_ALIVE_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

interface IdleLockOptions {
    readonly active: boolean;
    readonly onIdle: () => void;
    /** Called on activity at most every five minutes, so the server sees it too. */
    readonly onActive: () => void;
}

/**
 * Locks again once the writer has done nothing in the tab for 15 minutes: no key, click, touch or scroll
 * wheel. The server ends an unlock after 15 minutes without a request on its own; activity tells it.
 */
export function useIdleLock({ active, onIdle, onActive }: IdleLockOptions): void {
    const callbacks = useRef({ onIdle, onActive });
    useEffect(() => {
        callbacks.current = { onIdle, onActive };
    }, [onIdle, onActive]);

    useEffect(() => {
        if (!active) return undefined;
        let timer = globalThis.setTimeout(() => callbacks.current.onIdle(), CONTENT_UNLOCK_IDLE_MS);
        let lastKeptAlive = Date.now();
        const handleActivity = () => {
            globalThis.clearTimeout(timer);
            timer = globalThis.setTimeout(() => callbacks.current.onIdle(), CONTENT_UNLOCK_IDLE_MS);
            if (Date.now() - lastKeptAlive >= KEEP_ALIVE_MS) {
                lastKeptAlive = Date.now();
                callbacks.current.onActive();
            }
        };
        for (const type of ACTIVITY_EVENTS) globalThis.addEventListener(type, handleActivity, { passive: true });
        return () => {
            globalThis.clearTimeout(timer);
            for (const type of ACTIVITY_EVENTS) globalThis.removeEventListener(type, handleActivity);
        };
    }, [active]);
}
