import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useRememberedCaret, type TextSelection } from '../../hooks/useRememberedCaret';
import type { TranslationFunction } from '../../types';
import { insertAtSelection } from '../../utils/inlineImages';
import { resolveLanguage } from '../../utils/language';
import { mutedTextClass, tintedTextClass } from '../../utils/tintedText';
import DictationButton from './DictationButton';
import { dictatedSnippet } from './speechRecognition';
import { useDictation } from './useDictation';

interface DictationFieldOptions {
    /** The element around the writing field; its textarea (plain or the Markdown editor's) is found inside. */
    readonly fieldRef: RefObject<HTMLElement | null>;
    readonly text: string;
    readonly setText: (text: string) => void;
    /** The app language; speech is recognized in it. */
    readonly language?: string;
    readonly theme?: 'light' | 'dark';
    /** The toggle's class in place of the toolbar look. */
    readonly buttonClassName?: string;
    readonly t: TranslationFunction;
}

function clampSelection(selection: TextSelection, length: number): TextSelection {
    const start = Math.max(0, Math.min(selection.start, length));
    return { start, end: Math.max(start, Math.min(selection.end, length)) };
}

/**
 * Live dictation for a writing field: `button` is the microphone toggle and `preview` the quiet line
 * under the field with the words still being recognized (blurred with the entry text) and any error.
 * Each final phrase goes in at the caret (or replaces the selection), and the caret moves after it.
 * Both are null where the browser has no speech recognition, so nothing shows there.
 */
export function useDictationField({ fieldRef, text, setText, language, theme, buttonClassName, t }: DictationFieldOptions) {
    const caret = useRememberedCaret(fieldRef);
    const textRef = useRef(text);
    textRef.current = text;
    // Where the last phrase ended, until the field shows it (phrases can follow each other faster)
    const pendingCaret = useRef<number | null>(null);

    const insert = useCallback((transcript: string) => {
        const current = textRef.current;
        const pending = pendingCaret.current;
        const selection = clampSelection(pending === null ? caret.selection() : { start: pending, end: pending }, current.length);
        const snippet = dictatedSnippet(current.slice(0, selection.start), current.slice(selection.end), transcript);
        if (!snippet) return;
        const { text: next, caret: placed } = insertAtSelection(current, selection, snippet);
        textRef.current = next;
        pendingCaret.current = placed;
        caret.remember(placed);
        setText(next);
    }, [caret, setText]);

    const dictation = useDictation({ language: resolveLanguage(language), onFinal: insert });

    // The caret goes after the words once the field shows them, while the writer is in the field
    useEffect(() => {
        const placed = pendingCaret.current;
        if (placed === null) return undefined;
        const timeoutId = globalThis.setTimeout(() => {
            pendingCaret.current = null;
            const field = caret.field();
            if (field && document.activeElement === field) field.setSelectionRange(placed, placed);
        }, 0);
        return () => globalThis.clearTimeout(timeoutId);
    }, [caret, text]);

    // Writing starts where the caret was: focus goes back to the field, the caret where it was left
    const start = useCallback(() => {
        const field = caret.field();
        const selection = clampSelection(caret.selection(), field?.value.length ?? 0);
        dictation.start();
        if (field) {
            field.focus();
            field.setSelectionRange(selection.start, selection.end);
        }
    }, [caret, dictation]);

    if (!dictation.supported) return { button: null, preview: null };

    const button = (
        <DictationButton
            listening={dictation.listening}
            announcement={dictation.announcement}
            onStart={start}
            onStop={dictation.stop}
            theme={theme}
            className={buttonClassName}
            t={t}
        />
    );

    const showPreview = dictation.listening || dictation.error !== null;
    const preview = showPreview ? (
        <div className="dictation-preview mt-1 text-sm" data-dictation-preview="">
            {dictation.listening && (
                <p className={`italic ${mutedTextClass(theme !== 'light')}`} aria-hidden="true">
                    <span className="codicon codicon-mic-filled mr-1 align-middle" aria-hidden="true" />
                    {dictation.interim
                        ? <span className="privacy-text" data-dictation-interim="">{dictation.interim}</span>
                        : t('dictationListening')}
                </p>
            )}
            {dictation.error && (
                <p role="alert" className={tintedTextClass('red', theme)}>{t(dictation.error)}</p>
            )}
        </div>
    ) : null;

    return { button, preview };
}
