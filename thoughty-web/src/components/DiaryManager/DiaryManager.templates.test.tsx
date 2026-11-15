import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation, type Language } from '../../utils/translations';
import { getEntryTemplates } from '../../utils/entryTemplates';
import DiaryManager from './DiaryManager';
import { makeDiary } from '../../test/diaryFixture';

const templates = getEntryTemplates(JSON.stringify([
    { id: 'custom-1', name: 'Evening walk', content: 'Where I walked:', tags: ['walks'], visibility: 'private', format: 'plain' },
]));

const diaries = [
    makeDiary({ id: 1, name: 'Personal', isDefault: true, defaultTemplateId: 'builtin-gratitude' }),
    makeDiary({ id: 2, name: 'Walks', defaultTemplateId: 'custom-1' }),
    makeDiary({ id: 3, name: 'Old', defaultTemplateId: 'custom-deleted' }),
    makeDiary({ id: 4, name: 'Plain' }),
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
        entryTemplates: templates,
        theme: 'dark' as const,
        language,
        t: (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params),
    };
    render(<DiaryManager {...props} />);
    return props;
};

const card = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

describe('DiaryManager default templates', () => {
    it.each([
        ['en', 'Template: Gratitude journal', 'Template: Evening walk', 'Template: Deleted template'],
        ['fr', 'Modèle : Gratitude journal', 'Modèle : Evening walk', 'Modèle : Modèle supprimé'],
    ] as const)('names each diary’s template in %s, and says when it was deleted', (language, builtIn, custom, deleted) => {
        renderManager(language);

        expect(within(card('Personal')).getByText(builtIn)).toBeInTheDocument();
        expect(within(card('Walks')).getByText(custom)).toBeInTheDocument();
        expect(within(card('Old')).getByText(deleted)).toBeInTheDocument();
        expect(within(card('Plain')).queryByText(/Template:|Modèle :/)).not.toBeInTheDocument();
    });

    it('creates a diary that starts from a custom template, then resets the field', async () => {
        const user = userEvent.setup();
        const props = renderManager();

        await user.type(screen.getByPlaceholderText('Diary Name'), 'Evenings');
        const field = screen.getByLabelText('Default template');
        expect(within(field).queryByText('Deleted template')).not.toBeInTheDocument();
        await user.selectOptions(field, 'Evening walk');
        await user.click(screen.getByRole('button', { name: 'Create Diary' }));

        expect(props.onCreateDiary).toHaveBeenCalledWith(expect.objectContaining({ name: 'Evenings', defaultTemplateId: 'custom-1' }));
        expect(screen.getByLabelText('Default template')).toHaveValue('');
    });

    it('keeps a deleted template chosen until another is picked, and removes a template', async () => {
        const user = userEvent.setup();
        const props = renderManager();

        await user.click(within(card('Old')).getByTitle('Edit'));
        let editor = document.querySelector('.diary-card.editing') as HTMLElement;
        const field = within(editor).getByLabelText('Default template');
        expect(field).toHaveValue('custom-deleted');
        expect(within(field).getByRole('option', { name: 'Deleted template' })).toBeInTheDocument();
        await user.click(within(editor).getByRole('button', { name: 'Save' }));
        expect(props.onUpdateDiary).toHaveBeenLastCalledWith(3, expect.objectContaining({ defaultTemplateId: 'custom-deleted' }));

        await user.click(within(card('Personal')).getByTitle('Edit'));
        editor = document.querySelector('.diary-card.editing') as HTMLElement;
        await user.selectOptions(within(editor).getByLabelText('Default template'), '');
        await user.click(within(editor).getByRole('button', { name: 'Save' }));
        expect(props.onUpdateDiary).toHaveBeenLastCalledWith(1, expect.objectContaining({ name: 'Personal', defaultTemplateId: null }));
    });
});
