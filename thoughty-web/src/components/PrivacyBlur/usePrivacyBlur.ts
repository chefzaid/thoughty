import { useCallback, useEffect, useState } from 'react';
import { isPrivacyBlurShortcut, PRIVACY_BLUR_ATTRIBUTE } from './privacyBlur';

export interface PrivacyBlurState {
    /** Whether entry text is blurred. */
    readonly blurred: boolean;
    /** Whether the writer has turned it on or off since the page opened, so the change is announced. */
    readonly changed: boolean;
    readonly toggle: () => void;
}

/**
 * The privacy blur of the signed-in app: off when the app opens, toggled by its button or by the shortcut
 * from anywhere (also while typing), and kept while moving between views. It marks `<html>`, so entry text
 * in dialogs is blurred too.
 */
export function usePrivacyBlur(): PrivacyBlurState {
    const [state, setState] = useState({ blurred: false, changed: false });
    const toggle = useCallback(() => setState((current) => ({ blurred: !current.blurred, changed: true })), []);

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

    return { ...state, toggle };
}
