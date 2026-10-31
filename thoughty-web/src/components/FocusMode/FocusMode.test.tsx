import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import { getTranslation } from '../../utils/translations';
import FocusMode from './FocusMode';
import FocusModeLauncher from './FocusModeLauncher';
import { MentionPeopleContext } from '../People/PeopleContext';
import type { Person } from '../../services/api';
import { peopleByHandle } from '../../utils/mentions';

const english = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const french = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

function ControlledFocusMode({ initialText = '', ...props }: Partial<ComponentProps<typeof FocusMode>> & { initialText?: string }) {
    const [text, setText] = useState(initialText);
    return <FocusMode text={text} onTextChange={setText} onClose={vi.fn()} t={english} {...props} />;
}

/** The goal's live region; the people suggestions have one of their own. */
const goalStatus = () => screen.getAllByRole('status').find((status) => status.classList.contains('focus-mode-reached'));

describe('FocusMode', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        document.body.style.overflow = '';
    });

    it('opens full screen with the draft focused at its end and the page behind it still', () => {
        render(<ControlledFocusMode initialText="Morning pages" />);

        const dialog = screen.getByRole('dialog', { name: 'Focus mode' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const text = screen.getByRole('textbox', { name: 'Entry text' });
        expect(text).toHaveFocus();
        expect((text as HTMLTextAreaElement).selectionStart).toBe('Morning pages'.length);
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('counts words live as the writer types', async () => {
        const user = userEvent.setup();
        render(<ControlledFocusMode />);

        expect(screen.getByText('0 words')).toBeInTheDocument();
        await user.type(screen.getByRole('textbox', { name: 'Entry text' }), 'One');
        expect(screen.getByText('1 word')).toBeInTheDocument();
        await user.type(screen.getByRole('textbox', { name: 'Entry text' }), ' two three');
        expect(screen.getByText('3 words')).toBeInTheDocument();
    });

    it('shows a quiet progress toward the session goal, counting only words added in this session', async () => {
        const user = userEvent.setup();
        render(<ControlledFocusMode initialText="Already here" />);

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        await user.type(screen.getByLabelText('Session goal in words'), '3');
        const progress = screen.getByRole('progressbar', { name: 'Progress toward the session goal' });
        expect(progress).toHaveAttribute('aria-valuenow', '0');
        expect(progress).toHaveAttribute('aria-valuetext', '0 of 3 words this session');
        expect(goalStatus()).toBeEmptyDOMElement();

        await user.type(screen.getByRole('textbox', { name: 'Entry text' }), ' and more');
        expect(progress).toHaveAttribute('aria-valuenow', '2');
        await user.type(screen.getByRole('textbox', { name: 'Entry text' }), ' words');
        expect(progress).toHaveAttribute('aria-valuenow', '3');
        expect(goalStatus()).toHaveTextContent('Session goal reached');
        expect(localStorage.getItem('thoughty.focusModeGoal')).toBe('3');
    });

    it('offers the last goal again, and forgets it when cleared', async () => {
        const user = userEvent.setup();
        localStorage.setItem('thoughty.focusModeGoal', '500');
        render(<ControlledFocusMode />);

        const goal = screen.getByLabelText('Session goal in words');
        expect(goal).toHaveValue(500);
        await user.clear(goal);
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(localStorage.getItem('thoughty.focusModeGoal')).toBeNull();
    });

    it('leaves with Esc, Done, or the shortcut', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<FocusMode text="Draft" onTextChange={vi.fn()} onClose={onClose} t={english} />);

        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Done' }));
        fireEvent.keyDown(screen.getByRole('textbox'), { key: 'f', ctrlKey: true, shiftKey: true });

        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('keeps the keyboard inside and journal shortcuts out', async () => {
        const user = userEvent.setup();
        const journalShortcut = vi.fn();
        document.addEventListener('keydown', journalShortcut);
        render(<ControlledFocusMode />);

        await user.tab();
        expect(screen.getByLabelText('Session goal in words')).toHaveFocus();
        await user.tab();
        expect(screen.getByLabelText('Timed sprint')).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('textbox', { name: 'Entry text' })).toHaveFocus();
        await user.keyboard('{ArrowLeft}');

        expect(journalShortcut.mock.calls.map(([event]) => (event as KeyboardEvent).key)).toEqual(['Tab', 'Tab', 'Tab', 'Tab']);
        document.removeEventListener('keydown', journalShortcut);
    });

    it('writes with the font settings and the theme', () => {
        render(<ControlledFocusMode theme="light" fontFamily="serif" fontSize={20} fontColor="#123456" />);

        expect(screen.getByRole('dialog')).toHaveClass('focus-mode', 'light');
        expect(screen.getByRole('textbox', { name: 'Entry text' })).toHaveStyle({
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '25px',
            color: 'rgb(18, 52, 86)',
        });
    });

    it('speaks French', () => {
        render(<ControlledFocusMode t={french} language="fr" initialText="Bonjour" />);

        expect(screen.getByRole('dialog', { name: 'Mode concentration' })).toBeInTheDocument();
        expect(screen.getByText('1 mot')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument();
        expect(screen.getByLabelText('Objectif de la séance en mots')).toBeInTheDocument();
    });
});

describe('FocusMode @ suggestions', () => {
    const person = (id: number, name: string, handle: string, entryCount: number): Person => ({
        id, name, handles: [handle], entryCount, lastMentionedOn: null, createdAt: '', updatedAt: '',
    });
    const people = [person(1, 'Marie', 'marie', 4), person(2, 'Martin', 'martin', 1)];

    function renderWithPeople(onClose = vi.fn()) {
        render(
            <MentionPeopleContext.Provider value={{ people, byHandle: peopleByHandle(people) }}>
                <ControlledFocusMode initialText="Lunch with" onClose={onClose} />
            </MentionPeopleContext.Provider>,
        );
        return screen.getByRole('textbox', { name: 'Entry text' }) as HTMLTextAreaElement;
    }

    it('offers people under the caret line like the composer, and writes the chosen one with the keyboard', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const text = renderWithPeople(onClose);

        await user.type(text, ' @ma');
        const list = screen.getByRole('listbox', { name: 'People to mention' });
        const options = within(list).getAllByRole('option');
        expect(options.map((option) => option.textContent)).toEqual(['Marie@marie4 entries', 'Martin@martin1 entry']);
        expect(text).toHaveAttribute('aria-autocomplete', 'list');
        expect(text).toHaveAttribute('aria-controls', list.id);
        expect(text).toHaveAttribute('aria-activedescendant', options[0]?.id);
        expect(screen.getByText(/^2 people to mention\. Up and down arrows/)).toHaveAttribute('role', 'status');
        expect(list.style.top).toMatch(/px$/);
        expect(list).not.toHaveClass('top-full');

        await user.keyboard('{ArrowDown}');
        expect(text).toHaveAttribute('aria-activedescendant', options[1]?.id);
        await user.keyboard('{Enter}');
        expect(text).toHaveValue('Lunch with @Martin ');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        // Escape closes the list and leaves focus mode open; Tab writes the person and keeps focus
        await user.type(text, 'and @mar');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        await user.type(text, 'i or @mari');
        await user.keyboard('{Tab}');
        expect(text).toHaveValue('Lunch with @Martin and @mari or @Marie ');
        expect(text).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('moves the list with the caret line as typewriter scrolling scrolls the text', async () => {
        const user = userEvent.setup();
        const text = renderWithPeople();

        await user.type(text, ' @ma');
        const list = screen.getByRole('listbox', { name: 'People to mention' });
        const top = Number.parseFloat(list.style.top);
        text.scrollTop = 120;
        fireEvent.scroll(text);
        expect(Number.parseFloat(list.style.top)).toBe(top - 120);
    });
});

describe('FocusModeLauncher', () => {
    function Composer() {
        const [text, setText] = useState('Started in the composer');
        return (
            <>
                <textarea aria-label="Composer" value={text} onChange={(event) => setText(event.target.value)} />
                <FocusModeLauncher text={text} onTextChange={setText} t={english} />
            </>
        );
    }

    it('opens focus mode on the same draft and keeps what was written after leaving', async () => {
        const user = userEvent.setup();
        render(<Composer />);

        const open = screen.getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' });
        await user.click(open);
        await user.type(screen.getByRole('textbox', { name: 'Entry text' }), ', finished here');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Composer')).toHaveValue('Started in the composer, finished here');
        expect(open).toHaveFocus();
    });
});
