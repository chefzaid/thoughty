import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entry } from '../../types';
import type { TimeCapsuleDraft } from '../../utils/timeCapsule';
import { getTranslation } from '../../utils/translations';
import { formatEntryDate } from '../../utils/entryDate';
import { useComposerSeed } from './useComposerSeed';

const t = (key: string) => getTranslation('en', key);

const packingList: Entry = {
    id: 9,
    date: '2024-05-01',
    title: 'Trip to Lyon',
    time_of_day: '07:30',
    mood: 4,
    content: 'Packing\n- [x] Socks ![Bag](attachment:3)\n- [ ] Charger',
    tags: ['travel'],
    visibility: 'public',
    format: 'plain',
};

const markdownNote: Entry = {
    id: 10,
    date: '2024-05-02T00:00:00.000Z',
    index: 2,
    content: 'The **old town** at dusk. Then dinner.\n\n## Later',
    tags: ['travel'],
    visibility: 'public',
    format: 'markdown',
};

interface HarnessProps {
    readonly initialText?: string;
    readonly defaultVisibility?: 'public' | 'private';
    /** Renders a second field in place of the first once the form is filled, as the Markdown editor does. */
    readonly swapFieldOnFill?: boolean;
    readonly language?: string;
}

function Harness({ initialText = '', defaultVisibility, swapFieldOnFill = false, language }: HarnessProps) {
    const formRef = useRef<HTMLDivElement>(null);
    const [newEntryText, setNewEntryText] = useState(initialText);
    const [title, setTitle] = useState(initialText ? 'Old title' : '');
    const [timeOfDay, setTimeOfDay] = useState('');
    const [mood, setMood] = useState<number | null>(null);
    const [feelings, setFeelings] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [timeCapsule, setTimeCapsule] = useState<TimeCapsuleDraft | null>(null);
    const [visibility, setVisibility] = useState<'public' | 'private' | null>('private');
    const [format, setFormat] = useState<'plain' | 'markdown'>('plain');
    const [selectedDate, setSelectedDate] = useState(new Date(2024, 0, 2));
    const [swapped, setSwapped] = useState(false);
    const { startFromEntry, replyToEntry, focusComposer, dialog } = useComposerSeed({
        composer: {
            newEntryText, setNewEntryText: (value) => {
                setNewEntryText(value);
                if (swapFieldOnFill) globalThis.setTimeout(() => setSwapped(true), 0);
            },
            title, setTitle, timeOfDay, setTimeOfDay, mood, setMood, feelings, setFeelings,
            tags, setTags, timeCapsule, setTimeCapsule, setVisibility, setFormat, setSelectedDate,
        },
        defaultVisibility,
        formRef,
        language,
        t,
    });

    return (
        <>
            <div ref={formRef}>
                {swapped
                    ? <textarea key="editor" aria-label="Editor" value={newEntryText} readOnly />
                    : <textarea key="field" aria-label="Writing" value={newEntryText} readOnly />}
            </div>
            <output data-testid="state">{JSON.stringify({ title, timeOfDay, mood, tags, visibility, format, timeCapsule })}</output>
            <output data-testid="date">{formatEntryDate(selectedDate)}</output>
            <button type="button" onClick={() => startFromEntry(packingList)}>Start</button>
            <button type="button" onClick={focusComposer}>Focus</button>
            <button type="button" onClick={() => startFromEntry({ ...packingList, sealed_until: '2030-01-01T00:00:00Z' })}>Sealed</button>
            <button type="button" onClick={() => replyToEntry(packingList)}>Reply</button>
            <button type="button" onClick={() => replyToEntry({ ...markdownNote, visibility: 'private' })}>Reply private</button>
            <button type="button" onClick={() => replyToEntry({ ...packingList, sealed_until: '2030-01-01T00:00:00Z' })}>Reply sealed</button>
            {dialog}
        </>
    );
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');

describe('useComposerSeed', () => {
    it('fills an empty form with the text, tags and format, the default visibility, and focuses it', async () => {
        const user = userEvent.setup();
        const scrollIntoView = vi.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoView;
        const { unmount } = render(<Harness defaultVisibility="private" />);

        await user.click(screen.getByRole('button', { name: 'Start' }));

        const field = screen.getByLabelText('Writing');
        expect(field).toHaveValue('Packing\n- [ ] Socks Bag\n- [ ] Charger');
        expect(field).toHaveFocus();
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
        expect(state()).toEqual({ title: '', timeOfDay: '', mood: null, tags: ['travel'], visibility: 'private', format: 'plain', timeCapsule: null });
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        unmount();
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    });

    it('focuses the form with its draft as it is, the caret at the end', async () => {
        const user = userEvent.setup();
        render(<Harness initialText="My own draft" />);

        await user.click(screen.getByRole('button', { name: 'Focus' }));

        const field = screen.getByLabelText<HTMLTextAreaElement>('Writing');
        expect(field).toHaveFocus();
        expect(field).toHaveValue('My own draft');
        expect(field.selectionStart).toBe('My own draft'.length);
        expect(state().title).toBe('Old title');
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('asks before replacing a draft, keeps it on Cancel and replaces it on confirm', async () => {
        const user = userEvent.setup();
        render(<Harness initialText="My own draft" defaultVisibility="public" />);

        await user.click(screen.getByRole('button', { name: 'Start' }));
        const dialog = screen.getByRole('alertdialog', { name: 'Replace your draft?' });
        expect(dialog).toHaveAccessibleDescription(/already holds a draft/);
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByLabelText('Writing')).toHaveValue('My own draft');
        expect(state().title).toBe('Old title');

        await user.click(screen.getByRole('button', { name: 'Start' }));
        await user.click(screen.getByRole('button', { name: 'Replace draft' }));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Writing')).toHaveValue('Packing\n- [ ] Socks Bag\n- [ ] Charger');
        expect(screen.getByLabelText('Writing')).toHaveFocus();
        expect(state()).toMatchObject({ title: '', tags: ['travel'], visibility: 'public' });
    });

    it('starts private without a default visibility and does nothing for a sealed time capsule', async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await user.click(screen.getByRole('button', { name: 'Sealed' }));
        expect(screen.getByLabelText('Writing')).toHaveValue('');
        expect(state().tags).toEqual([]);

        await user.click(screen.getByRole('button', { name: 'Start' }));
        expect(state().visibility).toBe('private');
    });

    it('moves focus to the field that replaces the focused one while the editor loads', async () => {
        render(<Harness swapFieldOnFill />);

        act(() => screen.getByRole('button', { name: 'Start' }).click());
        expect(screen.getByLabelText('Writing')).toHaveFocus();
        await act(async () => {
            await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
        });
        expect(screen.getByLabelText('Editor')).toHaveFocus();
    });

    it('writes a reply on today: a quote and a link, no tags, the default visibility, the caret at the end', async () => {
        const user = userEvent.setup();
        render(<Harness defaultVisibility="public" />);

        await user.click(screen.getByRole('button', { name: 'Reply' }));

        const field = screen.getByLabelText<HTMLTextAreaElement>('Writing');
        const reply = '“Packing” — [[2024-05-01#1]]\n\n';
        expect(field).toHaveValue(reply);
        expect(field).toHaveFocus();
        expect(field.selectionStart).toBe(reply.length);
        expect(screen.getByTestId('date')).toHaveTextContent(formatEntryDate(new Date()));
        expect(state()).toEqual({ title: '', timeOfDay: '', mood: null, tags: [], visibility: 'public', format: 'plain', timeCapsule: null });
    });

    it('quotes a Markdown entry as a blockquote, keeps a reply to a private entry private, and quotes in French', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<Harness defaultVisibility="public" />);

        await user.click(screen.getByRole('button', { name: 'Reply private' }));
        expect(screen.getByLabelText('Writing')).toHaveValue('> The old town at dusk.\n\n— [[2024-05-02#2]]\n\n');
        expect(state()).toMatchObject({ visibility: 'private', format: 'markdown', tags: [] });
        unmount();

        render(<Harness language="fr" />);
        await user.click(screen.getByRole('button', { name: 'Reply' }));
        expect(screen.getByLabelText('Writing')).toHaveValue('«\u00A0Packing\u00A0» — [[2024-05-01#1]]\n\n');
    });

    it('asks before a reply replaces a draft, saying what it writes, and never quotes a sealed time capsule', async () => {
        const user = userEvent.setup();
        render(<Harness initialText="My own draft" />);

        await user.click(screen.getByRole('button', { name: 'Reply sealed' }));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Writing')).toHaveValue('My own draft');

        await user.click(screen.getByRole('button', { name: 'Reply' }));
        const dialog = screen.getByRole('alertdialog', { name: 'Replace your draft?' });
        expect(dialog).toHaveAccessibleDescription(/short quote of this entry and a link to it, dated today/);
        await user.click(screen.getByRole('button', { name: 'Replace draft' }));
        expect(screen.getByLabelText('Writing')).toHaveValue('“Packing” — [[2024-05-01#1]]\n\n');
    });
});
