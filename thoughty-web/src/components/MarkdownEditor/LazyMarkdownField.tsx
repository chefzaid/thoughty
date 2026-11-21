import { Suspense, lazy, useCallback, useRef, type ComponentProps, type ReactNode } from 'react';
import type MarkdownEditor from './MarkdownEditor';
import MarkdownHelp from './MarkdownHelp';

const LazyMDEditor = lazy(() => import('./MarkdownEditor'));

interface FieldSelection {
    readonly start: number;
    readonly end: number;
    readonly direction: 'forward' | 'backward' | 'none';
}

interface LazyMarkdownFieldProps extends ComponentProps<typeof MarkdownEditor> {
    /** The plain textarea written in while the editor loads, with the same text and field props. */
    readonly fallback: ReactNode;
    /** The `@` suggestions, under whichever field is shown, kept open as the editor takes the fallback's place. */
    readonly suggestions: ReactNode;
    readonly theme?: 'light' | 'dark';
}

/**
 * Hands the writer's place from the fallback textarea to the editor's once the editor has loaded: a
 * writer typing in the fallback goes on typing in the editor, with the same caret or selection. The
 * editor's textarea would otherwise start unfocused with its caret at 0, so keystrokes went nowhere,
 * and the next one landed at the start of the text and closed a `@` suggestion list.
 */
function useFieldHandoff() {
    const handedOver = useRef<FieldSelection | null>(null);

    // The fallback's ref cleanup runs as it is removed, while it still holds the focus
    const fallbackRef = useCallback((wrapper: HTMLDivElement | null) => {
        if (!wrapper) return undefined;
        return () => {
            const field = wrapper.querySelector('textarea');
            handedOver.current = field && field === wrapper.ownerDocument.activeElement
                ? { start: field.selectionStart, end: field.selectionEnd, direction: field.selectionDirection }
                : null;
        };
    }, []);

    // Attached once the editor and its textarea are on the page
    const editorRef = useCallback((wrapper: HTMLDivElement | null) => {
        const selection = handedOver.current;
        handedOver.current = null;
        const field = wrapper?.querySelector('textarea');
        if (!selection || !field) return;
        field.focus({ preventScroll: true });
        field.setSelectionRange(selection.start, selection.end, selection.direction);
    }, []);

    return { fallbackRef, editorRef };
}

/** The Markdown editor of the composer and the entry editor, loaded on first use, with its help and `@` suggestions. */
export default function LazyMarkdownField({ fallback, suggestions, theme, t, ...editor }: LazyMarkdownFieldProps) {
    const handoff = useFieldHandoff();
    return (
        <>
            <div className="relative">
                <Suspense fallback={<div ref={handoff.fallbackRef}>{fallback}</div>}>
                    <div ref={handoff.editorRef} data-color-mode={theme === 'light' ? 'light' : 'dark'}>
                        <LazyMDEditor {...editor} t={t} />
                    </div>
                </Suspense>
                {suggestions}
            </div>
            <MarkdownHelp theme={theme} t={t} />
        </>
    );
}
