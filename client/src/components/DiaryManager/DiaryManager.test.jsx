import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiaryManager from './DiaryManager';

const mockT = (key) => key;

const defaultDiaries = [
    { id: 1, name: 'Personal', icon: '📓', is_default: true, visibility: 'private' },
    { id: 2, name: 'Work', icon: '💼', is_default: false, visibility: 'public' }
];

describe('DiaryManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
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
        onBack: vi.fn(),
        theme: 'dark',
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
                visibility: 'private'
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
        fireEvent.click(editButtons[1]); // Click edit on second diary (Work)

        const editInput = screen.getAllByDisplayValue('Work')[0];
        fireEvent.change(editInput, { target: { value: 'Work Updated' } });
        fireEvent.click(screen.getByText('save'));

        await waitFor(() => {
            expect(baseProps.onUpdateDiary).toHaveBeenCalledWith(2, expect.objectContaining({
                name: 'Work Updated'
            }));
        });
    });

    it('cancels edit mode', async () => {
        render(<DiaryManager {...baseProps} />);
        const editButtons = screen.getAllByTitle('edit');
        fireEvent.click(editButtons[0]);
        fireEvent.click(screen.getByText('cancel'));
        await waitFor(() => {
            expect(screen.queryByText('save')).not.toBeInTheDocument();
        });
    });

    it('deletes non-default diary', async () => {
        render(<DiaryManager {...baseProps} />);
        fireEvent.click(screen.getByTitle('delete'));
        await waitFor(() => {
            expect(baseProps.onDeleteDiary).toHaveBeenCalledWith(2);
        });
    });

    it('calls onBack when back button clicked', () => {
        render(<DiaryManager {...baseProps} />);
        fireEvent.click(screen.getByText('journal'));
        expect(baseProps.onBack).toHaveBeenCalled();
    });
});
