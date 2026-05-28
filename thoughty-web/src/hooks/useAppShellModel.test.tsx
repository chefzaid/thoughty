import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppShellModel } from './useAppShellModel';

const mocks = vi.hoisted(() => ({
  buildAuthenticatedLayoutProps: vi.fn((args) => ({ kind: 'layout', ...args })),
  buildAuthenticatedRoutesProps: vi.fn((args) => ({ kind: 'routes', ...args })),
  buildPublicShellProps: vi.fn((args) => ({
    introPageProps: { kind: 'intro', ...args },
    authPageProps: { kind: 'auth', ...args },
  })),
  parseTagMetadata: vi.fn(),
  serializeTagMetadata: vi.fn(),
  useApiServices: vi.fn(),
  useAppRouteState: vi.fn(),
  useAppShellEffects: vi.fn(),
  useAppShellRouting: vi.fn(),
  useAuth: vi.fn(),
  useBulkSelect: vi.fn(),
  useConfig: vi.fn(),
  useDeleteModal: vi.fn(),
  useDiaries: vi.fn(),
  useEntries: vi.fn(),
  useEntryEdit: vi.fn(),
  useEntryForm: vi.fn(),
  useEntryNavigation: vi.fn(),
  useNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: mocks.useNavigate,
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mocks.useAuth,
}));

vi.mock('./useAppRouteState', () => ({
  useAppRouteState: mocks.useAppRouteState,
}));

vi.mock('./useAppShellEffects', () => ({
  useAppShellEffects: mocks.useAppShellEffects,
}));

vi.mock('./useAppShellRouting', () => ({
  useAppShellRouting: mocks.useAppShellRouting,
}));

vi.mock('./useEntryNavigation', () => ({
  useEntryNavigation: mocks.useEntryNavigation,
}));

vi.mock('./useAppState', () => ({
  useApiServices: mocks.useApiServices,
  useBulkSelect: mocks.useBulkSelect,
  useConfig: mocks.useConfig,
  useDeleteModal: mocks.useDeleteModal,
  useDiaries: mocks.useDiaries,
  useEntries: mocks.useEntries,
  useEntryEdit: mocks.useEntryEdit,
  useEntryForm: mocks.useEntryForm,
}));

vi.mock('../utils/tagMetadata', () => ({
  parseTagMetadata: mocks.parseTagMetadata,
  serializeTagMetadata: mocks.serializeTagMetadata,
}));

vi.mock('../utils/appShellProps', () => ({
  buildAuthenticatedLayoutProps: mocks.buildAuthenticatedLayoutProps,
  buildAuthenticatedRoutesProps: mocks.buildAuthenticatedRoutesProps,
  buildPublicShellProps: mocks.buildPublicShellProps,
}));

describe('useAppShellModel', () => {
  const navigate = vi.fn();
  const logout = vi.fn().mockResolvedValue(undefined);
  const t = vi.fn((key: string) => key);
  const fetchConfig = vi.fn();
  const fetchProfileStats = vi.fn();
  const updateConfig = vi.fn();
  const downloadUserData = vi.fn();
  const fetchDiaries = vi.fn();
  const fetchEntries = vi.fn();
  const fetchEntryDates = vi.fn();
  const fetchEntryHistory = vi.fn();
  const setPage = vi.fn();
  const setTargetEntryId = vi.fn();
  const setFilterTags = vi.fn();
  const setCurrentDiaryId = vi.fn();
  const setActiveTargetId = vi.fn();
  const setFilterArchiveStatus = vi.fn();
  const setFilterDateObj = vi.fn();
  const setFilterFavorites = vi.fn();
  const setFilterVisibility = vi.fn();
  const setSearch = vi.fn();
  const setSourceEntry = vi.fn();
  const setTags = vi.fn();
  const setEditTags = vi.fn();
  const aiChat = vi.fn().mockResolvedValue('assistant reply');
  const getChatHistory = vi.fn().mockResolvedValue([{ role: 'assistant', content: 'history' }]);
  const renameTag = vi.fn().mockResolvedValue({ success: true });
  const navigateToFirst = vi.fn().mockResolvedValue({ found: true, page: 4, entryId: 77 });

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useNavigate.mockReturnValue(navigate);
    mocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { username: 'auth-user', avatarUrl: 'auth-avatar.png' },
      logout,
    });
    mocks.useAppRouteState.mockReturnValue({
      currentView: 'journal',
      diaryReturnView: 'stats',
      importExportFormat: 'json',
      importExportIncludeVisibility: true,
      importExportSection: 'import',
      location: { pathname: '/journal' },
      publicView: 'login',
      routeDiaryId: 9,
      routeEntryId: 5,
      searchParams: new URLSearchParams('entry=5'),
    });
    mocks.parseTagMetadata.mockReturnValue({ current: { color: '#fff' } });
    mocks.serializeTagMetadata.mockReturnValue('serialized-tag-metadata');
    mocks.useConfig.mockReturnValue({
      config: { theme: 'dark', tagMetadata: 'raw-tag-metadata', name: 'Config Name', avatarUrl: 'config-avatar.png' },
      profileStats: { totalEntries: 12 },
      fetchConfig,
      fetchProfileStats,
      updateConfig,
      downloadUserData,
      t,
    });
    mocks.useDiaries.mockReturnValue({
      currentDiaryId: 9,
      setCurrentDiaryId,
      fetchDiaries,
      diaries: [{ id: 9, name: 'Work', icon: 'W' }],
      handleCreateDiary: vi.fn(),
      handleDeleteDiary: vi.fn(),
      handleReorderDiaries: vi.fn(),
      handleSetDefaultDiary: vi.fn(),
      handleUpdateDiary: vi.fn(),
    });
    mocks.useEntries.mockReturnValue({
      activeTargetId: null,
      allTags: ['current', 'later'],
      availableMonths: ['2024-01'],
      availableYears: [2024],
      deleteRevision: vi.fn(),
      entries: [{ id: 1, content: 'hello' }],
      entriesService: {
        navigateToFirst,
        renameTag,
      },
      fetchEntries,
      fetchEntryDates,
      fetchEntryHistory,
      filterArchiveStatus: 'active',
      filterDateObj: null,
      filterFavorites: false,
      filterTags: ['current'],
      filterVisibility: 'all',
      getLimit: vi.fn(() => 25),
      groupedEntries: {},
      inputPage: '1',
      loading: false,
      page: 2,
      reorderEntries: vi.fn(),
      search: 'focus',
      setActiveTargetId,
      setFilterArchiveStatus,
      setFilterDateObj,
      setFilterFavorites,
      setFilterTags,
      setFilterVisibility,
      setInputPage: vi.fn(),
      setPage,
      setSearch,
      setSourceEntry,
      setTargetEntryId,
      sourceEntry: null,
      targetEntryId: null,
      toggleArchived: vi.fn(),
      toggleFavorite: vi.fn(),
      toggleVisibility: vi.fn(),
      totalPages: 8,
    });
    mocks.useEntryForm.mockReturnValue({
      addPendingFile: vi.fn(),
      fixingWriting: false,
      formError: '',
      format: 'plain',
      handleFixWriting: vi.fn(),
      handleSubmit: vi.fn(),
      handleSuggestTags: vi.fn(),
      newEntryText: 'Draft',
      pendingFiles: [],
      removePendingFile: vi.fn(),
      removeUploadedAttachment: vi.fn(),
      selectedDate: new Date('2024-01-15'),
      setFormat: vi.fn(),
      setNewEntryText: vi.fn(),
      setSelectedDate: vi.fn(),
      setTags,
      setVisibility: vi.fn(),
      suggestingTags: false,
      tags: ['current'],
      uploadedAttachments: [],
      visibility: 'private',
    });
    mocks.useEntryEdit.mockReturnValue({
      addEditPendingFile: vi.fn(),
      editDate: new Date('2024-01-15'),
      editExistingAttachments: [],
      editFormat: 'plain',
      editPendingFiles: [],
      editTags: ['current'],
      editText: 'Edit me',
      editVisibility: 'private',
      editingEntry: null,
      handleCancelEdit: vi.fn(),
      handleEdit: vi.fn(),
      handleSaveEdit: vi.fn(),
      removeEditAttachment: vi.fn(),
      removeEditPendingFile: vi.fn(),
      setEditDate: vi.fn(),
      setEditFormat: vi.fn(),
      setEditTags,
      setEditText: vi.fn(),
      setEditVisibility: vi.fn(),
    });
    mocks.useDeleteModal.mockReturnValue({
      cancelDelete: vi.fn(),
      confirmDelete: vi.fn(),
      deleteModalOpen: false,
      handleDelete: vi.fn(),
    });
    mocks.useBulkSelect.mockReturnValue({
      bulkModalOpen: false,
      bulkMode: false,
      cancelBulkModal: vi.fn(),
      clearSelection: vi.fn(),
      confirmBulkDelete: vi.fn(),
      requestBulkAction: vi.fn(),
      selectAll: vi.fn(),
      selectedIds: new Set<number>([1, 2]),
      toggleBulkMode: vi.fn(),
      toggleSelect: vi.fn(),
    });
    mocks.useEntryNavigation.mockReturnValue({
      entryToastVisible: true,
      handleBackToSource: vi.fn(),
      handleNavigateToEntry: vi.fn(),
      handleShareEntry: vi.fn(),
    });
    mocks.useAppShellRouting.mockReturnValue({
      handleAuthSuccess: vi.fn(),
      handleBackFromDiaries: vi.fn(),
      handleDiaryChange: vi.fn(),
      handleImportExportRouteStateChange: vi.fn(),
      handleLogout: vi.fn(),
      handleManageDiaries: vi.fn(),
      handlePublicViewChange: vi.fn(),
      handleViewChange: vi.fn(),
    });
    mocks.useApiServices.mockReturnValue({
      aiService: {
        chat: aiChat,
        getChatHistory,
      },
    });
  });

  it('assembles the shell model and wires side-effect inputs', () => {
    const { result } = renderHook(() => useAppShellModel());

    expect(mocks.useAppShellEffects).toHaveBeenCalledWith(expect.objectContaining({
      allTags: ['current', 'later'],
      currentDiaryId: 9,
      isAuthenticated: true,
      routeDiaryId: 9,
      serializedTagMetadata: 'serialized-tag-metadata',
      tagMetadata: { current: { color: '#fff' } },
      updateConfig,
    }));
    expect(result.current.pathname).toBe('/journal');
    expect(result.current.authLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.authPageProps).toMatchObject({ kind: 'auth', publicView: 'login' });
    expect(result.current.introPageProps).toMatchObject({ kind: 'intro', publicView: 'login' });
    expect(result.current.authenticatedLayoutProps).toMatchObject({
      kind: 'layout',
      userName: 'Config Name',
      avatarUrl: 'config-avatar.png',
      entryToastVisible: true,
    });
    expect(result.current.authenticatedRoutesProps).toMatchObject({
      kind: 'routes',
      importExportFormat: 'json',
      importExportIncludeVisibility: true,
      importExportSection: 'import',
      highlightsModalOpen: false,
    });
  });

  it('handles navigation, tag renaming, and AI chat callbacks', async () => {
    const { result } = renderHook(() => useAppShellModel());

    await act(async () => {
      await result.current.authenticatedRoutesProps.handleNavigateToFirst(2024, 1);
    });

    expect(navigateToFirst).toHaveBeenCalledWith(2024, 1, 25);
    expect(setPage).toHaveBeenCalledWith(4);
    expect(setTargetEntryId).toHaveBeenCalledWith(77);

    await expect(result.current.authenticatedLayoutProps.handleLoadAiChatHistory(5)).resolves.toEqual([
      { role: 'assistant', content: 'history' },
    ]);
    expect(getChatHistory).toHaveBeenCalledWith(5);

    await expect(result.current.authenticatedLayoutProps.handleAiChat(5, 'entry text', [{ role: 'user', content: 'hello' }]))
      .resolves.toBe('assistant reply');
    expect(aiChat).toHaveBeenCalledWith(5, 'entry text', [{ role: 'user', content: 'hello' }]);

    await expect(result.current.authenticatedRoutesProps.handleRenameTag('current', 'renamed')).resolves.toBe(true);
    expect(renameTag).toHaveBeenCalledWith('current', 'renamed');

    const nextFormTags = setTags.mock.calls[0][0](['current', 'other', 'renamed']);
    const nextEditTags = setEditTags.mock.calls[0][0](['current', 'other']);
    const nextFilterTags = setFilterTags.mock.calls[0][0](['current', 'other']);

    expect(nextFormTags).toEqual(['renamed', 'other']);
    expect(nextEditTags).toEqual(['renamed', 'other']);
    expect(nextFilterTags).toEqual(['renamed', 'other']);
    expect(fetchEntries).toHaveBeenCalled();
    expect(fetchProfileStats).toHaveBeenCalled();

    act(() => {
      result.current.authenticatedRoutesProps.handleDiscuss({ id: 33, content: 'Discuss me' } as never);
    });

    expect(result.current.authenticatedLayoutProps.chatEntry).toEqual({ id: 33, content: 'Discuss me' });
  });

  it('returns false for a failed tag rename and skips follow-up updates', async () => {
    renameTag.mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useAppShellModel());

    await expect(result.current.authenticatedRoutesProps.handleRenameTag('current', 'blocked')).resolves.toBe(false);

    expect(setTags).not.toHaveBeenCalled();
    expect(setEditTags).not.toHaveBeenCalled();
    expect(setFilterTags).not.toHaveBeenCalled();
    expect(fetchEntries).not.toHaveBeenCalled();
    expect(fetchProfileStats).not.toHaveBeenCalled();
  });
});