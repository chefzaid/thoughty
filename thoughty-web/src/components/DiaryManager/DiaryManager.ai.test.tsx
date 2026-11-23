import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation, type Language } from '../../utils/translations';
import DiaryManager from './DiaryManager';
import { makeDiary } from '../../test/diaryFixture';

const diaries = [
    makeDiary({ id: 1, name: 'Personal', isDefault: true }),
    makeDiary({ id: 2, name: 'Health', aiMode: 'off' }),
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
        theme: 'dark' as const,
        language,
        t: (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params),
    };
    render(<DiaryManager {...props} />);
    return props;
};

const card = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

describe('DiaryManager AI mode', () => {
    it.each([
        ['en', 'AI off: no AI feature reads this diary'],
        ['fr', "IA désactivée : aucune fonction d'IA ne lit ce journal"],
    ] as const)('says in %s which diaries keep AI out', (language, summary) => {
        renderManager(language);

        expect(within(card('Health')).getByText(summary)).toBeInTheDocument();
        expect(within(card('Personal')).queryByText(summary)).not.toBeInTheDocument();
    });

    it('creates a diary with AI off, then resets the field to on', async () => {
        const user = userEvent.setup();
        const props = renderManager();

        await user.type(screen.getByPlaceholderText('Diary Name'), 'Therapy');
        const field = screen.getByLabelText('AI');
        expect(field).toHaveValue('on');
        await user.selectOptions(field, 'Off');
        await user.click(screen.getByRole('button', { name: 'Create Diary' }));

        expect(props.onCreateDiary).toHaveBeenCalledWith(expect.objectContaining({ name: 'Therapy', aiMode: 'off' }));
        expect(screen.getByLabelText('AI')).toHaveValue('on');
    });

    it('keeps a diary’s mode when editing it, and turns AI back on', async () => {
        const user = userEvent.setup();
        const props = renderManager();

        await user.click(within(card('Health')).getByTitle('Edit'));
        let editor = document.querySelector('.diary-card.editing') as HTMLElement;
        expect(within(editor).getByLabelText('AI')).toHaveValue('off');
        await user.click(within(editor).getByRole('button', { name: 'Save' }));
        expect(props.onUpdateDiary).toHaveBeenLastCalledWith(2, expect.objectContaining({ aiMode: 'off' }));

        await user.click(within(card('Health')).getByTitle('Edit'));
        editor = document.querySelector('.diary-card.editing') as HTMLElement;
        await user.selectOptions(within(editor).getByLabelText('AI'), 'On');
        await user.click(within(editor).getByRole('button', { name: 'Save' }));
        expect(props.onUpdateDiary).toHaveBeenLastCalledWith(2, expect.objectContaining({ aiMode: 'on' }));
    });
});
