import { useCallback, useEffect, useRef, useState } from 'react';
import { isPrivacyBlurShortcut, PRIVACY_BLUR_ATTRIBUTE } from './privacyBlur';

export interface PrivacyBlurState {
    /** Whether entry text is blurred. */
    readonly blurred: boolean;
    /** Whether the writer has turned it on or off since the page opened, so the change is announced. */
    readonly changed: boolean;
    readonly toggle: () => void;
    /** Shows entry text (lifts the blur) without asking again. */
    readonly show: () => void;
}

export interface PrivacyBlurGuard {
    /** Asked before the blur lifts (for the PIN of locked entries); the blur stays unless it resolves true. */
    readonly beforeShow?: () => Promise<boolean>;
    /** Told when the blur goes on (to lock locked entries again). */
    readonly onBlur?: () => void;
}

/**
 * The privacy blur of the signed-in app: off when the app opens, toggled by its button or by the shortcut
 * from anywhere (also while typing), and kept while moving between views. It marks `<html>`, so entry text
 * in dialogs is blurred too. With locked entries, lifting it asks for the PIN, and blurring again locks them.
 */
export function usePrivacyBlur(guard: PrivacyBlurGuard = {}): PrivacyBlurState {
    const [state, setState] = useState({ blurred: false, changed: false });
    const guardRef = useRef(guard);
    const blurredRef = useRef(false);
    useEffect(() => {
        guardRef.current = guard;
    });
    useEffect(() => {
        blurredRef.current = state.blurred;
    }, [state.blurred]);

    const show = useCallback(() => setState({ blurred: false, changed: true }), []);
    const toggle = useCallback(() => {
        if (!blurredRef.current) {
            setState({ blurred: true, changed: true });
            guardRef.current.onBlur?.();
            return;
        }
        const { beforeShow } = guardRef.current;
        if (!beforeShow) {
            show();
            return;
        }
        void beforeShow().then((allowed) => {
            if (allowed) show();
        });
    }, [show]);

    useEffect(() => {
        const root = document.documentElement;
        root.toggleAttribute(PRIVACY_BLUR_ATTRIBUTE, state.blurred);
        return () => root.removeAttribute(PRIVACY_BLUR_ATTRIBUTE);
    }, [state.blurred]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (!isPrivacyBlurShortcut(event)) {
                return;
            }
            event.preventDefault();
            if (!event.repeat) {
                toggle();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [toggle]);

    return { ...state, toggle, show };
}
