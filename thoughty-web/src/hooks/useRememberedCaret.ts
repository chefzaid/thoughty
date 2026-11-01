import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';

export interface TextSelection {
    readonly start: number;
    readonly end: number;
}

/** A selection past any text: `insertAtSelection` clamps it to the end. */
export const END_OF_TEXT: TextSelection = { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };

/**
 * Where the writer left the caret in the writing field inside `fieldRef` (any editor: the plain
 * textarea or the Markdown editor's), from their own typing and clicks only: re-rendering the editor
 * (attaching a file, for one) can move the field's selection back to its start without them.
 * `selection()` is the live caret while the field has focus, else the remembered one, else the end.
 */
export function useRememberedCaret(fieldRef: RefObject<HTMLElement | null>) {
    const lastCaret = useRef<TextSelection | null>(null);

    useEffect(() => {
        const wrapper = fieldRef.current;
        if (!wrapper) return undefined;
        const remember = (event: Event) => {
            if (event.target instanceof HTMLTextAreaElement) {
                lastCaret.current = { start: event.target.selectionStart, end: event.target.selectionEnd };
            }
        };
        const events = ['keyup', 'mouseup', 'input'];
        for (const name of events) wrapper.addEventListener(name, remember, true);
        return () => {
            for (const name of events) wrapper.removeEventListener(name, remember, true);
        };
    }, [fieldRef]);

    const field = useCallback((): HTMLTextAreaElement | null => fieldRef.current?.querySelector('textarea') ?? null, [fieldRef]);

    const selection = useCallback((): TextSelection => {
        const area = field();
        if (area && document.activeElement === area) return { start: area.selectionStart, end: area.selectionEnd };
        return lastCaret.current ?? END_OF_TEXT;
    }, [field]);

    /** Records a caret the app placed itself (after inserting text), as if the writer had left it there. */
    const remember = useCallback((caret: number) => {
        lastCaret.current = { start: caret, end: caret };
    }, []);

    return useMemo(() => ({ field, selection, remember }), [field, remember, selection]);
}
