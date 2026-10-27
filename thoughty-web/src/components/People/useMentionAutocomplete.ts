import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';

import type { Person } from '../../services/api/peopleService';
import { mentionText, suggestPeople, typedMention } from '../../utils/mentions';
import { useMentionPeople } from './PeopleContext';

interface TypedHandle {
    /** Where the `@` is. */
    readonly start: number;
    /** What follows it, up to the caret. */
    readonly query: string;
    readonly caret: number;
}

export interface MentionSuggestionList {
    readonly id: string;
    readonly items: ReadonlyArray<{ readonly person: Person; readonly handle: string }>;
    readonly active: number;
    readonly optionId: (index: number) => string;
    readonly onChoose: (index: number) => void;
    readonly onHover: (index: number) => void;
}

/**
 * `@` suggestions for a writing field: typing `@` and the start of a handle or name lists the
 * writer's people below the field. Up and Down move through them, Enter or Tab writes the chosen one
 * (`@Marie `), and Escape closes the list until the caret leaves that handle. The field keeps focus
 * throughout and points at the highlighted person with `aria-activedescendant`.
 *
 * The keys are read in the capture phase on a wrapper, before the Markdown editor's own Enter and Tab handling.
 */
export function useMentionAutocomplete(value: string, onChange: (value: string) => void) {
    const { people } = useMentionPeople();
    const id = useId();
    const [typed, setTyped] = useState<TypedHandle | null>(null);
    const [active, setActive] = useState(0);
    const [dismissedAt, setDismissedAt] = useState<number | null>(null);
    const typedRef = useRef<TypedHandle | null>(null);
    const fieldRef = useRef<HTMLTextAreaElement | null>(null);
    const pendingCaretRef = useRef<number | null>(null);

    const items = useMemo(
        () => (typed && typed.start !== dismissedAt ? suggestPeople(people, typed.query) : []),
        [dismissedAt, people, typed],
    );
    const open = items.length > 0;

    const track = useCallback((event: SyntheticEvent<HTMLTextAreaElement>) => {
        const field = event.currentTarget;
        fieldRef.current = field;
        const caret = field.selectionStart;
        const found = field.selectionEnd === caret ? typedMention(field.value, caret) : null;
        const previous = typedRef.current;
        if (!found) {
            typedRef.current = null;
            setTyped(null);
            setDismissedAt(null);
            return;
        }
        if (previous?.start === found.start && previous.query === found.query && previous.caret === caret) return;
        // A new handle, or more of it typed, starts from the best match again
        if (previous?.start !== found.start || previous.query !== found.query) setActive(0);
        const next = { ...found, caret };
        typedRef.current = next;
        setTyped(next);
        setDismissedAt((dismissed) => (found.start === dismissed ? dismissed : null));
    }, []);

    const close = useCallback(() => {
        typedRef.current = null;
        setTyped(null);
    }, []);

    const choose = useCallback((index: number) => {
        const item = items[index];
        if (!item || !typed) return;
        const after = value.slice(typed.caret);
        const mention = `@${mentionText(item.person, item.handle)}${/^\s/.test(after) ? '' : ' '}`;
        const before = value.slice(0, typed.start);
        pendingCaretRef.current = before.length + mention.length;
        close();
        onChange(`${before}${mention}${after}`);
    }, [close, items, onChange, typed, value]);

    // Text replaced from elsewhere (a template, the form cleared after saving) closes the list
    useEffect(() => {
        const current = typedRef.current;
        if (current && value.slice(current.start, current.caret) !== `@${current.query}`) close();
    }, [close, value]);

    // The caret goes after the mention once the field shows the new text
    useEffect(() => {
        const caret = pendingCaretRef.current;
        if (caret === null) return undefined;
        const timeoutId = globalThis.setTimeout(() => {
            pendingCaretRef.current = null;
            const field = fieldRef.current;
            field?.focus();
            field?.setSelectionRange(caret, caret);
        }, 0);
        return () => globalThis.clearTimeout(timeoutId);
    }, [value]);

    const onKeyDownCapture = useCallback((event: KeyboardEvent) => {
        if (!open || !typed || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowDown') {
            setActive((current) => (current + 1) % items.length);
        } else if (event.key === 'ArrowUp') {
            setActive((current) => (current - 1 + items.length) % items.length);
        } else if (event.key === 'Enter' || event.key === 'Tab') {
            choose(Math.min(active, items.length - 1));
        } else if (event.key === 'Escape') {
            setDismissedAt(typed.start);
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    }, [active, choose, items.length, open, typed]);

    const optionId = useCallback((index: number) => `${id}-option-${index}`, [id]);
    const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

    return {
        /** For the text field itself (a textarea, or the Markdown editor's `textareaProps`). */
        fieldProps: {
            onInput: track,
            onSelect: track,
            onKeyUp: track,
            onClick: track,
            onBlur: close,
            'aria-autocomplete': 'list' as const,
            'aria-controls': open ? `${id}-list` : undefined,
            'aria-activedescendant': open ? optionId(activeIndex) : undefined,
        },
        /** For the element around the field and the list. */
        wrapperProps: { onKeyDownCapture },
        suggestions: open
            ? { id: `${id}-list`, items, active: activeIndex, optionId, onChoose: choose, onHover: setActive } satisfies MentionSuggestionList
            : null,
    };
}
