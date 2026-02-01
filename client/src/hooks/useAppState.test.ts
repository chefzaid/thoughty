import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useApiServices, 
  useConfig, 
  useDiaries, 
  useEntries, 
  useEntryForm, 
  useEntryEdit, 
  useDeleteModal 
} from './useAppState';

// Mock the AuthContext
const mockAuthFetch = vi.fn();
const mockGetAccessToken = vi.fn(() => 'test-token');

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
    getAccessToken: mockGetAccessToken
  })
}));

// Mock the services/api module
vi.mock('../services/api', () => ({
  createAuthFetch: vi.fn((authFetch) => authFetch),
  createConfigService: vi.fn(() => ({
    fetchConfig: vi.fn(),
    fetchProfileStats: vi.fn(),
    updateConfig: vi.fn()
  })),
  createEntriesService: vi.fn(() => ({
    fetchEntries: vi.fn(),
    fetchEntryDates: vi.fn(),
    fetchYearsMonths: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    toggleVisibility: vi.fn()
  })),
  createDiariesService: vi.fn(() => ({
    fetchDiaries: vi.fn(),
    createDiary: vi.fn(),
    updateDiary: vi.fn(),
    deleteDiary: vi.fn(),
    setDefaultDiary: vi.fn()
  }))
}));

// Mock alert
global.alert = vi.fn();

describe('useAppState Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.classList.remove('light-mode', 'dark-mode');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useApiServices', () => {
    it('returns api services', () => {
      const { result } = renderHook(() => useApiServices());

      expect(result.current.authFetchHelper).toBeDefined();
      expect(result.current.configService).toBeDefined();
      expect(result.current.entriesService).toBeDefined();
      expect(result.current.diariesService).toBeDefined();
    });

    it('memoizes services correctly', () => {
      const { result, rerender } = renderHook(() => useApiServices());

      const firstConfigService = result.current.configService;
      rerender();
      expect(result.current.configService).toBe(firstConfigService);
    });
  });

  describe('useConfig', () => {
    it('initializes with empty config', () => {
      const { result } = renderHook(() => useConfig(false));

      expect(result.current.config).toEqual({});
      expect(result.current.profileStats).toBeNull();
    });

    it('provides translation function', () => {
      const { result } = renderHook(() => useConfig(false));

      const translation = result.current.t('save');
      expect(typeof translation).toBe('string');
    });

    it('applies dark theme by default', async () => {
      const { result } = renderHook(() => useConfig(false));

      // Set config with dark theme
      act(() => {
        result.current.setConfig({ theme: 'dark' });
      });

      await waitFor(() => {
        expect(document.body.classList.contains('dark-mode')).toBe(true);
        expect(document.body.classList.contains('light-mode')).toBe(false);
      });
    });

    it('applies light theme when configured', async () => {
      const { result } = renderHook(() => useConfig(false));

      // Set config with light theme
      act(() => {
        result.current.setConfig({ theme: 'light' });
      });

      await waitFor(() => {
        expect(document.body.classList.contains('light-mode')).toBe(true);
        expect(document.body.classList.contains('dark-mode')).toBe(false);
      });
    });

    it('fetchConfig is a function', () => {
      const { result } = renderHook(() => useConfig(false));
      expect(typeof result.current.fetchConfig).toBe('function');
    });

    it('fetchProfileStats is a function', () => {
      const { result } = renderHook(() => useConfig(false));
      expect(typeof result.current.fetchProfileStats).toBe('function');
    });

    it('updateConfig is a function', () => {
      const { result } = renderHook(() => useConfig(false));
      expect(typeof result.current.updateConfig).toBe('function');
    });
  });

  describe('useDiaries', () => {
    it('initializes with empty diaries', () => {
      const { result } = renderHook(() => useDiaries(false));

      expect(result.current.diaries).toEqual([]);
      expect(result.current.currentDiaryId).toBeNull();
    });

    it('provides setCurrentDiaryId function', () => {
      const { result } = renderHook(() => useDiaries(false));

      act(() => {
        result.current.setCurrentDiaryId(1);
      });

      expect(result.current.currentDiaryId).toBe(1);
    });

    it('fetchDiaries is a function', () => {
      const { result } = renderHook(() => useDiaries(false));
      expect(typeof result.current.fetchDiaries).toBe('function');
    });

    it('handleCreateDiary is a function', () => {
      const { result } = renderHook(() => useDiaries(false));
      expect(typeof result.current.handleCreateDiary).toBe('function');
    });

    it('handleUpdateDiary is a function', () => {
      const { result } = renderHook(() => useDiaries(false));
      expect(typeof result.current.handleUpdateDiary).toBe('function');
    });

    it('handleDeleteDiary is a function', () => {
      const { result } = renderHook(() => useDiaries(false));
      expect(typeof result.current.handleDeleteDiary).toBe('function');
    });

    it('handleSetDefaultDiary is a function', () => {
      const { result } = renderHook(() => useDiaries(false));
      expect(typeof result.current.handleSetDefaultDiary).toBe('function');
    });
  });

  describe('useEntries', () => {
    const mockConfig = { entriesPerPage: 10 };

    it('initializes with default state', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      expect(result.current.entries).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.page).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.search).toBe('');
      expect(result.current.filterTags).toEqual([]);
      expect(result.current.filterVisibility).toBe('all');
    });

    it('provides setPage function', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setPage(2);
      });

      expect(result.current.page).toBe(2);
    });

    it('updates inputPage when page changes', async () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setPage(5);
      });

      await waitFor(() => {
        expect(result.current.inputPage).toBe('5');
      });
    });

    it('provides setSearch function', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setSearch('test search');
      });

      expect(result.current.search).toBe('test search');
    });

    it('provides setFilterTags function', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setFilterTags(['tag1', 'tag2']);
      });

      expect(result.current.filterTags).toEqual(['tag1', 'tag2']);
    });

    it('provides setFilterDateObj function', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));
      const testDate = new Date('2024-01-15');

      act(() => {
        result.current.setFilterDateObj(testDate);
      });

      expect(result.current.filterDateObj).toEqual(testDate);
    });

    it('provides setFilterVisibility function', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setFilterVisibility('public');
      });

      expect(result.current.filterVisibility).toBe('public');
    });

    it('calculates grouped entries', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      // Initially empty
      expect(result.current.groupedEntries).toEqual({});
    });

    it('getLimit returns correct value from config', () => {
      const { result } = renderHook(() => useEntries(false, { entriesPerPage: 25 }, null));

      expect(result.current.getLimit()).toBe(25);
    });

    it('getLimit handles string entriesPerPage', () => {
      const { result } = renderHook(() => useEntries(false, { entriesPerPage: '15' as unknown as number }, null));

      expect(result.current.getLimit()).toBe(15);
    });

    it('getLimit returns 10 as default', () => {
      const { result } = renderHook(() => useEntries(false, {}, null));

      expect(result.current.getLimit()).toBe(10);
    });

    it('provides setTargetEntryId function', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setTargetEntryId(123);
      });

      expect(result.current.targetEntryId).toBe(123);
    });

    it('provides setActiveTargetId function', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setActiveTargetId(456);
      });

      expect(result.current.activeTargetId).toBe(456);
    });

    it('provides setSourceEntry function', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setSourceEntry({ id: 1, date: '2024-01-15', index: 1 });
      });

      expect(result.current.sourceEntry).toEqual({ id: 1, date: '2024-01-15', index: 1 });
    });
  });

  describe('useEntryForm', () => {
    const mockConfig = { defaultVisibility: 'private' as const };
    const mockOnSuccess = vi.fn();

    it('initializes with default state', () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));

      expect(result.current.newEntryText).toBe('');
      expect(result.current.tags).toEqual([]);
      expect(result.current.formError).toBe('');
    });

    it('sets default visibility from config', async () => {
      const { result } = renderHook(() => 
        useEntryForm({ defaultVisibility: 'public' }, 1, mockOnSuccess)
      );

      await waitFor(() => {
        expect(result.current.visibility).toBe('public');
      });
    });

    it('provides setNewEntryText function', () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));

      act(() => {
        result.current.setNewEntryText('Test entry');
      });

      expect(result.current.newEntryText).toBe('Test entry');
    });

    it('provides setTags function', () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));

      act(() => {
        result.current.setTags(['tag1', 'tag2']);
      });

      expect(result.current.tags).toEqual(['tag1', 'tag2']);
    });

    it('provides setSelectedDate function', () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));
      const newDate = new Date('2024-06-15');

      act(() => {
        result.current.setSelectedDate(newDate);
      });

      expect(result.current.selectedDate).toEqual(newDate);
    });

    it('provides setVisibility function', () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));

      act(() => {
        result.current.setVisibility('public');
      });

      expect(result.current.visibility).toBe('public');
    });

    it('handleSubmit sets error when text is empty', async () => {
      const { result } = renderHook(() => useEntryForm(mockConfig, 1, mockOnSuccess));

      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;

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

      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe('Please add at least one tag');
    });
  });

  describe('useEntryEdit', () => {
    const mockOnSave = vi.fn();

    it('initializes with null editingEntry', () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      expect(result.current.editingEntry).toBeNull();
      expect(result.current.editText).toBe('');
      expect(result.current.editTags).toEqual([]);
      expect(result.current.editDate).toBeNull();
    });

    it('handleEdit sets editing state', () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      const mockEntry = {
        id: 1,
        content: 'Test content',
        tags: ['tag1'],
        date: '2024-01-15',
        visibility: 'public' as const,
        index: 1
      };

      act(() => {
        result.current.handleEdit(mockEntry);
      });

      expect(result.current.editingEntry).toEqual(mockEntry);
      expect(result.current.editText).toBe('Test content');
      expect(result.current.editTags).toEqual(['tag1']);
      expect(result.current.editVisibility).toBe('public');
    });

    it('handleEdit handles date with T separator', () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      const mockEntry = {
        id: 1,
        content: 'Test',
        tags: ['tag1'],
        date: '2024-01-15T10:30:00Z',
        visibility: 'private' as const,
        index: 1
      };

      act(() => {
        result.current.handleEdit(mockEntry);
      });

      expect(result.current.editDate).toBeTruthy();
      expect(result.current.editDate?.getFullYear()).toBe(2024);
    });

    it('handleCancelEdit clears editing state', () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      const mockEntry = {
        id: 1,
        content: 'Test',
        tags: ['tag1'],
        date: '2024-01-15',
        visibility: 'public' as const,
        index: 1
      };

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
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      const mockEntry = {
        id: 1,
        content: 'Test',
        tags: ['tag1'],
        date: '2024-01-15',
        visibility: 'public' as const,
        index: 1
      };

      act(() => {
        result.current.handleEdit(mockEntry);
      });

      act(() => {
        result.current.setEditText('');
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(global.alert).toHaveBeenCalledWith('Text and at least one tag are required');
    });

    it('handleSaveEdit shows alert when no tags', async () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      const mockEntry = {
        id: 1,
        content: 'Test',
        tags: ['tag1'],
        date: '2024-01-15',
        visibility: 'public' as const,
        index: 1
      };

      act(() => {
        result.current.handleEdit(mockEntry);
      });

      act(() => {
        result.current.setEditTags([]);
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(global.alert).toHaveBeenCalledWith('Text and at least one tag are required');
    });

    it('provides setEditText function', () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      act(() => {
        result.current.setEditText('New text');
      });

      expect(result.current.editText).toBe('New text');
    });

    it('provides setEditTags function', () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      act(() => {
        result.current.setEditTags(['new-tag']);
      });

      expect(result.current.editTags).toEqual(['new-tag']);
    });

    it('provides setEditDate function', () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));
      const newDate = new Date('2024-06-15');

      act(() => {
        result.current.setEditDate(newDate);
      });

      expect(result.current.editDate).toEqual(newDate);
    });

    it('provides setEditVisibility function', () => {
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      act(() => {
        result.current.setEditVisibility('private');
      });

      expect(result.current.editVisibility).toBe('private');
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

      // Should not have called onDelete since no entry was set
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('confirmDelete calls onDelete on success', async () => {
      // Need to remock the entriesService with deleteEntry returning true
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn(),
        fetchEntryDates: vi.fn(),
        fetchYearsMonths: vi.fn(),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn().mockResolvedValue(true),
        toggleVisibility: vi.fn(),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn()
      });

      const onDeleteMock = vi.fn();
      const { result } = renderHook(() => useDeleteModal(onDeleteMock));

      act(() => {
        result.current.handleDelete(123);
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(result.current.deleteModalOpen).toBe(false);
      expect(result.current.entryToDelete).toBeNull();
    });

    it('confirmDelete shows alert on failure', async () => {
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn(),
        fetchEntryDates: vi.fn(),
        fetchYearsMonths: vi.fn(),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn().mockResolvedValue(false),
        toggleVisibility: vi.fn(),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn()
      });

      const onDeleteMock = vi.fn();
      const { result } = renderHook(() => useDeleteModal(onDeleteMock));

      act(() => {
        result.current.handleDelete(456);
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(global.alert).toHaveBeenCalledWith('Failed to delete entry.');
    });
  });

  describe('useEntryForm - extended', () => {
    const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;

    it('handleSubmit sets error when text is empty', async () => {
      const mockOnSuccess = vi.fn();
      const config = { defaultVisibility: 'private', entriesPerPage: 10 };
      const { result } = renderHook(() => useEntryForm(config, 1, mockOnSuccess));

      // Try to submit with empty text
      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe('Please enter some text');
    });

    it('handleSubmit sets error when no tags selected', async () => {
      const mockOnSuccess = vi.fn();
      const config = { defaultVisibility: 'private', entriesPerPage: 10 };
      const { result } = renderHook(() => useEntryForm(config, 1, mockOnSuccess));

      // Set text but no tags
      act(() => {
        result.current.setNewEntryText('Some text');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe('Please add at least one tag');
    });

    it('handleSubmit clears form on success', async () => {
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn(),
        fetchEntryDates: vi.fn(),
        fetchYearsMonths: vi.fn(),
        createEntry: vi.fn().mockResolvedValue(true),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn()
      });

      const mockOnSuccess = vi.fn();
      const config = { defaultVisibility: 'private', entriesPerPage: 10 };
      const { result } = renderHook(() => useEntryForm(config, 1, mockOnSuccess));

      // Set text and tags
      act(() => {
        result.current.setNewEntryText('Test entry');
        result.current.setTags(['tag1', 'tag2']);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      // Form should be cleared after success
      expect(result.current.newEntryText).toBe('');
      expect(result.current.tags).toEqual([]);
    });

    it('handleSubmit sets error on failure', async () => {
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn(),
        fetchEntryDates: vi.fn(),
        fetchYearsMonths: vi.fn(),
        createEntry: vi.fn().mockResolvedValue(false),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn()
      });

      const mockOnSuccess = vi.fn();
      const config = { defaultVisibility: 'private', entriesPerPage: 10 };
      const { result } = renderHook(() => useEntryForm(config, 1, mockOnSuccess));

      // Set text and tags
      act(() => {
        result.current.setNewEntryText('Test entry');
        result.current.setTags(['tag1']);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe('Failed to save entry. Please try again.');
    });
  });

  describe('useEntryEdit - handleSaveEdit', () => {
    it('saves entry changes successfully', async () => {
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn(),
        fetchEntryDates: vi.fn(),
        fetchYearsMonths: vi.fn(),
        createEntry: vi.fn(),
        updateEntry: vi.fn().mockResolvedValue(true),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn()
      });

      const mockOnSave = vi.fn();
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      // Start editing
      const entry = { id: 1, text: 'Original', tags: ['tag1'], date: '2024-01-01', visibility: 'private' as const };
      act(() => {
        result.current.handleEdit(entry);
      });

      // Modify and save
      act(() => {
        result.current.setEditText('Modified text');
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      // Should have cleared editing state
      expect(result.current.editingEntry).toBeNull();
    });

    it('toggles visibility successfully', async () => {
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn(),
        fetchEntryDates: vi.fn(),
        fetchYearsMonths: vi.fn(),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn().mockResolvedValue(true),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn()
      });

      const mockOnSave = vi.fn();
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      const entry = { id: 1, text: 'Test', tags: ['tag1'], date: '2024-01-01', visibility: 'public' as const };
      const setEntriesMock = vi.fn();

      await act(async () => {
        await result.current.handleToggleVisibility(entry, setEntriesMock);
      });

      // Should have called setEntries to update visibility
      expect(setEntriesMock).toHaveBeenCalled();
    });

    it('reverts visibility on toggle failure', async () => {
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn(),
        fetchEntryDates: vi.fn(),
        fetchYearsMonths: vi.fn(),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn().mockResolvedValue(false),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn()
      });

      const mockOnSave = vi.fn();
      const { result } = renderHook(() => useEntryEdit(mockOnSave));

      const entry = { id: 1, text: 'Test', tags: ['tag1'], date: '2024-01-01', visibility: 'private' as const };
      const setEntriesMock = vi.fn();

      await act(async () => {
        await result.current.handleToggleVisibility(entry, setEntriesMock);
      });

      // Should have called setEntries twice (once to update, once to revert)
      expect(setEntriesMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('useDiaries - extended', () => {
    it('handleCreateDiary throws on failure', async () => {
      const { createDiariesService } = await import('../services/api');
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([]),
        createDiary: vi.fn().mockResolvedValue({ success: false, error: 'Failed' }),
        updateDiary: vi.fn(),
        deleteDiary: vi.fn(),
        setDefaultDiary: vi.fn()
      });

      const { result } = renderHook(() => useDiaries(true));

      await expect(async () => {
        await act(async () => {
          await result.current.handleCreateDiary({ name: 'Test' });
        });
      }).rejects.toThrow('Failed');
    });

    it('handleUpdateDiary throws on failure', async () => {
      const { createDiariesService } = await import('../services/api');
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([]),
        createDiary: vi.fn(),
        updateDiary: vi.fn().mockResolvedValue({ success: false, error: 'Update failed' }),
        deleteDiary: vi.fn(),
        setDefaultDiary: vi.fn()
      });

      const { result } = renderHook(() => useDiaries(true));

      await expect(async () => {
        await act(async () => {
          await result.current.handleUpdateDiary(1, { name: 'Updated' });
        });
      }).rejects.toThrow('Update failed');
    });

    it('handleDeleteDiary resets currentDiaryId if deleted diary was current', async () => {
      const { createDiariesService } = await import('../services/api');
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([{ id: 2, name: 'Other', is_default: true }]),
        createDiary: vi.fn(),
        updateDiary: vi.fn(),
        deleteDiary: vi.fn().mockResolvedValue({ success: true }),
        setDefaultDiary: vi.fn()
      });

      const { result } = renderHook(() => useDiaries(true));

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.diaries).toBeDefined();
      });

      // Set currentDiaryId 
      act(() => {
        result.current.setCurrentDiaryId(1);
      });

      const refreshEntriesMock = vi.fn();

      await act(async () => {
        await result.current.handleDeleteDiary(1, refreshEntriesMock);
      });

      expect(refreshEntriesMock).toHaveBeenCalled();
    });

    it('handleSetDefaultDiary throws on failure', async () => {
      const { createDiariesService } = await import('../services/api');
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([]),
        createDiary: vi.fn(),
        updateDiary: vi.fn(),
        deleteDiary: vi.fn(),
        setDefaultDiary: vi.fn().mockResolvedValue({ success: false, error: 'Set default failed' })
      });

      const { result } = renderHook(() => useDiaries(true));

      await expect(async () => {
        await act(async () => {
          await result.current.handleSetDefaultDiary(1);
        });
      }).rejects.toThrow('Set default failed');
    });
  });

  describe('useConfig - extended', () => {
    it('updateConfig updates state', async () => {
      const { createConfigService } = await import('../services/api');
      vi.mocked(createConfigService).mockReturnValue({
        fetchConfig: vi.fn().mockResolvedValue({ theme: 'dark', language: 'en' }),
        fetchProfileStats: vi.fn().mockResolvedValue(null),
        updateConfig: vi.fn().mockResolvedValue({ success: true })
      });

      const { result } = renderHook(() => useConfig(true));

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.config).toBeDefined();
      });

      await act(async () => {
        await result.current.updateConfig({ theme: 'light' });
      });

      expect(result.current.config.theme).toBe('light');
    });

    it('applies light theme class to body', async () => {
      const { createConfigService } = await import('../services/api');
      vi.mocked(createConfigService).mockReturnValue({
        fetchConfig: vi.fn().mockResolvedValue({ theme: 'light', language: 'en' }),
        fetchProfileStats: vi.fn().mockResolvedValue(null),
        updateConfig: vi.fn()
      });

      const { result } = renderHook(() => useConfig(true));

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.config.theme).toBe('light');
      });

      expect(document.body.classList.contains('light-mode')).toBe(true);
      expect(document.body.classList.contains('dark-mode')).toBe(false);
    });
  });
});
