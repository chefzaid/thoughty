import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderHook } from './hookTestUtils';
import { useBulkSelect, useDeleteModal, useEntryEdit, useEntryForm } from './useEntryActions';

const mockAuthFetch = vi.fn();
const mockGetAccessToken = vi.fn(() => 'test-token');

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
    getAccessToken: mockGetAccessToken,
  }),
}));

vi.mock('../services/api', () => ({
  createAuthFetch: vi.fn((authFetch) => authFetch),
  createConfigService: vi.fn(() => ({ fetchConfig: vi.fn(), fetchProfileStats: vi.fn(), updateConfig: vi.fn(), downloadUserData: vi.fn() })),
  createEntriesService: vi.fn(() => ({ fetchEntries: vi.fn(), fetchEntryDates: vi.fn(), fetchYearsMonths: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn(), deleteEntry: vi.fn(), toggleVisibility: vi.fn(), bulkOperation: vi.fn(), navigateToFirst: vi.fn(), navigateByDate: vi.fn(), navigateById: vi.fn(), toggleFavorite: vi.fn(), toggleArchived: vi.fn(), fetchEntryHistory: vi.fn(), deleteRevision: vi.fn(), reorderEntries: vi.fn(), renameTag: vi.fn() })),
  createDiariesService: vi.fn(() => ({ fetchDiaries: vi.fn(), createDiary: vi.fn(), updateDiary: vi.fn(), deleteDiary: vi.fn(), setDefaultDiary: vi.fn(), reorderDiaries: vi.fn() })),
  createAttachmentsService: vi.fn(() => ({ uploadAttachment: vi.fn(), getAttachmentsByEntry: vi.fn(), linkAttachment: vi.fn(), deleteAttachment: vi.fn(), getAttachmentUrl: vi.fn() })),
  createAiService: vi.fn(() => ({ suggestTags: vi.fn(), fixWriting: vi.fn(), chat: vi.fn(), getChatHistory: vi.fn(), fetchModels: vi.fn() })),
  createCloudSyncService: vi.fn(() => ({ getStatus: vi.fn(), getAuthUrl: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), listFiles: vi.fn(), uploadExport: vi.fn(), downloadFile: vi.fn(), getSchedules: vi.fn(), setSchedule: vi.fn(), deleteSchedule: vi.fn(), triggerSync: vi.fn() })),
}));

globalThis.alert = vi.fn();

const createEntriesServiceMock = async (overrides: Record<string, unknown> = {}) => {
  const { createEntriesService } = await import('../services/api');
  vi.mocked(createEntriesService).mockReturnValue({
    fetchEntries: vi.fn(),
    fetchEntryDates: vi.fn(),
    fetchYearsMonths: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    toggleVisibility: vi.fn(),
    bulkOperation: vi.fn(),
    toggleFavorite: vi.fn(),
    toggleArchived: vi.fn(),
    navigateToFirst: vi.fn(),
    navigateByDate: vi.fn(),
    navigateById: vi.fn(),
    fetchEntryHistory: vi.fn(),
    deleteRevision: vi.fn(),
    reorderEntries: vi.fn(),
    renameTag: vi.fn(),
    ...overrides,
  });
};

describe('useEntryActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useEntryForm', () => {
    const mockConfig = { defaultVisibility: 'private' as const, autoTagMaxTags: '0' };
    const mockOnSuccess = vi.fn();
    const mockEvent = { preventDefault: vi.fn() };

    it('initializes with default state', () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));

      expect(result.current.newEntryText).toBe('');
      expect(result.current.tags).toEqual([]);
      expect(result.current.formError).toBe('');
    });

    it('sets default visibility from config', async () => {
      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'public' }, 1, mockOnSuccess));

      await waitFor(() => {
        expect(result.current.visibility).toBe('public');
      });
    });

    it('provides setters for text, tags, date, and visibility', () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));
      const newDate = new Date('2024-06-15');

      act(() => {
        result.current.setNewEntryText('Test entry');
        result.current.setTags(['tag1', 'tag2']);
        result.current.setSelectedDate(newDate);
        result.current.setVisibility('public');
      });

      expect(result.current.newEntryText).toBe('Test entry');
      expect(result.current.tags).toEqual(['tag1', 'tag2']);
      expect(result.current.selectedDate).toEqual(newDate);
      expect(result.current.visibility).toBe('public');
    });

    it('handleSubmit sets error when text is empty', async () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe('Please enter some text');
    });

    it('handleSubmit sets error when no tags', async () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));

      act(() => {
        result.current.setNewEntryText('Test content');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe('Please add at least one tag');
    });

    it('handleSubmit allows empty tags when automatic tagging is enabled', async () => {
      await createEntriesServiceMock({ createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 42 }) });
      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', autoTagMaxTags: '3' }, 1, mockOnSuccess));

      act(() => {
        result.current.setNewEntryText('Auto-tag this draft');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe('');
    });

    it('handleSubmit clears form on success', async () => {
      await createEntriesServiceMock({ createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 42 }) });
      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', entriesPerPage: 10 }, 1, mockOnSuccess));

      act(() => {
        result.current.setNewEntryText('Test entry');
        result.current.setTags(['tag1', 'tag2']);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.newEntryText).toBe('');
      expect(result.current.tags).toEqual([]);
    });

    it('handleSubmit uploads pending files and links unattached uploads after save', async () => {
      await createEntriesServiceMock({ createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 42 }) });
      const { createAttachmentsService } = await import('../services/api');
      const uploadAttachment = vi.fn()
        .mockResolvedValueOnce({ id: 201 })
        .mockResolvedValueOnce({ id: 202 });
      const linkAttachment = vi.fn().mockResolvedValue(true);
      const deleteAttachment = vi.fn().mockResolvedValue(true);
      vi.mocked(createAttachmentsService).mockReturnValue({
        uploadAttachment,
        getAttachmentsByEntry: vi.fn(),
        linkAttachment,
        deleteAttachment,
        getAttachmentUrl: vi.fn(),
      });

      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', entriesPerPage: 10 }, 1, mockOnSuccess));
      const pendingFileA = new File(['a'], 'first.txt');
      const pendingFileB = new File(['b'], 'second.txt');

      act(() => {
        result.current.setNewEntryText('Test entry');
        result.current.setTags(['tag1']);
        result.current.addPendingFile(pendingFileA);
        result.current.addPendingFile(pendingFileB);
        result.current.removePendingFile(0);
        result.current.addPendingFile(pendingFileA);
      });

      act(() => {
        result.current.uploadedAttachments.push({ id: 99, entry_id: null } as never);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(uploadAttachment).toHaveBeenCalledTimes(2);
      expect(linkAttachment).toHaveBeenCalledWith(99, 42);
    });

    it('handleSubmit sets error on failure', async () => {
      await createEntriesServiceMock({ createEntry: vi.fn().mockResolvedValue({ success: false }) });
      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', entriesPerPage: 10 }, 1, mockOnSuccess));

      act(() => {
        result.current.setNewEntryText('Test entry');
        result.current.setTags(['tag1']);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe('Failed to save entry. Please try again.');
    });

    it('handleSuggestTags merges AI suggestions into the existing tags', async () => {
      const { createAiService } = await import('../services/api');
      vi.mocked(createAiService).mockReturnValue({ suggestTags: vi.fn().mockResolvedValue(['focus', 'writing']), fixWriting: vi.fn(), chat: vi.fn(), getChatHistory: vi.fn(), fetchModels: vi.fn() });

      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', entriesPerPage: 10 }, 1, mockOnSuccess));

      act(() => {
        result.current.setNewEntryText('I wrote about focus and deep work all morning.');
        result.current.setTags(['journal']);
      });

      await act(async () => {
        await result.current.handleSuggestTags();
      });

      expect(result.current.tags).toEqual(['journal', 'focus', 'writing']);
      expect(result.current.formError).toBe('');
    });

    it('handleSuggestTags surfaces a configuration error when the AI request fails', async () => {
      const { createAiService } = await import('../services/api');
      vi.mocked(createAiService).mockReturnValue({ suggestTags: vi.fn().mockResolvedValue(null), fixWriting: vi.fn(), chat: vi.fn(), getChatHistory: vi.fn(), fetchModels: vi.fn() });

      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', entriesPerPage: 10 }, 1, mockOnSuccess));

      act(() => {
        result.current.setNewEntryText('This draft should trigger the AI error path.');
      });

      await act(async () => {
        await result.current.handleSuggestTags();
      });

      expect(result.current.formError).toBe('Unable to suggest tags. Check your OpenRouter API key and try again.');
    });

    it('handleSuggestTags validates empty input and empty AI responses', async () => {
      const { createAiService } = await import('../services/api');
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn().mockResolvedValue([]),
        fixWriting: vi.fn(),
        chat: vi.fn(),
        getChatHistory: vi.fn(),
        fetchModels: vi.fn(),
      });

      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', entriesPerPage: 10 }, 1, mockOnSuccess));

      await act(async () => {
        await result.current.handleSuggestTags();
      });
      expect(result.current.formError).toBe('Write a thought before asking for tag suggestions');

      act(() => {
        result.current.setNewEntryText('This still has no AI suggestions');
      });

      await act(async () => {
        await result.current.handleSuggestTags();
      });
      expect(result.current.formError).toBe('No tag suggestions were returned. Try adding more detail.');
    });

    it('handleFixWriting validates input and updates corrected text', async () => {
      const { createAiService } = await import('../services/api');
      const fixWriting = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('Original draft')
        .mockResolvedValueOnce('Corrected draft');
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn(),
        fixWriting,
        chat: vi.fn(),
        getChatHistory: vi.fn(),
        fetchModels: vi.fn(),
      });

      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', entriesPerPage: 10 }, 1, mockOnSuccess));

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.formError).toBe('Write a thought before asking for writing fixes');

      act(() => {
        result.current.setNewEntryText('Original draft');
      });

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.formError).toBe('Unable to fix writing. Check your OpenRouter API key and try again.');

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.formError).toBe('No corrections were needed.');

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.newEntryText).toBe('Corrected draft');
    });

    it('removes uploaded attachments through the attachments service', async () => {
      const { createAttachmentsService } = await import('../services/api');
      const deleteAttachment = vi.fn().mockResolvedValue(true);
      vi.mocked(createAttachmentsService).mockReturnValue({
        uploadAttachment: vi.fn(),
        getAttachmentsByEntry: vi.fn(),
        linkAttachment: vi.fn(),
        deleteAttachment,
        getAttachmentUrl: vi.fn(),
      });

      const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', entriesPerPage: 10 }, 1, mockOnSuccess));
      act(() => {
        result.current.uploadedAttachments.push({ id: 7 } as never);
      });

      await act(async () => {
        await result.current.removeUploadedAttachment(7);
      });

      expect(deleteAttachment).toHaveBeenCalledWith(7);
      expect(result.current.uploadedAttachments).toEqual([]);
    });
  });

  describe('useEntryEdit', () => {
    const mockOnSave = vi.fn();

    it('initializes with null editingEntry', () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));

      expect(result.current.editingEntry).toBeNull();
      expect(result.current.editText).toBe('');
      expect(result.current.editTags).toEqual([]);
      expect(result.current.editDate).toBeNull();
    });

    it('handleEdit sets editing state', () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const mockEntry = { id: 1, content: 'Test content', tags: ['tag1'], date: '2024-01-15', visibility: 'public' as const, index: 1 };

      act(() => {
        result.current.handleEdit(mockEntry);
      });

      expect(result.current.editingEntry).toEqual(mockEntry);
      expect(result.current.editText).toBe('Test content');
      expect(result.current.editTags).toEqual(['tag1']);
      expect(result.current.editVisibility).toBe('public');
    });

    it('handleEdit handles date with T separator', () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const mockEntry = { id: 1, content: 'Test', tags: ['tag1'], date: '2024-01-15T10:30:00Z', visibility: 'private' as const, index: 1 };

      act(() => {
        result.current.handleEdit(mockEntry);
      });

      expect(result.current.editDate?.getFullYear()).toBe(2024);
    });

    it('handleCancelEdit clears editing state', () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const mockEntry = { id: 1, content: 'Test', tags: ['tag1'], date: '2024-01-15', visibility: 'public' as const, index: 1 };

      act(() => {
        result.current.handleEdit(mockEntry);
      });
      act(() => {
        result.current.handleCancelEdit();
      });

      expect(result.current.editingEntry).toBeNull();
      expect(result.current.editText).toBe('');
      expect(result.current.editTags).toEqual([]);
    });

    it('handleSaveEdit shows alert when text empty', async () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const mockEntry = { id: 1, content: 'Test', tags: ['tag1'], date: '2024-01-15', visibility: 'public' as const, index: 1 };

      act(() => {
        result.current.handleEdit(mockEntry);
        result.current.setEditText('');
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(globalThis.alert).toHaveBeenCalledWith('Text and at least one tag are required');
    });

    it('handleSaveEdit shows alert when no tags', async () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const mockEntry = { id: 1, content: 'Test', tags: ['tag1'], date: '2024-01-15', visibility: 'public' as const, index: 1 };

      act(() => {
        result.current.handleEdit(mockEntry);
        result.current.setEditTags([]);
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(globalThis.alert).toHaveBeenCalledWith('Text and at least one tag are required');
    });

    it('provides setters for edit state', () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const newDate = new Date('2024-06-15');

      act(() => {
        result.current.setEditText('New text');
        result.current.setEditTags(['new-tag']);
        result.current.setEditDate(newDate);
        result.current.setEditVisibility('private');
      });

      expect(result.current.editText).toBe('New text');
      expect(result.current.editTags).toEqual(['new-tag']);
      expect(result.current.editDate).toEqual(newDate);
      expect(result.current.editVisibility).toBe('private');
    });

    it('saves entry changes successfully', async () => {
      await createEntriesServiceMock({ updateEntry: vi.fn().mockResolvedValue(true) });
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const entry = { id: 1, content: 'Original', tags: ['tag1'], date: '2024-01-01', visibility: 'private' as const };

      act(() => {
        result.current.handleEdit(entry);
        result.current.setEditText('Modified text');
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(result.current.editingEntry).toBeNull();
    });

    it('returns early when there is no edit date or entry to save', async () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '1' }, mockOnSave));

      act(() => {
        result.current.setEditText('Draft');
        result.current.setEditTags(['tag']);
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(globalThis.alert).not.toHaveBeenCalled();
    });

    it('alerts when saving entry changes fails', async () => {
      await createEntriesServiceMock({ updateEntry: vi.fn().mockResolvedValue(false) });
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const entry = { id: 1, content: 'Original', tags: ['tag1'], date: '2024-01-01', visibility: 'private' as const };

      act(() => {
        result.current.handleEdit(entry);
        result.current.setEditText('Modified text');
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(globalThis.alert).toHaveBeenCalledWith('Failed to update entry.');
    });

    it('uploads new edit files and deletes removed attachments after a successful save', async () => {
      await createEntriesServiceMock({ updateEntry: vi.fn().mockResolvedValue(true) });
      const { createAttachmentsService } = await import('../services/api');
      const uploadAttachment = vi.fn().mockResolvedValue({ id: 88 });
      const deleteAttachment = vi.fn().mockResolvedValue(true);
      vi.mocked(createAttachmentsService).mockReturnValue({
        uploadAttachment,
        getAttachmentsByEntry: vi.fn(),
        linkAttachment: vi.fn(),
        deleteAttachment,
        getAttachmentUrl: vi.fn(),
      });

      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '1' }, mockOnSave));
      const entry = {
        id: 1,
        content: 'Original',
        tags: ['tag1'],
        date: '2024-01-01',
        visibility: 'private' as const,
        attachments: [{ id: 10 }, { id: 11 }],
      };
      const pendingFile = new File(['draft'], 'draft.txt');

      act(() => {
        result.current.handleEdit(entry as never);
        result.current.addEditPendingFile(pendingFile);
        result.current.removeEditAttachment(11);
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(uploadAttachment).toHaveBeenCalledWith(pendingFile, 1);
      expect(deleteAttachment).toHaveBeenCalledWith(11);
      expect(mockOnSave).toHaveBeenCalled();
    });

    it('manages edit pending files and attachments locally', () => {
      const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, mockOnSave));
      const firstFile = new File(['a'], 'a.txt');
      const secondFile = new File(['b'], 'b.txt');

      act(() => {
        result.current.addEditPendingFile(firstFile);
        result.current.addEditPendingFile(secondFile);
        result.current.removeEditPendingFile(0);
      });

      expect(result.current.editPendingFiles).toEqual([secondFile]);
    });
  });

  describe('useDeleteModal', () => {
    const mockOnDelete = vi.fn();

    it('initializes with modal closed', () => {
      const { result } = renderHook(() => useDeleteModal(mockOnDelete));

      expect(result.current.deleteModalOpen).toBe(false);
      expect(result.current.entryToDelete).toBeNull();
    });

    it('handleDelete opens modal and sets entry', () => {
      const { result } = renderHook(() => useDeleteModal(mockOnDelete));

      act(() => {
        result.current.handleDelete(123);
      });

      expect(result.current.deleteModalOpen).toBe(true);
      expect(result.current.entryToDelete).toBe(123);
    });

    it('cancelDelete closes modal and clears entry', () => {
      const { result } = renderHook(() => useDeleteModal(mockOnDelete));

      act(() => {
        result.current.handleDelete(123);
      });
      act(() => {
        result.current.cancelDelete();
      });

      expect(result.current.deleteModalOpen).toBe(false);
      expect(result.current.entryToDelete).toBeNull();
    });

    it('confirmDelete returns early if no entry to delete', async () => {
      const { result } = renderHook(() => useDeleteModal(mockOnDelete));

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('confirmDelete calls onDelete on success', async () => {
      await createEntriesServiceMock({ deleteEntry: vi.fn().mockResolvedValue(true) });
      const onDeleteMock = vi.fn();
      const { result } = renderHook(() => useDeleteModal(onDeleteMock));

      act(() => {
        result.current.handleDelete(123);
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(onDeleteMock).toHaveBeenCalled();
      expect(result.current.deleteModalOpen).toBe(false);
      expect(result.current.entryToDelete).toBeNull();
    });

    it('confirmDelete shows alert on failure', async () => {
      await createEntriesServiceMock({ deleteEntry: vi.fn().mockResolvedValue(false) });
      const { result } = renderHook(() => useDeleteModal(vi.fn()));

      act(() => {
        result.current.handleDelete(456);
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(globalThis.alert).toHaveBeenCalledWith('Failed to delete entry.');
    });
  });

  describe('useBulkSelect', () => {
    const mockOnComplete = vi.fn();

    it('initializes with default state', () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      expect(result.current.bulkMode).toBe(false);
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.bulkModalOpen).toBe(false);
      expect(result.current.pendingAction).toBeNull();
    });

    it('toggleBulkMode enables and disables bulk mode', () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      act(() => {
        result.current.toggleBulkMode();
      });
      expect(result.current.bulkMode).toBe(true);

      act(() => {
        result.current.toggleBulkMode();
      });
      expect(result.current.bulkMode).toBe(false);
    });

    it('clears selection when exiting bulk mode', () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      act(() => {
        result.current.toggleBulkMode();
        result.current.toggleSelect(1);
        result.current.toggleSelect(2);
      });
      expect(result.current.selectedIds.size).toBe(2);

      act(() => {
        result.current.toggleBulkMode();
      });
      expect(result.current.selectedIds.size).toBe(0);
    });

    it('toggleSelect adds and removes entries', () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      act(() => {
        result.current.toggleSelect(1);
      });
      expect(result.current.selectedIds.has(1)).toBe(true);

      act(() => {
        result.current.toggleSelect(1);
      });
      expect(result.current.selectedIds.has(1)).toBe(false);
    });

    it('selectAll sets all provided ids', () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      act(() => {
        result.current.selectAll([1, 2, 3]);
      });

      expect(result.current.selectedIds.size).toBe(3);
      expect(result.current.selectedIds.has(1)).toBe(true);
      expect(result.current.selectedIds.has(2)).toBe(true);
      expect(result.current.selectedIds.has(3)).toBe(true);
    });

    it('clearSelection empties the selection set', () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      act(() => {
        result.current.selectAll([1, 2, 3]);
        result.current.clearSelection();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });

    it('requestBulkAction with delete opens confirm modal', () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      act(() => {
        result.current.toggleSelect(1);
      });

      act(() => {
        result.current.requestBulkAction('delete');
      });

      expect(result.current.bulkModalOpen).toBe(true);
      expect(result.current.pendingAction).toEqual({ action: 'delete' });
    });

    it('requestBulkAction does nothing when no entries selected', async () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      await act(async () => {
        result.current.requestBulkAction('delete');
      });

      expect(result.current.bulkModalOpen).toBe(false);
    });

    it('requestBulkAction with non-delete executes immediately', async () => {
      const mockBulkOperation = vi.fn().mockResolvedValue({ success: true, affectedCount: 1 });
      await createEntriesServiceMock({ bulkOperation: mockBulkOperation });

      const onComplete = vi.fn();
      const { result } = renderHook(() => useBulkSelect(onComplete));

      act(() => {
        result.current.toggleSelect(1);
      });

      await act(async () => {
        result.current.requestBulkAction('visibility', { visibility: 'public' });
      });

      expect(mockBulkOperation).toHaveBeenCalledWith([1], 'visibility', { visibility: 'public' });
      expect(onComplete).toHaveBeenCalled();
    });

    it('cancelBulkModal closes modal and clears pending action', () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      act(() => {
        result.current.toggleSelect(1);
      });

      act(() => {
        result.current.requestBulkAction('delete');
      });
      expect(result.current.bulkModalOpen).toBe(true);

      act(() => {
        result.current.cancelBulkModal();
      });

      expect(result.current.bulkModalOpen).toBe(false);
      expect(result.current.pendingAction).toBeNull();
    });

    it('confirmBulkDelete executes delete and clears state', async () => {
      const mockBulkOperation = vi.fn().mockResolvedValue({ success: true, affectedCount: 2 });
      await createEntriesServiceMock({ bulkOperation: mockBulkOperation });

      const onComplete = vi.fn();
      const { result } = renderHook(() => useBulkSelect(onComplete));

      act(() => {
        result.current.toggleSelect(1);
        result.current.toggleSelect(2);
        result.current.requestBulkAction('delete');
      });

      await act(async () => {
        await result.current.confirmBulkDelete();
      });

      expect(mockBulkOperation).toHaveBeenCalledWith([1, 2], 'delete', undefined);
      expect(result.current.bulkModalOpen).toBe(false);
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.bulkMode).toBe(false);
      expect(onComplete).toHaveBeenCalled();
    });

    it('executeBulkAction shows alert on failure', async () => {
      await createEntriesServiceMock({ bulkOperation: vi.fn().mockResolvedValue(null) });
      const { result } = renderHook(() => useBulkSelect(mockOnComplete));

      act(() => {
        result.current.toggleSelect(1);
      });

      await act(async () => {
        await result.current.executeBulkAction('delete');
      });

      expect(globalThis.alert).toHaveBeenCalledWith('Bulk operation failed.');
    });
  });
});