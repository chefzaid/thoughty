import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation, type Language } from '../../utils/translations';
import DiaryManager from './DiaryManager';

const diaries = [
    { id: 1, name: 'Personal', icon: '📓', color: '#E76F51', is_default: true, visibility: 'private' as const },
    { id: 2, name: 'Work', icon: '💼', color: '#2A9D8F', visibility: 'public' as const, goalType: 'entries_per_week' as const, goalTarget: 3 },
];

const renderManager = (language: Language = 'en') => {
    const props = {
        diaries,
        onCreateDiary: vi.fn().mockResolvedValue(undefined),
        onUpdateDiary: vi.fn().mockResolvedValue(undefined),
        onDeleteDiary: vi.fn(),
        onSetDefault: vi.fn(),
        onReorderDiaries: vi.fn(),
        onBack: vi.fn(),
        theme: 'light' as const,
        language,
        t: (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params),
    };
    render(<DiaryManager {...props} />);
    return props;
};

describe('DiaryManager writing goals', () => {
    it.each([
        ['en', 'Goal: 3 entries a week'],
        ['fr', 'Objectif : 3 entrées par semaine'],
    ] as const)('shows each diary’s goal in %s', (language, summary) => {
        renderManager(language);

        expect(screen.getByText(summary)).toBeInTheDocument();
        expect(screen.getAllByText(/Goal:|Objectif :/)).toHaveLength(1);
    });

    it('creates a diary with a words-per-day goal, starting from the lowest target', async () => {
        const user = userEvent.setup();
        const props = renderManager();

        await user.type(screen.getByPlaceholderText('Diary Name'), 'Morning pages');
        await user.selectOptions(screen.getByLabelText('Writing goal'), 'words_per_day');
        const target = screen.getByRole('spinbutton', { name: 'Goal target' });
        expect(target).toHaveValue(10);
        expect(target).toHaveAttribute('max', '10000');
        await user.clear(target);
        await user.type(target, '750');
        await user.click(screen.getByRole('button', { name: 'Create Diary' }));

        expect(props.onCreateDiary).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Morning pages', goalType: 'words_per_day', goalTarget: 750,
        }));
        expect(screen.getByLabelText('Writing goal')).toHaveValue('');
    });

    it('refuses a target outside the goal’s bounds', async () => {
        const user = userEvent.setup();
        const props = renderManager();

        await user.type(screen.getByPlaceholderText('Diary Name'), 'Work log');
        await user.selectOptions(screen.getByLabelText('Writing goal'), 'entries_per_week');
        const target = screen.getByRole('spinbutton', { name: 'Goal target' });
        await user.clear(target);
        await user.type(target, '60');
        await user.click(screen.getByRole('button', { name: 'Create Diary' }));

        expect(props.onCreateDiary).not.toHaveBeenCalled();
        expect(screen.getByText('Enter a whole number from 1 to 50 for the writing goal.')).toBeInTheDocument();
    });

    it('edits a diary’s goal and removes it', async () => {
        const user = userEvent.setup();
        const props = renderManager();
        const work = screen.getByText('Work').closest('li') as HTMLElement;

        await user.click(within(work).getByTitle('Edit'));
        const editor = document.querySelector('.diary-card.editing') as HTMLElement;
        const goalType = within(editor).getByLabelText('Writing goal');
        expect(goalType).toHaveValue('entries_per_week');
        expect(within(editor).getByRole('spinbutton', { name: 'Goal target' })).toHaveValue(3);

        await user.selectOptions(goalType, '');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(props.onUpdateDiary).toHaveBeenCalledWith(2, expect.objectContaining({ name: 'Work', goalType: null, goalTarget: null }));
    });
});
