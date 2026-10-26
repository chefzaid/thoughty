/**
 * Shared setup for the `useAppShellModel` specs. Each spec mocks the hook's modules with the
 * `vi.mock` lines at its top, reading `mocks` and `mockedModules` from here, and calls
 * `stubShellModelHooks()` after `vi.clearAllMocks()` before each test.
 */
import { vi } from 'vitest';

/** Every hook and builder `useAppShellModel` calls, as mocks. */
export const mocks = {
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
};

/** The modules `useAppShellModel` imports, as each spec mocks them (see the file comment). */
export const mockedModules = {
  authContext: { useAuth: mocks.useAuth },
  appRouteState: { useAppRouteState: mocks.useAppRouteState },
  appShellEffects: { useAppShellEffects: mocks.useAppShellEffects },
  appShellRouting: { useAppShellRouting: mocks.useAppShellRouting },
  entryNavigation: { useEntryNavigation: mocks.useEntryNavigation },
  appState: {
    useApiServices: mocks.useApiServices,
    useBulkSelect: mocks.useBulkSelect,
    useConfig: mocks.useConfig,
    useDeleteModal: mocks.useDeleteModal,
    useDiaries: mocks.useDiaries,
    useEntries: mocks.useEntries,
    useEntryEdit: mocks.useEntryEdit,
    useEntryForm: mocks.useEntryForm,
  },
  tagMetadata: {
    parseTagMetadata: mocks.parseTagMetadata,
    serializeTagMetadata: mocks.serializeTagMetadata,
  },
  appShellProps: {
    buildAuthenticatedLayoutProps: mocks.buildAuthenticatedLayoutProps,
    buildAuthenticatedRoutesProps: mocks.buildAuthenticatedRoutesProps,
    buildPublicShellProps: mocks.buildPublicShellProps,
  },
};

export const navigate = vi.fn();
export const logout = vi.fn().mockResolvedValue(undefined);
export const t = vi.fn((key: string) => key);
export const fetchConfig = vi.fn();
export const fetchProfileStats = vi.fn();
export const updateConfig = vi.fn();
export const downloadUserData = vi.fn();
export const fetchDiaries = vi.fn();
export const fetchEntries = vi.fn();
export const fetchEntryDates = vi.fn();
export const fetchEntryHistory = vi.fn();
export const fetchEntryBacklinks = vi.fn();
export const setPage = vi.fn();
export const setTargetEntryId = vi.fn();
export const setFilterTags = vi.fn();
export const setCurrentDiaryId = vi.fn();
export const setActiveTargetId = vi.fn();
export const setFilterArchiveStatus = vi.fn();
export const setFilterDateObj = vi.fn();
export const setFilterFavorites = vi.fn();
export const setFilterVisibility = vi.fn();
export const setSearch = vi.fn();
export const setSourceEntry = vi.fn();
export const setTags = vi.fn();
export const setEditTags = vi.fn();
export const handleEdit = vi.fn();
export const setEditText = vi.fn();
export const aiChat = vi.fn().mockResolvedValue('assistant reply');
export const fixWriting = vi.fn().mockResolvedValue('Polished text');
export const summarizeEntry = vi.fn().mockResolvedValue('Entry summary');
export const getInspiration = vi.fn().mockResolvedValue('Fresh question?');
export const getChatHistory = vi.fn().mockResolvedValue([{ role: 'assistant', content: 'history' }]);
export const renameTag = vi.fn().mockResolvedValue({ success: true });
export const deleteTag = vi.fn().mockResolvedValue({ success: true, affectedCount: 2 });
export const fetchTagUsage = vi.fn().mockResolvedValue([{ tag: 'current', count: 2 }]);
export const navigateToFirst = vi.fn().mockResolvedValue({ found: true, page: 4, entryId: 77 });

export type MockedLayoutProps = ReturnType<typeof mocks.buildAuthenticatedLayoutProps>;
export type MockedRoutesProps = ReturnType<typeof mocks.buildAuthenticatedRoutesProps>;

/** Gives every mocked hook the signed-in journal state the specs start from. */
export function stubShellModelHooks() {

  mocks.useNavigate.mockReturnValue(navigate);
  mocks.useAuth.mockReturnValue({
    isAuthenticated: true,
    loading: false,
    user: { username: 'auth-user', avatarUrl: 'auth-avatar.png', emailVerified: true },
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
    configLoaded: true,
    profileStats: { totalEntries: 12 },
    fetchConfig,
    fetchProfileStats,
    updateConfig,
    downloadUserData,
    t,
  });
  mocks.useDiaries.mockReturnValue({
    currentDiaryId: 9,
    diarySelectionReady: true,
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
      deleteTag,
      fetchTagUsage,
    },
    fetchEntries,
    fetchEntryDates,
    fetchEntryHistory,
    fetchEntryBacklinks,
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
    runSemanticSearch: vi.fn().mockResolvedValue(undefined),
    search: 'focus',
    searchMode: 'keyword',
    semanticSearchResult: null,
    semanticSearchStatus: 'idle',
    setActiveTargetId,
    setFilterArchiveStatus,
    setFilterDateObj,
    setFilterFavorites,
    setFilterTags,
    setFilterVisibility,
    setInputPage: vi.fn(),
    setPage,
    setSearch,
    setSearchMode: vi.fn(),
    setSourceEntry,
    setTargetEntryId,
    sourceEntry: null,
    targetEntryId: null,
    toggleArchived: vi.fn(),
    toggleFavorite: vi.fn(),
    togglePinned: vi.fn(),
    setEntryTask: vi.fn(),
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
    handleEdit,
    handleSaveEdit: vi.fn(),
    removeEditAttachment: vi.fn(),
    removeEditPendingFile: vi.fn(),
    setEditDate: vi.fn(),
    setEditFormat: vi.fn(),
    setEditTags,
    setEditText,
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
    entryToast: { visible: true, showCount: 1, show: vi.fn(), hide: vi.fn() },
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
      fixWriting,
      summarizeEntry,
      getInspiration,
      getChatHistory,
    },
  });
}
