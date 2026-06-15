import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { useConfig, useDiaries, useEntries } from './useAppState';
import { renderHook } from './hookTestUtils';

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
  createConfigService: vi.fn(() => ({
    fetchConfig: vi.fn(),
    fetchProfileStats: vi.fn(),
    updateConfig: vi.fn(),
    downloadUserData: vi.fn(),
  })),
  createEntriesService: vi.fn(() => ({
    fetchEntries: vi.fn(),
    fetchEntryDates: vi.fn(),
    fetchYearsMonths: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    toggleVisibility: vi.fn(),
    toggleFavorite: vi.fn(),
    toggleArchived: vi.fn(),
    togglePinned: vi.fn(),
    bulkOperation: vi.fn(),
    navigateToFirst: vi.fn(),
    navigateByDate: vi.fn(),
    navigateById: vi.fn(),
    fetchEntryHistory: vi.fn(),
    fetchEntryBacklinks: vi.fn(),
    deleteRevision: vi.fn(),
    reorderEntries: vi.fn(),
  })),
  createDiariesService: vi.fn(() => ({
    fetchDiaries: vi.fn(),
    createDiary: vi.fn(),
    updateDiary: vi.fn(),
    deleteDiary: vi.fn(),
    setDefaultDiary: vi.fn(),
    reorderDiaries: vi.fn(),
  })),
  createAttachmentsService: vi.fn(() => ({
    uploadAttachment: vi.fn(),
    getAttachmentsByEntry: vi.fn(),
    linkAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    getAttachmentUrl: vi.fn(),
  })),
  createAiService: vi.fn(() => ({
    suggestTags: vi.fn(),
    fixWriting: vi.fn(),
  })),
  createCloudSyncService: vi.fn(() => ({
    getStatus: vi.fn(),
    getAuthUrl: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    listFiles: vi.fn(),
    uploadExport: vi.fn(),
    downloadFile: vi.fn(),
    getSchedules: vi.fn(),
    setSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    triggerSync: vi.fn(),
  })),
}));

globalThis.alert = vi.fn();

describe('useAppState Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.classList.remove('light-mode', 'dark-mode', 'high-contrast-mode');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useConfig', () => {
    it('initializes with empty config', () => {
      const { result } = renderHook(() => useConfig(false));

      expect(result.current.config).toEqual({});
      expect(result.current.profileStats).toBeNull();
    });

    it('provides translation function', () => {
      const { result } = renderHook(() => useConfig(false));

      expect(typeof result.current.t('save')).toBe('string');
    });

    it('applies theme classes from config', async () => {
      const { result } = renderHook(() => useConfig(false));

      act(() => {
        result.current.setConfig({ theme: 'dark' });
      });

      await waitFor(() => {
        expect(document.body.classList.contains('dark-mode')).toBe(true);
        expect(document.body.classList.contains('light-mode')).toBe(false);
      });

      act(() => {
        result.current.setConfig({ theme: 'light' });
      });

      await waitFor(() => {
        expect(document.body.classList.contains('light-mode')).toBe(true);
        expect(document.body.classList.contains('dark-mode')).toBe(false);
      });
    });

    it('applies high contrast class from config', async () => {
      const { result } = renderHook(() => useConfig(false));

      act(() => {
        result.current.setConfig({ theme: 'dark', highContrast: true });
      });

      await waitFor(() => {
        expect(document.body.classList.contains('high-contrast-mode')).toBe(true);
      });

      act(() => {
        result.current.setConfig({ theme: 'dark', highContrast: false });
      });

      await waitFor(() => {
        expect(document.body.classList.contains('high-contrast-mode')).toBe(false);
      });
    });

    it('exposes config actions', () => {
      const { result } = renderHook(() => useConfig(false));

      expect(typeof result.current.fetchConfig).toBe('function');
      expect(typeof result.current.fetchProfileStats).toBe('function');
      expect(typeof result.current.updateConfig).toBe('function');
      expect(typeof result.current.downloadUserData).toBe('function');
    });

    it('updateConfig updates state when the service succeeds', async () => {
      const { createConfigService } = await import('../services/api');
      vi.mocked(createConfigService).mockReturnValue({
        fetchConfig: vi.fn().mockResolvedValue({ theme: 'dark', language: 'en' }),
        fetchProfileStats: vi.fn().mockResolvedValue(null),
        updateConfig: vi.fn().mockResolvedValue(true),
        downloadUserData: vi.fn().mockResolvedValue(true),
      });

      const { result } = renderHook(() => useConfig(true));

      await waitFor(() => {
        expect(result.current.config).toBeDefined();
      });

      await act(async () => {
        await result.current.updateConfig({ theme: 'light' });
      });

      await waitFor(() => {
        expect(result.current.config.theme).toBe('light');
      });
    });
  });

  describe('useDiaries', () => {
    it('initializes with empty diaries', () => {
      const { result } = renderHook(() => useDiaries(false));

      expect(result.current.diaries).toEqual([]);
      expect(result.current.currentDiaryId).toBeNull();
    });

    it('updates currentDiaryId manually', () => {
      const { result } = renderHook(() => useDiaries(false));

      act(() => {
        result.current.setCurrentDiaryId(1);
      });

      expect(result.current.currentDiaryId).toBe(1);
    });

    it('exposes diary actions', () => {
      const { result } = renderHook(() => useDiaries(false));

      expect(typeof result.current.fetchDiaries).toBe('function');
      expect(typeof result.current.handleCreateDiary).toBe('function');
      expect(typeof result.current.handleUpdateDiary).toBe('function');
      expect(typeof result.current.handleDeleteDiary).toBe('function');
      expect(typeof result.current.handleSetDefaultDiary).toBe('function');
      expect(typeof result.current.handleReorderDiaries).toBe('function');
    });

    it('selects the default diary after fetch and preserves user clearing it later', async () => {
      const { createDiariesService } = await import('../services/api');
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([
          { id: 1, name: 'Default', is_default: true },
          { id: 2, name: 'Work', is_default: false },
        ]),
        createDiary: vi.fn(),
        updateDiary: vi.fn(),
        deleteDiary: vi.fn(),
        setDefaultDiary: vi.fn(),
        reorderDiaries: vi.fn(),
      });

      const { result } = renderHook(() => useDiaries(true));

      await waitFor(() => {
        expect(result.current.currentDiaryId).toBe(1);
      });

      act(() => {
        result.current.setCurrentDiaryId(null);
      });

      await act(async () => {
        await result.current.fetchDiaries();
      });

      expect(result.current.currentDiaryId).toBeNull();
    });

    it('propagates diary service failures', async () => {
      const { createDiariesService } = await import('../services/api');
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([]),
        createDiary: vi.fn().mockResolvedValue({ success: false, error: 'Failed' }),
        updateDiary: vi.fn().mockResolvedValue({ success: false, error: 'Update failed' }),
        deleteDiary: vi.fn(),
        setDefaultDiary: vi.fn().mockResolvedValue({ success: false, error: 'Set default failed' }),
        reorderDiaries: vi.fn(),
      });

      const { result } = renderHook(() => useDiaries(true));

      await expect(async () => {
        await act(async () => {
          await result.current.handleCreateDiary({ name: 'Test' });
        });
      }).rejects.toThrow('Failed');

      await expect(async () => {
        await act(async () => {
          await result.current.handleUpdateDiary(1, { name: 'Updated' });
        });
      }).rejects.toThrow('Update failed');

      await expect(async () => {
        await act(async () => {
          await result.current.handleSetDefaultDiary(1);
        });
      }).rejects.toThrow('Set default failed');
    });

    it('refreshes entries after deleting the current diary', async () => {
      const { createDiariesService } = await import('../services/api');
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([{ id: 2, name: 'Other', is_default: true }]),
        createDiary: vi.fn(),
        updateDiary: vi.fn(),
        deleteDiary: vi.fn().mockResolvedValue({ success: true }),
        setDefaultDiary: vi.fn(),
        reorderDiaries: vi.fn(),
      });

      const { result } = renderHook(() => useDiaries(true));

      await waitFor(() => {
        expect(result.current.diaries).toBeDefined();
      });

      act(() => {
        result.current.setCurrentDiaryId(1);
      });

      const refreshEntries = vi.fn();
      await act(async () => {
        await result.current.handleDeleteDiary(1, refreshEntries);
      });

      expect(refreshEntries).toHaveBeenCalled();
    });
  });

  describe('useEntries', () => {
    const mockConfig = { entriesPerPage: 10 };

    it('initializes with default state', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      expect(result.current.entries).toEqual([]);
      expect(result.current.groupedEntries).toEqual({});
      expect(result.current.loading).toBe(true);
      expect(result.current.page).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.allTags).toEqual([]);
      expect(result.current.entryDates).toEqual([]);
    });

    it('syncs inputPage with page changes', async () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      act(() => {
        result.current.setPage(3);
      });

      await waitFor(() => {
        expect(result.current.inputPage).toBe('3');
      });
    });

    it('updates filter and navigation state', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));
      const filterDate = new Date('2024-01-15');

      act(() => {
        result.current.setSearch('query');
        result.current.setFilterTags(['tag1']);
        result.current.setFilterDateObj(filterDate);
        result.current.setFilterVisibility('public');
        result.current.setTargetEntryId(123);
        result.current.setActiveTargetId(456);
        result.current.setSourceEntry({ id: 1, date: '2024-01-15', index: 1 });
      });

      expect(result.current.search).toBe('query');
      expect(result.current.filterTags).toEqual(['tag1']);
      expect(result.current.filterDateObj).toEqual(filterDate);
      expect(result.current.filterVisibility).toBe('public');
      expect(result.current.targetEntryId).toBe(123);
      expect(result.current.activeTargetId).toBe(456);
      expect(result.current.sourceEntry).toEqual({ id: 1, date: '2024-01-15', index: 1 });
    });

    it('groups entries by date and sorts by index', async () => {
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn().mockResolvedValue({
          entries: [
            { id: 2, date: '2024-01-15', index: 2, content: 'later', tags: [] },
            { id: 1, date: '2024-01-15T08:00:00Z', index: 1, content: 'earlier', tags: [] },
            { id: 3, date: '2024-01-16', index: 1, content: 'next day', tags: [] },
          ],
          totalPages: 1,
          allTags: [],
        }),
        fetchEntryDates: vi.fn().mockResolvedValue([]),
        fetchYearsMonths: vi.fn().mockResolvedValue({ years: [], months: [] }),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        toggleFavorite: vi.fn(),
        toggleArchived: vi.fn(),
        togglePinned: vi.fn(),
        bulkOperation: vi.fn(),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn(),
        fetchEntryHistory: vi.fn(),
        fetchEntryBacklinks: vi.fn(),
        deleteRevision: vi.fn(),
        reorderEntries: vi.fn(),
        renameTag: vi.fn(),
      });

      const { result } = renderHook(() => useEntries(true, mockConfig, null));

      await waitFor(() => {
        expect(result.current.groupedEntries).toEqual({
          '2024-01-15': [
            { id: 1, date: '2024-01-15T08:00:00Z', index: 1, content: 'earlier', tags: [] },
            { id: 2, date: '2024-01-15', index: 2, content: 'later', tags: [] },
          ],
          '2024-01-16': [
            { id: 3, date: '2024-01-16', index: 1, content: 'next day', tags: [] },
          ],
        });
      });
    });

    it('calculates page limit from config', () => {
      const numeric = renderHook(() => useEntries(false, { entriesPerPage: 25 }, null));
      const stringValue = renderHook(() => useEntries(false, { entriesPerPage: '7' }, null));
      const fallback = renderHook(() => useEntries(false, {}, null));

      expect(numeric.result.current.getLimit()).toBe(25);
      expect(stringValue.result.current.getLimit()).toBe(7);
      expect(fallback.result.current.getLimit()).toBe(10);
    });

    it('reorders the current day entries in local state before the API round-trip completes', async () => {
      const reorderEntriesMock = vi.fn().mockResolvedValue(true);
      const { createEntriesService } = await import('../services/api');
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn().mockResolvedValue({
          entries: [
            { id: 1, date: '2024-01-15', index: 1, content: 'first', tags: [] },
            { id: 2, date: '2024-01-15', index: 2, content: 'second', tags: [] },
            { id: 3, date: '2024-01-14', index: 1, content: 'other day', tags: [] },
          ],
          totalPages: 1,
          allTags: [],
        }),
        fetchEntryDates: vi.fn().mockResolvedValue([]),
        fetchYearsMonths: vi.fn().mockResolvedValue({ years: [], months: [] }),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        toggleFavorite: vi.fn(),
        toggleArchived: vi.fn(),
        togglePinned: vi.fn(),
        bulkOperation: vi.fn(),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn(),
        fetchEntryHistory: vi.fn(),
        fetchEntryBacklinks: vi.fn(),
        deleteRevision: vi.fn(),
        reorderEntries: reorderEntriesMock,
        renameTag: vi.fn(),
      });

      const { result } = renderHook(() => useEntries(true, mockConfig, null));

      await waitFor(() => {
        expect(result.current.entries).toHaveLength(3);
      });

      await act(async () => {
        await result.current.reorderEntries('2024-01-15', [2, 1]);
      });

      expect(reorderEntriesMock).toHaveBeenCalledWith('2024-01-15', [2, 1]);
      await waitFor(() => {
        expect(result.current.groupedEntries['2024-01-15']?.map((entry) => entry.id)).toEqual([2, 1]);
        expect(result.current.entries.map((entry) => entry.id)).toEqual([2, 1, 3]);
      });
    });

    it('exposes entry actions', () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null));

      expect(typeof result.current.fetchEntries).toBe('function');
      expect(typeof result.current.fetchEntryDates).toBe('function');
      expect(typeof result.current.toggleVisibility).toBe('function');
      expect(typeof result.current.toggleFavorite).toBe('function');
      expect(typeof result.current.toggleArchived).toBe('function');
      expect(typeof result.current.togglePinned).toBe('function');
      expect(typeof result.current.fetchEntryHistory).toBe('function');
      expect(typeof result.current.fetchEntryBacklinks).toBe('function');
      expect(typeof result.current.deleteRevision).toBe('function');
      expect(typeof result.current.reorderEntries).toBe('function');
    });
  });
});
