import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getTranslation } from '../../utils/translations';
import DiaryManager from './DiaryManager';

const mockT = (key: string): string => key;

interface Diary {
    id: number;
    name: string;
    icon: string;
    color?: string | null;
    is_default: boolean;
    visibility: 'public' | 'private';
}

const defaultDiaries: Diary[] = [
    { id: 1, name: 'Personal', icon: '📓', color: '#E76F51', is_default: true, visibility: 'private' },
    { id: 2, name: 'Work', icon: '💼', color: '#2A9D8F', is_default: false, visibility: 'public' }
];

describe('DiaryManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const baseProps = {
        diaries: defaultDiaries,
        onCreateDiary: vi.fn().mockResolvedValue({}),
        onUpdateDiary: vi.fn().mockResolvedValue({}),
        onDeleteDiary: vi.fn().mockResolvedValue({}),
        onSetDefault: vi.fn().mockResolvedValue({}),
        onReorderDiaries: vi.fn().mockResolvedValue({}),
        onBack: vi.fn(),
        theme: 'dark' as const,
        t: mockT
    };

    it('renders header and diary list', () => {
        render(<DiaryManager {...baseProps} />);
        expect(screen.getByText('manageDiaries')).toBeInTheDocument();
        expect(screen.getByText('Personal')).toBeInTheDocument();
        expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('shows default badge', () => {
        render(<DiaryManager {...baseProps} />);
        expect(screen.getByText('defaultDiary')).toBeInTheDocument();
    });

    it('creates new diary', async () => {
        render(<DiaryManager {...baseProps} />);
        fireEvent.change(screen.getByPlaceholderText('diaryName'), { target: { value: 'New Diary' } });
        fireEvent.click(screen.getByText('createDiary'));

        await waitFor(() => {
            expect(baseProps.onCreateDiary).toHaveBeenCalledWith({
                name: 'New Diary',
                icon: '📓',
                color: '#E76F51',
                visibility: 'private',
                goalType: null,
                goalTarget: null,
            });
        });
    });

    it('handles create error', async () => {
        const onCreateDiary = vi.fn().mockRejectedValue(new Error('Create failed'));
        render(<DiaryManager {...baseProps} onCreateDiary={onCreateDiary} />);
        fireEvent.change(screen.getByPlaceholderText('diaryName'), { target: { value: 'New Diary' } });
        fireEvent.click(screen.getByText('createDiary'));

        await waitFor(() => {
            expect(screen.getByText('Create failed')).toBeInTheDocument();
        });
    });

    it.each([
        ['en', 'Diary name is required', 'Failed to create diary', 'Toggle visibility'],
        ['fr', 'Le nom du journal est obligatoire', 'Échec de la création du journal', 'Changer la visibilité'],
    ] as const)('shows its own messages in %s', async (language, nameRequired, createFailed, toggleLabel) => {
        const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
        const onCreateDiary = vi.fn().mockRejectedValue(new Error('diaryCreateFailed'));
        render(<DiaryManager {...baseProps} onCreateDiary={onCreateDiary} t={t} />);

        expect(screen.getByRole('button', { name: toggleLabel })).toBeInTheDocument();
        fireEvent.click(screen.getByText(t('createDiary')));
        expect(await screen.findByText(nameRequired)).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText(t('diaryName')), { target: { value: 'New Diary' } });
        fireEvent.click(screen.getByText(t('createDiary')));
        expect(await screen.findByText(createFailed)).toBeInTheDocument();
    });

    it('sets default diary', async () => {
        render(<DiaryManager {...baseProps} />);
        fireEvent.click(screen.getByTitle('setAsDefault'));

        await waitFor(() => {
            expect(baseProps.onSetDefault).toHaveBeenCalledWith(2);
        });
    });

    it('edits and saves diary', async () => {
        render(<DiaryManager {...baseProps} />);
        const editButtons = screen.getAllByTitle('edit');
        fireEvent.click(editButtons[1]!); // Click edit on second diary (Work)

        const editInputs = screen.getAllByDisplayValue('Work');
        fireEvent.change(editInputs[0]!, { target: { value: 'Work Updated' } });
        fireEvent.click(screen.getByText('save'));

        await waitFor(() => {
            expect(baseProps.onUpdateDiary).toHaveBeenCalledWith(2, expect.objectContaining({
                name: 'Work Updated',
                color: '#2A9D8F'
            }));
        });
    });

    it('cancels edit mode', async () => {
        render(<DiaryManager {...baseProps} />);
        const editButtons = screen.getAllByTitle('edit');
        fireEvent.click(editButtons[0]!);
        fireEvent.click(screen.getByText('cancel'));
        await waitFor(() => {
            expect(screen.queryByText('save')).not.toBeInTheDocument();
        });
    });

    it('asks in a dialog before deleting a non-default diary', async () => {
        const onDeleteDiary = vi.fn().mockResolvedValue({});
        render(<DiaryManager {...baseProps} onDeleteDiary={onDeleteDiary} />);
        fireEvent.click(screen.getByTitle('delete'));

        expect(screen.getByText('deleteDiaryMessage')).toBeInTheDocument();
        expect(onDeleteDiary).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'delete' }));

        await waitFor(() => {
            expect(onDeleteDiary).toHaveBeenCalledWith(2);
        });
        expect(screen.queryByText('deleteDiaryMessage')).not.toBeInTheDocument();
    });

    it('keeps the diary when the delete dialog is cancelled', () => {
        const onDeleteDiary = vi.fn().mockResolvedValue({});
        render(<DiaryManager {...baseProps} onDeleteDiary={onDeleteDiary} />);
        fireEvent.click(screen.getByTitle('delete'));
        fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

        expect(screen.queryByText('deleteDiaryMessage')).not.toBeInTheDocument();
        expect(onDeleteDiary).not.toHaveBeenCalled();
    });

    it('names the diary in the French delete dialog and shows a failed delete', async () => {
        const t = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
        const onDeleteDiary = vi.fn().mockRejectedValue(new Error(''));
        render(<DiaryManager {...baseProps} theme="light" t={t} onDeleteDiary={onDeleteDiary} />);
        fireEvent.click(screen.getByTitle('Supprimer'));

        expect(screen.getByRole('heading', { name: 'Supprimer le journal' })).toBeInTheDocument();
        expect(screen.getByText('« Work » sera supprimé. Ses entrées seront déplacées vers votre journal par défaut.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

        await waitFor(() => {
            expect(screen.getByText(getTranslation('fr', 'diaryDeleteFailed'))).toBeInTheDocument();
        });
        expect(onDeleteDiary).toHaveBeenCalledWith(2);
    });

    it('calls onBack when back button clicked', () => {
        render(<DiaryManager {...baseProps} />);
        fireEvent.click(screen.getByText('journal'));
        expect(baseProps.onBack).toHaveBeenCalled();
    });
});
