import { describe, expect, it, vi } from 'vitest';

import {
  buildAuthenticatedLayoutProps,
  buildAuthenticatedRoutesProps,
  buildPublicShellProps,
} from './appShellProps';

type BuildAuthenticatedLayoutPropsParams = Parameters<typeof buildAuthenticatedLayoutProps>[0];
type BuildAuthenticatedRoutesPropsParams = Parameters<typeof buildAuthenticatedRoutesProps>[0];

function createRoutingState(overrides: Record<string, unknown> = {}) {
  return {
    handleAuthSuccess: vi.fn(),
    handleBackFromDiaries: vi.fn(),
    handleDiaryChange: vi.fn(),
    handleImportExportRouteStateChange: vi.fn(),
    handleLogout: vi.fn().mockResolvedValue(undefined),
    handleManageDiaries: vi.fn(),
    handlePublicViewChange: vi.fn(),
    handleViewChange: vi.fn(),
    ...overrides,
  };
}

function createLayoutParams(
  overrides: Partial<BuildAuthenticatedLayoutPropsParams> = {},
): BuildAuthenticatedLayoutPropsParams {
  return {
    avatarUrl: 'https://example.com/avatar.png',
    bulkSelectState: {
      bulkModalOpen: false,
      cancelBulkModal: vi.fn(),
      confirmBulkDelete: vi.fn(),
      selectedIds: new Set([1, 2]),
    },
    chatEntry: null,
    config: { theme: 'dark', name: 'Zaid' },
    currentView: null,
    deleteModalState: {
      cancelDelete: vi.fn(),
      confirmDelete: vi.fn(),
      deleteModalOpen: false,
    },
    entryToastVisible: false,
    handleAiChat: vi.fn().mockResolvedValue(null),
    handleLoadAiChatHistory: vi.fn().mockResolvedValue([]),
    routingState: createRoutingState(),
    setChatEntry: vi.fn(),
    t: (key: string) => key,
    userName: 'Zaid',
    ...overrides,
  };
}

function createRoutesParams(
  overrides: Partial<BuildAuthenticatedRoutesPropsParams> = {},
): BuildAuthenticatedRoutesPropsParams {
  return {
    bulkSelectState: {
      bulkMode: false,
      clearSelection: vi.fn(),
      requestBulkAction: vi.fn(),
      selectedIds: new Set<number>(),
      selectAll: vi.fn(),
      toggleBulkMode: vi.fn(),
      toggleSelect: vi.fn(),
    },
    config: { theme: 'dark', name: 'Zaid', tagMetadata: '{}' },
    deleteModalState: {
      handleDelete: vi.fn().mockResolvedValue(undefined),
    },
    diariesState: {
      currentDiaryId: 3,
      diaries: [],
      handleCreateDiary: vi.fn().mockResolvedValue(undefined),
      handleDeleteDiary: vi.fn().mockResolvedValue(undefined),
      handleReorderDiaries: vi.fn().mockResolvedValue(undefined),
      handleSetDefaultDiary: vi.fn().mockResolvedValue(undefined),
      handleUpdateDiary: vi.fn().mockResolvedValue(undefined),
    },
    downloadUserData: vi.fn().mockResolvedValue(true),
    entriesState: {
      activeTargetId: null,
      allTags: ['focus', 'work'],
      availableMonths: ['2024-01'],
      availableYears: [2024],
      deleteRevision: vi.fn().mockResolvedValue(true),
      entries: [],
      fetchEntries: vi.fn().mockResolvedValue(undefined),
      fetchEntryHistory: vi.fn().mockResolvedValue([]),
      filterArchiveStatus: 'all',
      filterDateObj: null,
      filterFavorites: false,
      filterTags: [],
      filterVisibility: 'all',
      groupedEntries: {},
      inputPage: '1',
      loading: false,
      page: 1,
      reorderEntries: vi.fn().mockResolvedValue(undefined),
      search: '',
      setFilterArchiveStatus: vi.fn(),
      setFilterDateObj: vi.fn(),
      setFilterFavorites: vi.fn(),
      setFilterTags: vi.fn(),
      setFilterVisibility: vi.fn(),
      setInputPage: vi.fn(),
      setPage: vi.fn(),
      setSearch: vi.fn(),
      sourceEntry: null,
      targetEntryId: null,
      toggleArchived: vi.fn().mockResolvedValue(undefined),
      toggleFavorite: vi.fn().mockResolvedValue(undefined),
      toggleVisibility: vi.fn().mockResolvedValue(undefined),
      totalPages: 4,
    },
    entryEditState: {
      addEditPendingFile: vi.fn(),
      editDate: null,
      editExistingAttachments: [],
      editFormat: 'plain',
      editPendingFiles: [],
      editTags: [],
      editText: '',
      editVisibility: 'private',
      editingEntry: null,
      handleCancelEdit: vi.fn(),
      handleEdit: vi.fn(),
      handleSaveEdit: vi.fn().mockResolvedValue(undefined),
      removeEditAttachment: vi.fn(),
      removeEditPendingFile: vi.fn(),
      setEditDate: vi.fn(),
      setEditFormat: vi.fn(),
      setEditTags: vi.fn(),
      setEditText: vi.fn(),
      setEditVisibility: vi.fn(),
    },
    entryFormState: {
      addPendingFile: vi.fn(),
      fixingWriting: false,
      formError: '',
      format: 'markdown',
      handleFixWriting: vi.fn().mockResolvedValue(undefined),
      handleSubmit: vi.fn().mockResolvedValue(undefined),
      handleSuggestTags: vi.fn().mockResolvedValue(undefined),
      newEntryText: '',
      pendingFiles: [],
      removePendingFile: vi.fn(),
      removeUploadedAttachment: vi.fn(),
      selectedDate: new Date('2024-01-15T00:00:00.000Z'),
      setFormat: vi.fn(),
      setNewEntryText: vi.fn(),
      setSelectedDate: vi.fn(),
      setTags: vi.fn(),
      setVisibility: vi.fn(),
      suggestingTags: false,
      tags: ['focus'],
      uploadedAttachments: [],
      visibility: 'private',
    },
    entryNavigationState: {
      handleBackToSource: vi.fn().mockResolvedValue(undefined),
      handleNavigateToEntry: vi.fn().mockResolvedValue(undefined),
      handleShareEntry: vi.fn().mockResolvedValue(true),
    },
    handleDiscuss: vi.fn(),
    handleNavigateToFirst: vi.fn().mockResolvedValue(undefined),
    handleRenameTag: vi.fn().mockResolvedValue(true),
    highlightsModalOpen: false,
    importExportFormat: 'txt',
    importExportIncludeVisibility: false,
    importExportSection: 'export',
    profileStats: null,
    routingState: createRoutingState(),
    setHighlightsModalOpen: vi.fn(),
    t: (key: string) => key,
    tagMetadata: {},
    updateConfig: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('appShellProps', () => {
  it('builds public shell props for intro and register views', () => {
    const routingState = createRoutingState();

    const { introPageProps, authPageProps } = buildPublicShellProps({
      configTheme: 'light',
      publicView: 'register',
      routingState,
      t: (key: string) => key,
    });

    expect(introPageProps.theme).toBe('light');
    introPageProps.onSignIn();
    introPageProps.onSignUp();
    expect(routingState.handlePublicViewChange).toHaveBeenCalledWith('login');
    expect(routingState.handlePublicViewChange).toHaveBeenCalledWith('register');

    expect(authPageProps.mode).toBe('register');
    expect(authPageProps.onBack).toBeDefined();
    authPageProps.onBack?.();
    expect(routingState.handlePublicViewChange).toHaveBeenCalledWith('intro');
    expect(authPageProps.onAuthSuccess).toBeDefined();
    authPageProps.onAuthSuccess?.();
    expect(routingState.handleAuthSuccess).toHaveBeenCalled();
  });

  it('builds authenticated layout props with journal fallback and chat close handler', () => {
    const setChatEntry = vi.fn();
    const handleViewChange = vi.fn();
    const handleLogout = vi.fn().mockResolvedValue(undefined);
    const handleAiChat = vi.fn().mockResolvedValue('reply');
    const handleLoadAiChatHistory = vi.fn().mockResolvedValue([{ role: 'assistant', content: 'history' }]);

    const props = buildAuthenticatedLayoutProps(createLayoutParams({
      currentView: 'stats',
      handleAiChat,
      handleLoadAiChatHistory,
      routingState: createRoutingState({ handleLogout, handleViewChange }),
      setChatEntry,
    }));

    expect(props.currentView).toBe('stats');
    expect(props.userName).toBe('Zaid');
    expect(props.selectedCount).toBe(2);
    expect(props.onViewChange).toBe(handleViewChange);
    expect(props.onLogout).toBe(handleLogout);
    expect(props.onSendChat).toBe(handleAiChat);
    expect(props.onLoadChatHistory).toBe(handleLoadAiChatHistory);
    props.onCloseChat();
    expect(setChatEntry).toHaveBeenCalledWith(null);
  });

  it('builds authenticated route props with preserved journal and diary behavior', async () => {
    const fetchEntries = vi.fn().mockResolvedValue(undefined);
    const handleUpdateDiary = vi.fn().mockResolvedValue(undefined);
    const handleCancelEdit = vi.fn();
    const handleViewChange = vi.fn();

    const props = buildAuthenticatedRoutesProps(createRoutesParams({
      diariesState: {
        currentDiaryId: 3,
        diaries: [],
        handleCreateDiary: vi.fn().mockResolvedValue(undefined),
        handleDeleteDiary: vi.fn().mockResolvedValue(undefined),
        handleReorderDiaries: vi.fn().mockResolvedValue(undefined),
        handleSetDefaultDiary: vi.fn().mockResolvedValue(undefined),
        handleUpdateDiary,
      },
      entriesState: {
        activeTargetId: null,
        allTags: ['focus', 'work'],
        availableMonths: ['2024-01'],
        availableYears: [2024],
        deleteRevision: vi.fn().mockResolvedValue(true),
        entries: [],
        fetchEntries,
        fetchEntryHistory: vi.fn().mockResolvedValue([]),
        filterArchiveStatus: 'all',
        filterDateObj: null,
        filterFavorites: false,
        filterTags: [],
        filterVisibility: 'all',
        groupedEntries: {},
        inputPage: '1',
        loading: false,
        page: 1,
        reorderEntries: vi.fn().mockResolvedValue(undefined),
        search: '',
        setFilterArchiveStatus: vi.fn(),
        setFilterDateObj: vi.fn(),
        setFilterFavorites: vi.fn(),
        setFilterTags: vi.fn(),
        setFilterVisibility: vi.fn(),
        setInputPage: vi.fn(),
        setPage: vi.fn(),
        setSearch: vi.fn(),
        sourceEntry: null,
        targetEntryId: null,
        toggleArchived: vi.fn().mockResolvedValue(undefined),
        toggleFavorite: vi.fn().mockResolvedValue(undefined),
        toggleVisibility: vi.fn().mockResolvedValue(undefined),
        totalPages: 4,
      },
      entryEditState: {
        addEditPendingFile: vi.fn(),
        editDate: null,
        editExistingAttachments: [],
        editFormat: 'plain',
        editPendingFiles: [],
        editTags: [],
        editText: '',
        editVisibility: 'private',
        editingEntry: null,
        handleCancelEdit,
        handleEdit: vi.fn(),
        handleSaveEdit: vi.fn().mockResolvedValue(undefined),
        removeEditAttachment: vi.fn(),
        removeEditPendingFile: vi.fn(),
        setEditDate: vi.fn(),
        setEditFormat: vi.fn(),
        setEditTags: vi.fn(),
        setEditText: vi.fn(),
        setEditVisibility: vi.fn(),
      },
      entryFormState: {
        addPendingFile: vi.fn(),
        fixingWriting: false,
        formError: '',
        format: 'markdown',
        handleFixWriting: vi.fn().mockResolvedValue(undefined),
        handleSubmit: vi.fn().mockResolvedValue(undefined),
        handleSuggestTags: vi.fn().mockResolvedValue(undefined),
        newEntryText: '',
        pendingFiles: [],
        removePendingFile: vi.fn(),
        removeUploadedAttachment: vi.fn(),
        selectedDate: new Date('2024-01-15T00:00:00.000Z'),
        setFormat: vi.fn(),
        setNewEntryText: vi.fn(),
        setSelectedDate: vi.fn(),
        setTags: vi.fn(),
        setVisibility: vi.fn(),
        suggestingTags: false,
        tags: ['focus', 'work'],
        uploadedAttachments: [],
        visibility: 'private',
      },
      routingState: createRoutingState({ handleViewChange }),
    }));

    props.profileRouteProps.onBack();
    expect(handleViewChange).toHaveBeenCalledWith('journal');

    const updatePayload = { name: 'Work' } as Parameters<typeof props.diariesRouteProps.onUpdateDiary>[1];
    await props.diariesRouteProps.onUpdateDiary(3, updatePayload);
    expect(handleUpdateDiary).toHaveBeenCalledWith(3, updatePayload);
    expect(fetchEntries).toHaveBeenCalled();

    expect(props.importExportRouteProps.initialSection).toBe('export');
    expect(props.journalRouteProps.tags).toEqual(['focus', 'work']);
    expect(props.journalRouteProps.format).toBe('markdown');
    expect(props.journalRouteProps.onCancelEdit).toBe(handleCancelEdit);
  });

  it('wires profile, tag manager, diary management, and import-export callbacks', async () => {
    const updateConfig = vi.fn().mockResolvedValue(undefined);
    const downloadUserData = vi.fn().mockResolvedValue(true);
    const handleRenameTag = vi.fn().mockResolvedValue(true);
    const handleDeleteDiary = vi.fn().mockImplementation(async (_id: number, callback: () => Promise<void>) => {
      await callback();
    });
    const handleManageDiaries = vi.fn();
    const handleDiaryChange = vi.fn();
    const handleImportExportRouteStateChange = vi.fn();
    const handleViewChange = vi.fn();
    const fetchEntries = vi.fn().mockResolvedValue(undefined);

    const props = buildAuthenticatedRoutesProps(createRoutesParams({
      updateConfig,
      downloadUserData,
      handleRenameTag,
      diariesState: {
        currentDiaryId: 3,
        diaries: [{ id: 3, name: 'Work', icon: 'W' }],
        handleCreateDiary: vi.fn().mockResolvedValue(undefined),
        handleDeleteDiary,
        handleReorderDiaries: vi.fn().mockResolvedValue(undefined),
        handleSetDefaultDiary: vi.fn().mockResolvedValue(undefined),
        handleUpdateDiary: vi.fn().mockResolvedValue(undefined),
      },
      entriesState: {
        ...createRoutesParams().entriesState,
        fetchEntries,
      },
      routingState: createRoutingState({
        handleDiaryChange,
        handleImportExportRouteStateChange,
        handleManageDiaries,
        handleViewChange,
      }),
    }));

    await props.profileRouteProps.onUpdateConfig({ theme: 'light' } as never);
    await props.tagManagerRouteProps.onUpdateConfig({ theme: 'light' } as never);
    await props.profileRouteProps.onDownloadData();
    await props.tagManagerRouteProps.onRenameTag('old', 'new');
    await props.diariesRouteProps.onDeleteDiary(3);

    props.statsRouteProps.onManageDiaries();
    props.statsRouteProps.onDiaryChange(8);
    props.statsRouteProps.onOpenJournalDay?.('2024-01-22');
    props.importExportRouteProps.onManageDiaries();
    props.importExportRouteProps.onDiaryChange(9);
    props.importExportRouteProps.onRouteStateChange?.({
      section: 'import',
      exportFormat: 'json',
      includeVisibility: true,
    });
    props.journalRouteProps.onManageDiaries();

    expect(updateConfig).toHaveBeenCalledTimes(2);
    expect(downloadUserData).toHaveBeenCalledTimes(1);
    expect(handleRenameTag).toHaveBeenCalledWith('old', 'new');
    expect(handleDeleteDiary).toHaveBeenCalledWith(3, expect.any(Function));
    expect(fetchEntries).toHaveBeenCalled();
    expect(handleManageDiaries).toHaveBeenCalledWith('stats');
    expect(handleManageDiaries).toHaveBeenCalledWith('importExport');
    expect(handleManageDiaries).toHaveBeenCalledWith('journal');
    expect(handleDiaryChange).toHaveBeenCalledWith(8);
    expect(handleDiaryChange).toHaveBeenCalledWith(9);
    expect(props.statsRouteProps.onOpenJournalDay).toBeDefined();
    expect(props.journalRouteProps.setFilterDateObj).toHaveBeenCalledWith(new Date('2024-01-22T00:00:00.000Z'));
    expect(props.journalRouteProps.setPage).toHaveBeenCalledWith(1);
    expect(handleViewChange).toHaveBeenCalledWith('journal');
    expect(handleImportExportRouteStateChange).toHaveBeenCalledWith({
      section: 'import',
      exportFormat: 'json',
      includeVisibility: true,
    });
  });
});