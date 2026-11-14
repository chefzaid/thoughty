import { useCallback, useLayoutEffect, useRef } from 'react';

const MIN_HEIGHT = 76; // about three rows

/**
 * Grows a textarea with its content while still letting the user drag its
 * height: a manual resize becomes the new minimum, so typing never undoes it.
 * A `max-height` on the textarea caps it, and it scrolls inside from there.
 * `isShown` remeasures a textarea that comes back with the same text (a dialog
 * opened again).
 */
export function useAutoGrowTextarea(value: string, isShown = true) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const autoHeightRef = useRef(0);
    const manualHeightRef = useRef(MIN_HEIGHT);

    useLayoutEffect(() => {
        const textarea = ref.current;
        if (!textarea) {
            return;
        }
        textarea.style.height = 'auto';
        // The height includes the border (border-box) and scrollHeight does not: without it the text
        // overflows by the border's width and the textarea scrolls by a pixel or two.
        const border = textarea.offsetHeight - textarea.clientHeight;
        const height = Math.max(textarea.scrollHeight + border, manualHeightRef.current);
        textarea.style.height = `${height}px`;
        autoHeightRef.current = height;
    }, [value, isShown]);

    const onPointerUp = useCallback(() => {
        const textarea = ref.current;
        if (textarea && textarea.offsetHeight !== autoHeightRef.current) {
            manualHeightRef.current = Math.max(textarea.offsetHeight, MIN_HEIGHT);
            autoHeightRef.current = textarea.offsetHeight;
        }
    }, []);

    return { ref, onPointerUp };
}
