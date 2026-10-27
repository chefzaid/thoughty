import { describe, expect, it, vi } from 'vitest';
import { buildAuthenticatedLayoutProps, buildAuthenticatedRoutesProps, buildPublicShellProps } from './appShellProps';
import { createLayoutParams, createRoutesParams, createRoutingState } from './appShellProps.test-helpers';

describe('appShellProps', () => {
  it('builds public shell props for intro and register views', () => {
    const routingState = createRoutingState();

    const { introPageProps, authPageProps, verifyEmailPageProps } = buildPublicShellProps({
      configTheme: 'light',
      publicView: 'register',
      routingState,
      t: (key: string) => key,
    });

    expect(introPageProps.theme).toBe('light');
    expect(introPageProps.isAuthenticated).toBeUndefined();
    introPageProps.onSignIn();
    introPageProps.onSignUp();
    introPageProps.onOpenJournal();
    expect(routingState.handlePublicViewChange).toHaveBeenCalledWith('login');
    expect(routingState.handlePublicViewChange).toHaveBeenCalledWith('register');
    expect(routingState.handleViewChange).toHaveBeenCalledWith('journal');

    expect(authPageProps.mode).toBe('register');
    expect(authPageProps.onBack).toBeDefined();
    authPageProps.onBack?.();
    expect(routingState.handlePublicViewChange).toHaveBeenCalledWith('intro');
    expect(authPageProps.onAuthSuccess).toBeDefined();
    authPageProps.onAuthSuccess?.();
    expect(routingState.handleAuthSuccess).toHaveBeenCalled();

    verifyEmailPageProps.onContinue();
    expect(routingState.handlePublicViewChange).toHaveBeenCalledWith('login');
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
    expect(props.isEmailVerified).toBe(true);
    expect(props.selectedCount).toBe(2);
    expect(props.noticeText).toBe('');
    expect(props.notice).toMatchObject({ visible: false });
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
        fetchDiaries: vi.fn().mockResolvedValue(undefined),
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
        fetchEntryBacklinks: vi.fn().mockResolvedValue([]),
        filterArchiveStatus: 'all',
        filterDateObj: null,
        filterFavorites: false,
        filterMood: '',
        filterEraId: null,
        filterTags: [],
        filterVisibility: 'all',
        groupedEntries: {},
        inputPage: '1',
        loading: false,
        page: 1,
        rankedResults: true,
        reorderEntries: vi.fn().mockResolvedValue(undefined),
        runSemanticSearch: vi.fn().mockResolvedValue(undefined),
        search: '',
        searchMode: 'keyword',
        searchSort: 'date',
        semanticSearchResult: null,
        semanticSearchStatus: 'idle',
        setFilterArchiveStatus: vi.fn(),
        setFilterDateObj: vi.fn(),
        setFilterFavorites: vi.fn(),
        setFilterMood: vi.fn(),
        setFilterEraId: vi.fn(),
        setFilterTags: vi.fn(),
        setFilterVisibility: vi.fn(),
        setInputPage: vi.fn(),
        setPage: vi.fn(),
        setSearch: vi.fn(),
        setSearchMode: vi.fn(),
        setSearchSort: vi.fn(),
        sourceEntry: null,
        targetEntryId: null,
        toggleArchived: vi.fn().mockResolvedValue(undefined),
        toggleFavorite: vi.fn().mockResolvedValue(undefined),
        togglePinned: vi.fn().mockResolvedValue(undefined),
        setEntryTask: vi.fn(),
        toggleVisibility: vi.fn().mockResolvedValue(undefined),
        totalPages: 4,
      },
      entryEditState: {
        addEditPendingFile: vi.fn(),
        editDate: null,
        editExistingAttachments: [],
        editFeelings: [],
        editFormat: 'plain',
        editMood: null,
        editPendingFiles: [],
        editTags: [],
        editText: '',
        editTimeOfDay: '',
        editTitle: '',
        editVisibility: 'private',
        editingEntry: null,
        handleCancelEdit,
        handleEdit: vi.fn(),
        handleSaveEdit: vi.fn().mockResolvedValue(undefined),
        removeEditAttachment: vi.fn(),
        removeEditPendingFile: vi.fn(),
        setEditDate: vi.fn(),
        setEditFeelings: vi.fn(),
        setEditFormat: vi.fn(),
        setEditMood: vi.fn(),
        setEditTags: vi.fn(),
        setEditText: vi.fn(),
        setEditTimeOfDay: vi.fn(),
        setEditTitle: vi.fn(),
        setEditVisibility: vi.fn(),
      },
      entryFormState: {
        addPendingFile: vi.fn(),
        feelings: [],
        fixingWriting: false,
        formError: '',
        format: 'markdown',
        handleFixWriting: vi.fn().mockResolvedValue(undefined),
        handleSubmit: vi.fn().mockResolvedValue(undefined),
        handleSuggestTags: vi.fn().mockResolvedValue(undefined),
        mood: null,
        newEntryText: '',
        pendingFiles: [],
        removePendingFile: vi.fn(),
        removeUploadedAttachment: vi.fn(),
        selectedDate: new Date('2024-01-15T00:00:00.000Z'),
        setFeelings: vi.fn(),
        setFormat: vi.fn(),
        setMood: vi.fn(),
        setNewEntryText: vi.fn(),
        setSelectedDate: vi.fn(),
        setTags: vi.fn(),
        setTimeOfDay: vi.fn(),
        setTitle: vi.fn(),
        setVisibility: vi.fn(),
        suggestingTags: false,
        tags: ['focus', 'work'],
        timeOfDay: '',
        title: '',
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
    expect(props.journalRouteProps.entryForm.tags).toEqual(['focus', 'work']);
    expect(props.journalRouteProps.entryForm.format).toBe('markdown');
    expect(props.journalRouteProps.entriesList.onCancelEdit).toBe(handleCancelEdit);
    expect(props.journalRouteProps.entriesList.rankedOrder).toBe(true);
    expect(props.journalRouteProps.filters.searchSort).toBe('date');
  });
});
