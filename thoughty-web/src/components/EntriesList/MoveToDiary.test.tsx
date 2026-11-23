import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Diary } from '../../types';
import { getTranslation } from '../../utils/translations';
import EntryDiaryField from './EntryDiaryField';
import EntryViewMode from './EntryViewMode';
import MoveToDiaryDialog from './MoveToDiaryDialog';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const tFr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

const diary = (id: number, name: string, icon: string, isDefault = false): Diary => ({
    id, userId: 1, name, icon, color: id === 2 ? '#22C55E' : null, visibility: 'private', isDefault, position: id,
    goalType: null, goalTarget: null, defaultTemplateId: null, isLocked: false, aiMode: 'on', createdAt: '2026-01-01T00:00:00.000Z',
});
const diaries = [diary(1, 'Work', '💼', true), diary(2, 'Travel', '✈️'), diary(3, 'Family', '🏠')];
const entry = { ...mockEntries[0]!, title: 'Packing list', diary_id: 1 };

function renderDialog(onMove = vi.fn().mockResolvedValue(true), onClose = vi.fn(), translate = t) {
    render(
        <MoveToDiaryDialog
            entry={entry}
            diaries={diaries}
            isDark={false}
            language="en"
            onMove={onMove}
            onClose={onClose}
            t={translate}
        />,
    );
    return { onMove, onClose };
}

describe('MoveToDiaryDialog', () => {
    it('names the diary the entry is in and offers only the others, focus on the first', () => {
        renderDialog();

        const dialog = screen.getByRole('dialog', { name: 'Move to diary' });
        expect(dialog).toHaveTextContent('Packing list');
        expect(dialog).toHaveTextContent('Now in 💼 Work');
        const choices = screen.getAllByRole('radio');
        expect(choices.map((choice) => choice.closest('label')?.textContent)).toEqual(['✈️ Travel', '🏠 Family']);
        expect(screen.getByRole('radio', { name: '✈️ Travel' })).toHaveFocus();
        expect(screen.getByRole('group', { name: 'Diaries' })).toBeInTheDocument();
    });

    it('moves the entry to the chosen diary with the keyboard and closes', async () => {
        const user = userEvent.setup();
        const { onMove, onClose } = renderDialog();

        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('radio', { name: '🏠 Family' })).toBeChecked();
        await user.keyboard('{Enter}');

        expect(onMove).toHaveBeenCalledWith(3);
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('asks for a diary before moving, and says so when the move fails', async () => {
        const user = userEvent.setup();
        const { onMove, onClose } = renderDialog(vi.fn().mockResolvedValue(false));

        await user.click(screen.getByRole('button', { name: 'Move' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Choose the diary to move the entry to.');
        expect(onMove).not.toHaveBeenCalled();

        await user.click(screen.getByRole('radio', { name: '✈️ Travel' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Move' }));

        expect(onMove).toHaveBeenCalledWith(2);
        expect(await screen.findByRole('alert')).toHaveTextContent('The entry could not be moved.');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes on Escape and on Cancel', async () => {
        const user = userEvent.setup();
        const { onClose } = renderDialog();

        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('speaks French', () => {
        renderDialog(vi.fn(), vi.fn(), tFr);

        expect(screen.getByRole('dialog', { name: 'Déplacer vers un journal' })).toHaveTextContent('Actuellement dans 💼 Work');
        expect(screen.getByRole('button', { name: 'Déplacer' })).toBeInTheDocument();
    });
});

describe('EntryViewMode Move to diary', () => {
    it('opens the picker from More actions, moves the entry and gives focus back to the menu button', async () => {
        const user = userEvent.setup();
        const onMoveToDiary = vi.fn().mockResolvedValue(true);
        render(<EntryViewMode {...createEntryViewModeProps({ entry, diaries, onMoveToDiary, t })} />);

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Move to diary…' }));
        await user.click(await screen.findByRole('radio', { name: '✈️ Travel' }));
        await user.click(screen.getByRole('button', { name: 'Move' }));

        expect(onMoveToDiary).toHaveBeenCalledWith(entry, 2, expect.any(Function));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus();
    });

    it('offers no move to a writer with a single diary', async () => {
        const user = userEvent.setup();
        render(<EntryViewMode {...createEntryViewModeProps({ entry, diaries: [diaries[0]!], onMoveToDiary: vi.fn(), t })} />);

        await user.click(screen.getByRole('button', { name: 'More actions' }));

        expect(screen.queryByRole('menuitem', { name: 'Move to diary…' })).not.toBeInTheDocument();
    });
});

function DiaryField({ initial, list = diaries }: Readonly<{ initial: number | null; list?: Diary[] }>) {
    const [value, setValue] = useState<number | null>(initial);
    return (
        <>
            <EntryDiaryField id="diary" diaries={list} value={value} onChange={setValue} selectClass="" t={t} />
            <output>{String(value)}</output>
        </>
    );
}

describe('EntryDiaryField', () => {
    it('starts on the entry’s diary and changes it', async () => {
        const user = userEvent.setup();
        render(<DiaryField initial={1} />);

        const field = screen.getByRole('combobox', { name: 'Diary' });
        expect(field).toHaveValue('1');
        await user.selectOptions(field, '✈️ Travel');

        expect(screen.getByRole('status')).toHaveTextContent('2');
    });

    it('shows the default diary for an entry saved before it had one', () => {
        render(<DiaryField initial={null} />);

        expect(screen.getByRole('combobox', { name: 'Diary' })).toHaveValue('1');
    });

    it('is left out for a writer with a single diary', () => {
        render(<DiaryField initial={1} list={[diaries[0]!]} />);

        expect(screen.queryByRole('combobox', { name: 'Diary' })).not.toBeInTheDocument();
    });
});
