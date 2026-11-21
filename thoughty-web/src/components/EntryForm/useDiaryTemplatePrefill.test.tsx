import { describe, it, expect, afterEach } from 'vitest';
import { useCallback, useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useDiaryTemplatePrefill } from './useDiaryTemplatePrefill';
import type { EntryTemplate } from '../../utils/entryTemplates';

const walk: EntryTemplate = { id: 'custom-1', name: 'Evening walk', content: 'Where I walked:', tags: [], visibility: 'private', format: 'plain' };

let pickDiary: (diary: string) => void = () => {};

/** A composer whose diary `walks` starts from a template, as the journal's is. */
function Composer() {
    const [diary, setDiary] = useState('work');
    const [text, setText] = useState('');
    const [filled, setFilled] = useState<string | null>(null);
    pickDiary = setDiary;
    const fill = useCallback((template: EntryTemplate | null) => {
        setText(template?.content ?? '');
        setFilled(template?.content ?? null);
    }, []);
    useDiaryTemplatePrefill({
        template: diary === 'walks' ? walk : null,
        scope: diary,
        enabled: true,
        empty: text === '',
        untouched: filled !== null && filled === text,
        fill,
    });
    return <textarea aria-label="composer" data-diary={diary} value={text} onChange={(event) => setText(event.target.value)} />;
}

/** Types at the caret's end as a keystroke does: the field's value changes, then its input event fires. */
function typeKey(field: HTMLTextAreaElement, key: string): void {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setValue.call(field, field.value + key);
    field.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('useDiaryTemplatePrefill', () => {
    afterEach(cleanup);

    it('never replaces a letter typed in the moment between picking the diary and its template arriving', async () => {
        render(<Composer />);
        const field = screen.getByLabelText<HTMLTextAreaElement>('composer');
        // As the browser runs it, outside act(): the picked diary renders in one task and React's passive
        // effects run in a later one, so a keystroke can come in between
        const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
        const wasActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
        try {
            const typed = new Promise<void>((resolve) => {
                // A mutation observer runs right after the render that shows the diary, before any later task
                const observer = new MutationObserver(() => {
                    observer.disconnect();
                    typeKey(field, 'x');
                    resolve();
                });
                observer.observe(field, { attributes: true, attributeFilter: ['data-diary'] });
            });
            pickDiary('walks');
            await typed;
            await new Promise((resolve) => setTimeout(resolve, 50));
        } finally {
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
        }
        await act(async () => {});

        expect(field.value).toBe('Where I walked:x');
    });

    it('starts an empty composer from the template and swaps it, untouched, for the next diary', () => {
        render(<Composer />);
        const field = screen.getByLabelText<HTMLTextAreaElement>('composer');

        act(() => pickDiary('walks'));
        expect(field.value).toBe('Where I walked:');
        act(() => pickDiary('work'));
        expect(field.value).toBe('');
    });
});
