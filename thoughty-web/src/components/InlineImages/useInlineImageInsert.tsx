import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Attachment, TranslationFunction } from '../../types';
import { isImageAttachment } from '../../utils/attachments';
import { inlineImageMarkdown, insertAtSelection } from '../../utils/inlineImages';
import InsertImageDialog, { type InlineImageCandidate } from './InsertImageDialog';

/** The picture an attachment card asks to place: a picked file by its position, or a stored attachment. */
export type InlineImageTarget = { readonly pending: number } | { readonly attachment: number };

interface InlineImageInsertOptions {
    readonly text: string;
    readonly setText: Dispatch<SetStateAction<string>>;
    readonly pendingFiles: readonly File[];
    readonly attachments: readonly Attachment[];
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
}

function candidatesOf(pendingFiles: readonly File[], attachments: readonly Attachment[]): InlineImageCandidate[] {
    return [
        ...attachments
            .filter((attachment) => isImageAttachment(attachment.mimetype))
            .map((attachment) => ({ key: `attachment-${attachment.id}`, name: attachment.original_filename, target: attachment.id })),
        ...pendingFiles.flatMap((file, index) => (isImageAttachment(file.type)
            ? [{ key: `pending-${index}`, name: file.name, target: file.name }]
            : [])),
    ];
}

/**
 * "Insert image" for a Markdown writing field: the toolbar button and the attachment cards open a
 * dialog asking which picture and its alt text, and the reference goes where the caret was. The
 * field is found inside `fieldRef`, the element around the editor, so any editor works.
 */
export function useInlineImageInsert({ text, setText, pendingFiles, attachments, theme, t }: InlineImageInsertOptions) {
    const fieldRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const selection = useRef({ start: text.length, end: text.length });
    const pendingCaret = useRef<number | null>(null);
    const [initialKey, setInitialKey] = useState<string | null | undefined>(undefined);
    const candidates = useMemo(() => candidatesOf(pendingFiles, attachments), [attachments, pendingFiles]);

    const lastCaret = useRef<{ start: number; end: number } | null>(null);

    // Where the writer left the caret, from their own typing and clicks only: re-rendering the editor
    // (attaching a file, for one) can move the field's selection back to its start without them.
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
    }, []);

    const open = useCallback((target?: InlineImageTarget) => {
        const field = fieldRef.current?.querySelector('textarea') ?? null;
        textareaRef.current = field;
        // The caret as it is when the field has focus, else where the writer left it, else the end
        const live = field && document.activeElement === field ? { start: field.selectionStart, end: field.selectionEnd } : null;
        selection.current = live ?? lastCaret.current ?? { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };
        if (!target) {
            setInitialKey(null);
        } else {
            setInitialKey('pending' in target ? `pending-${target.pending}` : `attachment-${target.attachment}`);
        }
    }, []);

    const close = useCallback(() => setInitialKey(undefined), []);

    const insert = useCallback((candidate: InlineImageCandidate, alt: string) => {
        const { text: next, caret } = insertAtSelection(text, selection.current, inlineImageMarkdown(candidate.target, alt));
        pendingCaret.current = caret;
        lastCaret.current = { start: caret, end: caret };
        setText(next);
        setInitialKey(undefined);
    }, [setText, text]);

    // The caret goes after the picture once the field shows the new text
    useEffect(() => {
        const caret = pendingCaret.current;
        if (caret === null) return undefined;
        const timeoutId = globalThis.setTimeout(() => {
            pendingCaret.current = null;
            const field = textareaRef.current;
            field?.focus();
            field?.setSelectionRange(caret, caret);
        }, 0);
        return () => globalThis.clearTimeout(timeoutId);
    }, [text]);

    const dialog = initialKey === undefined ? null : (
        <InsertImageDialog
            candidates={candidates}
            initialKey={initialKey}
            theme={theme}
            t={t}
            onCancel={close}
            onInsert={insert}
            returnFocusRef={textareaRef}
        />
    );

    return { fieldRef, open, dialog };
}
