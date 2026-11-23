import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHook } from './hookTestUtils';
import { useEntryEdit } from './useEntryActions';
import { useMoveToDiary } from './useMoveToDiary';
import { createEntriesServiceMock, mockNotify, notifier } from './useEntryActions.test-helpers';
import type { Diary } from '../types';

vi.mock('../contexts/AuthContext', async () => (await import('./useEntryActions.test-helpers')).authContextMock());
vi.mock('../services/api', async () => (await import('./useEntryActions.test-helpers')).apiModuleMock());

const diary = (id: number, name: string, isDefault = false): Diary => ({
  id, userId: 1, name, icon: '📓', color: null, visibility: 'private', isDefault, position: id,
  goalType: null, goalTarget: null, defaultTemplateId: null, isLocked: false, aiMode: 'on', createdAt: '2026-01-01T00:00:00.000Z',
});
const diaries = [diary(1, 'Work', true), diary(2, 'Travel')];
const entry = { id: 7, content: 'Packing list', tags: ['trip'], date: '2026-10-02', visibility: 'public' as const, diary_id: 1 };

describe('useMoveToDiary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves the entry through the bulk move, refreshes the views and names the diary it went to', async () => {
    const bulkOperation = vi.fn().mockResolvedValue({ success: true, affectedCount: 1 });
    await createEntriesServiceMock({ bulkOperation });
    const onMoved = vi.fn();
    const { result } = renderHook(() => useMoveToDiary({ diaries, currentDiaryId: null, onMoved, notifier }));

    await expect(result.current(7, 2)).resolves.toBe(true);

    expect(bulkOperation).toHaveBeenCalledWith([7], 'move', { diaryId: 2 });
    expect(onMoved).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith('Entry moved to Travel.');
  });

  it('says the entry left the journal shown, offers its new diary, and closes the asking dialog first', async () => {
    await createEntriesServiceMock({ bulkOperation: vi.fn().mockResolvedValue({ success: true, affectedCount: 1 }) });
    const onShowDiary = vi.fn();
    const closeAsker = vi.fn(() => expect(mockNotify).not.toHaveBeenCalled());
    const { result } = renderHook(() => useMoveToDiary({ diaries, currentDiaryId: 1, onMoved: vi.fn(), notifier, onShowDiary }));

    await result.current(7, 2, closeAsker);

    expect(closeAsker).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith('Entry moved to Travel. It no longer shows in this diary.', {
      label: 'Open Travel',
      run: expect.any(Function),
    });
    mockNotify.mock.calls[0]![1].run();
    expect(onShowDiary).toHaveBeenCalledWith(2);
  });

  it('says the entry left the journal without an action when nothing can show another diary', async () => {
    await createEntriesServiceMock({ bulkOperation: vi.fn().mockResolvedValue({ success: true, affectedCount: 1 }) });
    const { result } = renderHook(() => useMoveToDiary({ diaries, currentDiaryId: 1, onMoved: vi.fn(), notifier }));

    await result.current(7, 2);

    expect(mockNotify).toHaveBeenCalledWith('Entry moved to Travel. It no longer shows in this diary.', undefined);
  });

  it('keeps the journal showing the diary it moved to as it is', async () => {
    await createEntriesServiceMock({ bulkOperation: vi.fn().mockResolvedValue({ success: true, affectedCount: 1 }) });
    const { result } = renderHook(() => useMoveToDiary({ diaries, currentDiaryId: 2, onMoved: vi.fn(), notifier }));

    await result.current(7, 2);

    expect(mockNotify).toHaveBeenCalledWith('Entry moved to Travel.');
  });

  it('resolves false without a notice or a refresh when the move fails', async () => {
    await createEntriesServiceMock({ bulkOperation: vi.fn().mockResolvedValue(null) });
    const onMoved = vi.fn();
    const closeAsker = vi.fn();
    const { result } = renderHook(() => useMoveToDiary({ diaries, currentDiaryId: null, onMoved, notifier }));

    await expect(result.current(7, 2, closeAsker)).resolves.toBe(false);

    expect(onMoved).not.toHaveBeenCalled();
    expect(closeAsker).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('useEntryEdit diary choice', () => {
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function editEntry(moveToDiary: (entryId: number, diaryId: number) => Promise<boolean>, diaryId?: number) {
    await createEntriesServiceMock({ updateEntry: vi.fn().mockResolvedValue(true) });
    const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, onSave, notifier, moveToDiary));
    act(() => {
      result.current.handleEdit(entry);
    });
    expect(result.current.editDiaryId).toBe(1);
    if (diaryId !== undefined) {
      act(() => {
        result.current.setEditDiaryId(diaryId);
      });
    }
    await act(async () => {
      await result.current.handleSaveEdit();
    });
    return result;
  }

  it('moves the entry after saving its changes when the editor chose another diary', async () => {
    const moveToDiary = vi.fn().mockResolvedValue(true);
    const result = await editEntry(moveToDiary, 2);

    expect(moveToDiary).toHaveBeenCalledWith(7, 2);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.editingEntry).toBeNull();
    expect(result.current.editDiaryId).toBeNull();
  });

  it('leaves the diary alone when the editor kept it', async () => {
    const moveToDiary = vi.fn();
    await editEntry(moveToDiary, 1);

    expect(moveToDiary).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('says the changes are saved when the move fails', async () => {
    await editEntry(vi.fn().mockResolvedValue(false), 2);

    expect(mockNotify).toHaveBeenCalledWith('Your changes are saved, but the entry could not be moved.');
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('starts an entry saved before it had a diary on no choice, so it is not moved', async () => {
    await createEntriesServiceMock({ updateEntry: vi.fn().mockResolvedValue(true) });
    const moveToDiary = vi.fn();
    const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, onSave, notifier, moveToDiary));
    act(() => {
      result.current.handleEdit({ ...entry, diary_id: null });
    });
    expect(result.current.editDiaryId).toBeNull();

    await act(async () => {
      await result.current.handleSaveEdit();
    });

    expect(moveToDiary).not.toHaveBeenCalled();
  });
});
