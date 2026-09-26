import { useCallback, useLayoutEffect, useRef } from 'react';

const MIN_HEIGHT = 76; // about three rows

/**
 * Grows a textarea with its content while still letting the user drag its
 * height: a manual resize becomes the new minimum, so typing never undoes it.
 */
export function useAutoGrowTextarea(value: string) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const autoHeightRef = useRef(0);
    const manualHeightRef = useRef(MIN_HEIGHT);

    useLayoutEffect(() => {
        const textarea = ref.current;
        if (!textarea) {
            return;
        }
        textarea.style.height = 'auto';
        const height = Math.max(textarea.scrollHeight, manualHeightRef.current);
        textarea.style.height = `${height}px`;
        autoHeightRef.current = height;
    }, [value]);

    const onPointerUp = useCallback(() => {
        const textarea = ref.current;
        if (textarea && textarea.offsetHeight !== autoHeightRef.current) {
            manualHeightRef.current = Math.max(textarea.offsetHeight, MIN_HEIGHT);
            autoHeightRef.current = textarea.offsetHeight;
        }
    }, []);

    return { ref, onPointerUp };
}
