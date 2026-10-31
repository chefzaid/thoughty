import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entry } from '../../types';
import type { TimeCapsuleDraft } from '../../utils/timeCapsule';
import { getTranslation } from '../../utils/translations';
import { useStartFromEntry } from './useStartFromEntry';

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

interface HarnessProps {
    readonly initialText?: string;
    readonly defaultVisibility?: 'public' | 'private';
    /** Renders a second field in place of the first once the form is filled, as the Markdown editor does. */
    readonly swapFieldOnFill?: boolean;
}

function Harness({ initialText = '', defaultVisibility, swapFieldOnFill = false }: HarnessProps) {
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
    const [swapped, setSwapped] = useState(false);
    const { startFromEntry, dialog } = useStartFromEntry({
        composer: {
            newEntryText, setNewEntryText: (value) => {
                setNewEntryText(value);
                if (swapFieldOnFill) globalThis.setTimeout(() => setSwapped(true), 0);
            },
            title, setTitle, timeOfDay, setTimeOfDay, mood, setMood, feelings, setFeelings,
            tags, setTags, timeCapsule, setTimeCapsule, setVisibility, setFormat,
        },
        defaultVisibility,
        formRef,
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
            <button type="button" onClick={() => startFromEntry(packingList)}>Start</button>
            <button type="button" onClick={() => startFromEntry({ ...packingList, sealed_until: '2030-01-01T00:00:00Z' })}>Sealed</button>
            {dialog}
        </>
    );
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');

describe('useStartFromEntry', () => {
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
});
