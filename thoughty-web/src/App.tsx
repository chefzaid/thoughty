import { useState, useCallback, useMemo, useEffect } from 'react';
import { BrowserRouter, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import "react-datepicker/dist/react-datepicker.css";

// Components
import ProfilePage from './components/ProfilePage/ProfilePage';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import NavMenu from './components/NavMenu/NavMenu';
import Stats from './components/Stats/Stats';
import ImportExport from './components/ImportExport/ImportExport';
import TagManagerPage from './components/TagManagerPage/TagManagerPage';
import Footer from './components/Footer/Footer';
import DiaryTabs from './components/DiaryTabs/DiaryTabs';
import DiaryManager from './components/DiaryManager/DiaryManager';
import AuthPage from './components/AuthPage/AuthPage';
import JournalView from './components/JournalView/JournalView';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import IntroPage from './components/IntroPage/IntroPage';
import AiChatModal from './components/AiChatModal/AiChatModal';
import { assignMissingTagColors, parseTagMetadata, serializeTagMetadata } from './utils/tagMetadata';

// Context and Hooks
import { useAuth } from './contexts/AuthContext';
import {
  useConfig,
  useDiaries,
  useEntries,
  useEntryForm,
  useEntryEdit,
  useDeleteModal,
  useBulkSelect,
  useApiServices
} from './hooks/useAppState';

// Types
import type { ViewType, PublicViewType, DiaryReturnViewType, ImportExportFormat, ImportExportSection, SourceEntryInfo, Config, Entry } from './types';
import {
  formatDiarySearchParam,
  getPathForView,
  getPublicPathForView,
  getPublicViewForPath,
  getViewForPath,
  parseBooleanSearchParam,
  parseDiaryReturnView,
  parseDiarySearchParam,
  parseEntrySearchParam,
  parseImportExportFormat,
  parseImportExportSection,
  viewSupportsDiarySearch,
} from './types';

const ENTRY_PERMALINK_PARAM = 'entry';

function buildEntryPermalink(entryId: number): string {
  const url = new URL(getPathForView('journal'), globalThis.location.origin);
  url.searchParams.set(ENTRY_PERMALINK_PARAM, entryId.toString());
  return url.toString();
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!globalThis.navigator.clipboard?.writeText) {
    return false;
  }

  await globalThis.navigator.clipboard.writeText(text);
  return true;
}

function toSearchString(searchParams: URLSearchParams): string {
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

function buildDiaryRouteSearchParams(
  view: ViewType,
  diaryId: number | null,
  options?: {
    importExportSection?: ImportExportSection;
    importExportFormat?: ImportExportFormat;
    importExportIncludeVisibility?: boolean;
  },
): URLSearchParams {
  const nextSearchParams = new URLSearchParams();

  if (viewSupportsDiarySearch(view)) {
    nextSearchParams.set('diary', formatDiarySearchParam(diaryId));
  }

  if (view === 'importExport') {
    nextSearchParams.set('section', options?.importExportSection ?? 'export');
    nextSearchParams.set('format', options?.importExportFormat ?? 'txt');

    if (options?.importExportIncludeVisibility) {
      nextSearchParams.set('includeVisibility', 'true');
    }
  }

  return nextSearchParams;
}

function AppContent() {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentView = getViewForPath(location.pathname);
  const publicView = getPublicViewForPath(location.pathname);
  const routeDiaryId = currentView && viewSupportsDiarySearch(currentView)
    ? parseDiarySearchParam(searchParams)
    : undefined;
  const routeEntryId = currentView === 'journal'
    ? parseEntrySearchParam(searchParams)
    : undefined;
  const diaryReturnView = parseDiaryReturnView(searchParams) ?? 'journal';
  const importExportSection = parseImportExportSection(searchParams) ?? 'export';
  const importExportFormat = parseImportExportFormat(searchParams) ?? 'txt';
  const importExportIncludeVisibility = parseBooleanSearchParam(searchParams, 'includeVisibility') ?? false;
  const [highlightsModalOpen, setHighlightsModalOpen] = useState<boolean>(false);
  const [entryToastVisible, setEntryToastVisible] = useState<boolean>(false);
  const [entryToastToken, setEntryToastToken] = useState<number>(0);
  const [handledPermalinkEntryId, setHandledPermalinkEntryId] = useState<number | null>(null);
  const [pendingEntryTarget, setPendingEntryTarget] = useState<{
    date: string;
    index: number;
    highlight: boolean;
  } | null>(null);

  // Config and profile stats
  const { 
    config, 
    profileStats, 
    fetchConfig, 
    fetchProfileStats, 
    updateConfig, 
    downloadUserData,
    t 
  } = useConfig(isAuthenticated);

  // Diaries management
  const {
    diaries,
    currentDiaryId,
    setCurrentDiaryId,
    fetchDiaries,
    handleCreateDiary,
    handleUpdateDiary,
    handleDeleteDiary,
    handleSetDefaultDiary,
    handleReorderDiaries
  } = useDiaries(isAuthenticated, routeEntryId !== undefined || routeDiaryId !== undefined);

  // Entries management
  const {
    entries,
    groupedEntries,
    loading,
    allTags,
    page,
    setPage,
    totalPages,
    inputPage,
    setInputPage,
    search,
    setSearch,
    filterTags,
    setFilterTags,
    filterDateObj,
    setFilterDateObj,
    filterVisibility,
    setFilterVisibility,
    filterFavorites,
    setFilterFavorites,
    availableYears,
    availableMonths,
    targetEntryId,
    setTargetEntryId,
    activeTargetId,
    setActiveTargetId,
    sourceEntry,
    setSourceEntry,
    fetchEntries,
    fetchEntryDates,
    getLimit,
    entriesService,
    toggleVisibility,
    toggleFavorite,
    fetchEntryHistory,
    deleteRevision,
    reorderEntries
  } = useEntries(isAuthenticated, config, currentDiaryId);

  // Entry form
  const {
    newEntryText,
    setNewEntryText,
    tags,
    setTags,
    selectedDate,
    setSelectedDate,
    visibility,
    setVisibility,
    format,
    setFormat,
    formError,
    suggestingTags,
    handleSuggestTags,
    fixingWriting,
    handleFixWriting,
    handleSubmit,
    pendingFiles,
    uploadedAttachments,
    addPendingFile,
    removePendingFile,
    removeUploadedAttachment
  } = useEntryForm(config, currentDiaryId, () => {
    setPage(1);
    fetchEntries();
    fetchEntryDates();
  });

  // Entry editing
  const {
    editingEntry,
    editText,
    setEditText,
    editTags,
    setEditTags,
    editDate,
    setEditDate,
    editVisibility,
    setEditVisibility,
    editFormat,
    setEditFormat,
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    editPendingFiles,
    editExistingAttachments,
    addEditPendingFile,
    removeEditPendingFile,
    removeEditAttachment
  } = useEntryEdit(config, fetchEntries);

  // Delete modal
  const {
    deleteModalOpen,
    handleDelete,
    confirmDelete,
    cancelDelete
  } = useDeleteModal(fetchEntries);

  // Bulk operations
  const {
    bulkMode,
    selectedIds,
    bulkModalOpen,
    toggleBulkMode,
    toggleSelect,
    selectAll,
    clearSelection,
    requestBulkAction,
    confirmBulkDelete,
    cancelBulkModal,
  } = useBulkSelect(fetchEntries);

  // Navigation handlers
  const handleNavigateToFirst = useCallback(async (year: number, month: number | null) => {
    const data = await entriesService.navigateToFirst(year, month, getLimit());
    if (data?.found) {
      setPage(data.page || 1);
      if (data.entryId) {
        setTargetEntryId(data.entryId);
      }
    }
  }, [entriesService, getLimit, setPage, setTargetEntryId]);

  const handleBackToSource = useCallback(async () => {
    if (!sourceEntry) return;

    const data = await entriesService.navigateById(sourceEntry.id, getLimit());
    if (data?.found) {
      setPage(data.page || 1);
      setTargetEntryId(data.entryId || null);
    }

    setSourceEntry(null);
    setActiveTargetId(null);
    setPendingEntryTarget(null);
  }, [sourceEntry, entriesService, getLimit, setPage, setTargetEntryId, setSourceEntry, setActiveTargetId]);

  const handleShareEntry = useCallback(async (entry: Entry): Promise<boolean> => {
    const url = buildEntryPermalink(entry.id);

    try {
      if (typeof globalThis.navigator.share === 'function') {
        await globalThis.navigator.share({
          title: t('shareEntry'),
          url,
        });
        return true;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return false;
      }
    }

    try {
      return await copyTextToClipboard(url);
    } catch (error) {
      console.error('Error sharing entry:', error);
      return false;
    }
  }, [t]);

  const needsJournalResetForPermalink = useCallback((): boolean => {
    if (search !== '') {
      return true;
    }

    if (filterTags.length > 0) {
      return true;
    }

    if (filterDateObj !== null) {
      return true;
    }

    if (filterVisibility !== 'all') {
      return true;
    }

    if (filterFavorites) {
      return true;
    }

    if (currentDiaryId !== null) {
      return true;
    }

    if (currentView === 'journal' && searchParams.get('diary') !== 'all') {
      return true;
    }

    return page !== 1;
  }, [
    currentDiaryId,
    currentView,
    filterDateObj,
    filterFavorites,
    filterTags,
    filterVisibility,
    page,
    search,
    searchParams,
  ]);

  const resetJournalFiltersForPermalink = useCallback((): void => {
    if (!needsJournalResetForPermalink()) {
      return;
    }

    if (search !== '') {
      setSearch('');
    }

    if (filterTags.length > 0) {
      setFilterTags([]);
    }

    if (filterDateObj !== null) {
      setFilterDateObj(null);
    }

    if (filterVisibility !== 'all') {
      setFilterVisibility('all');
    }

    if (filterFavorites) {
      setFilterFavorites(false);
    }

    if (currentDiaryId !== null) {
      setCurrentDiaryId(null);
    }

    if (currentView === 'journal') {
      const nextSearchParams = new URLSearchParams(searchParams);

      if (nextSearchParams.get('diary') !== 'all') {
        nextSearchParams.set('diary', 'all');
        navigate({
          pathname: getPathForView('journal'),
          search: toSearchString(nextSearchParams),
        }, { replace: true });
      }
    }

    if (page !== 1) {
      setPage(1);
    }
  }, [
    currentDiaryId,
    currentView,
    filterDateObj,
    filterFavorites,
    filterTags,
    filterVisibility,
    navigate,
    needsJournalResetForPermalink,
    page,
    searchParams,
    search,
    setCurrentDiaryId,
    setFilterDateObj,
    setFilterFavorites,
    setFilterTags,
    setFilterVisibility,
    setPage,
    setSearch,
  ]);

  const clearJournalPermalink = useCallback(() => {
    if (currentView === 'journal' && searchParams.has(ENTRY_PERMALINK_PARAM)) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete(ENTRY_PERMALINK_PARAM);
      navigate({
        pathname: getPathForView('journal'),
        search: toSearchString(nextSearchParams),
      }, { replace: true });
      setHandledPermalinkEntryId(null);
    }
  }, [currentView, navigate, searchParams]);

  const showEntryNotFoundToast = useCallback(() => {
    setEntryToastVisible(true);
    setEntryToastToken((previousToken) => previousToken + 1);
  }, []);

  useEffect(() => {
    if (!entryToastVisible) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setEntryToastVisible(false);
    }, 4000);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [entryToastToken, entryToastVisible]);

  const executeEntryNavigation = useCallback(async (
    date: string,
    index: number,
    highlight: boolean,
  ) => {
    const data = await entriesService.navigateByDate(date, index, getLimit());
    if (data?.found) {
      setPage(data.page || 1);
      if (highlight) {
        setTargetEntryId(data.entryId || null);
      }
      setActiveTargetId(data.entryId || null);
    } else {
      showEntryNotFoundToast();
      setSourceEntry(null);
      setActiveTargetId(null);
      setPendingEntryTarget(null);
    }
  }, [entriesService, getLimit, setActiveTargetId, setPage, setSourceEntry, setTargetEntryId, showEntryNotFoundToast]);

  const handleNavigateToEntry = useCallback(async (
    date: string,
    index: number = 1,
    sourceEntryInfo: SourceEntryInfo | null = null,
    highlight: boolean = true
  ) => {
    clearJournalPermalink();

    if (sourceEntryInfo) {
      setSourceEntry({
        id: sourceEntryInfo.id,
        date: sourceEntryInfo.date,
        index: sourceEntryInfo.index
      });
    }

    setPendingEntryTarget({ date, index, highlight });

    if (needsJournalResetForPermalink()) {
      resetJournalFiltersForPermalink();
    }

    await executeEntryNavigation(date, index, highlight);
  }, [clearJournalPermalink, executeEntryNavigation, needsJournalResetForPermalink, resetJournalFiltersForPermalink, setSourceEntry]);

  useEffect(() => {
    if (!pendingEntryTarget || loading || entries.length === 0) {
      return;
    }

    const matchedEntry = entries.find((entry) => {
      const entryDate = entry.date.includes('T') ? entry.date.split('T')[0] : entry.date;
      return entryDate === pendingEntryTarget.date && (entry.index || 1) === pendingEntryTarget.index;
    });

    if (!matchedEntry) {
      return;
    }

    if (pendingEntryTarget.highlight) {
      setTargetEntryId(matchedEntry.id);
    }

    setActiveTargetId(matchedEntry.id);
    setPendingEntryTarget(null);
  }, [entries, loading, pendingEntryTarget, setActiveTargetId, setTargetEntryId]);

  useEffect(() => {
    if (routeEntryId === undefined) {
      if (handledPermalinkEntryId !== null) {
        setHandledPermalinkEntryId(null);
      }
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    if (needsJournalResetForPermalink()) {
      resetJournalFiltersForPermalink();
      return;
    }

    if (handledPermalinkEntryId === routeEntryId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const data = await entriesService.navigateById(routeEntryId, getLimit());
      if (cancelled) {
        return;
      }

      if (data?.found) {
        const resolvedEntryId = data.entryId || routeEntryId;
        setPage(data.page || 1);
        setTargetEntryId(resolvedEntryId);
        setActiveTargetId(resolvedEntryId);
      } else {
        setSourceEntry(null);
        setActiveTargetId(null);
        showEntryNotFoundToast();
      }

      setHandledPermalinkEntryId(routeEntryId);
    })();

    return () => {
      cancelled = true;
    };
  }, [entriesService, getLimit, handledPermalinkEntryId, isAuthenticated, needsJournalResetForPermalink, resetJournalFiltersForPermalink, routeEntryId, setActiveTargetId, setPage, setSourceEntry, setTargetEntryId, showEntryNotFoundToast]);

  // Auth success handler
  const handleAuthSuccess = useCallback(() => {
    fetchConfig();
    fetchDiaries();
    fetchEntryDates();
    fetchProfileStats();
  }, [fetchConfig, fetchDiaries, fetchEntryDates, fetchProfileStats]);

  const handleViewChange = useCallback((view: ViewType) => {
    const nextSearchParams = new URLSearchParams();
    if (viewSupportsDiarySearch(view)) {
      nextSearchParams.set('diary', formatDiarySearchParam(currentDiaryId));
    }
    navigate({
      pathname: getPathForView(view),
      search: toSearchString(nextSearchParams),
    });
  }, [currentDiaryId, navigate]);

  const handlePublicViewChange = useCallback((view: PublicViewType) => {
    navigate(getPublicPathForView(view));
  }, [navigate]);

  const handleDiaryChange = useCallback((diaryId: number | null) => {
    setCurrentDiaryId(diaryId);

    if (!currentView || !viewSupportsDiarySearch(currentView)) {
      return;
    }

    const nextSearchParams = buildDiaryRouteSearchParams(currentView, diaryId, {
      importExportSection,
      importExportFormat,
      importExportIncludeVisibility,
    });

    navigate({
      pathname: getPathForView(currentView),
      search: toSearchString(nextSearchParams),
    }, { replace: true });
  }, [currentView, importExportFormat, importExportIncludeVisibility, importExportSection, navigate, setCurrentDiaryId]);

  const handleManageDiaries = useCallback((fromView: DiaryReturnViewType) => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set('from', fromView);
    nextSearchParams.set('diary', formatDiarySearchParam(currentDiaryId));

    navigate({
      pathname: getPathForView('diaries'),
      search: toSearchString(nextSearchParams),
    });
  }, [currentDiaryId, navigate]);

  const handleBackFromDiaries = useCallback(() => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set('diary', formatDiarySearchParam(currentDiaryId));

    navigate({
      pathname: getPathForView(diaryReturnView),
      search: toSearchString(nextSearchParams),
    });
  }, [currentDiaryId, diaryReturnView, navigate]);

  const handleImportExportRouteStateChange = useCallback((nextState: {
    section: ImportExportSection;
    exportFormat: ImportExportFormat;
    includeVisibility: boolean;
  }) => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set('diary', formatDiarySearchParam(currentDiaryId));
    nextSearchParams.set('section', nextState.section);
    nextSearchParams.set('format', nextState.exportFormat);
    if (nextState.includeVisibility) {
      nextSearchParams.set('includeVisibility', 'true');
    }

    navigate({
      pathname: getPathForView('importExport'),
      search: toSearchString(nextSearchParams),
    }, { replace: true });
  }, [currentDiaryId, navigate]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(getPublicPathForView('intro'), { replace: true });
  }, [logout, navigate]);

  // AI Chat
  const { aiService } = useApiServices();
  const [chatEntry, setChatEntry] = useState<Entry | null>(null);

  const handleDiscuss = useCallback((entry: Entry) => {
    setChatEntry(entry);
  }, []);

  const handleAiChat = useCallback(async (entryContent: string, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    return aiService.chat(entryContent, messages);
  }, [aiService]);

  const tagMetadata = useMemo(() => parseTagMetadata(config.tagMetadata), [config.tagMetadata]);
  const serializedTagMetadata = useMemo(() => serializeTagMetadata(tagMetadata), [tagMetadata]);

  const handleRenameTag = useCallback(async (currentTag: string, nextTag: string) => {
    const result = await entriesService.renameTag(currentTag, nextTag);
    if (!result?.success) {
      return false;
    }

    setTags((prev) => [...new Set(prev.map((tag) => (tag === currentTag ? nextTag : tag)))]);
    setEditTags((prev) => [...new Set(prev.map((tag) => (tag === currentTag ? nextTag : tag)))]);
    setFilterTags((prev) => [...new Set(prev.map((tag) => (tag === currentTag ? nextTag : tag)))]);

    fetchEntries();
    fetchProfileStats();
    return true;
  }, [entriesService, fetchEntries, fetchProfileStats, setEditTags, setFilterTags, setTags]);

  useEffect(() => {
    if (!isAuthenticated || allTags.length === 0) {
      return;
    }

    const nextTagMetadata = assignMissingTagColors(allTags, tagMetadata);
    const nextSerializedTagMetadata = serializeTagMetadata(nextTagMetadata);

    if (nextSerializedTagMetadata === serializedTagMetadata) {
      return;
    }

    void updateConfig({
      ...config,
      tagMetadata: nextSerializedTagMetadata,
    });
  }, [allTags, config, isAuthenticated, serializedTagMetadata, tagMetadata, updateConfig]);

  useEffect(() => {
    if (!isAuthenticated || routeDiaryId === undefined || routeDiaryId === currentDiaryId) {
      return;
    }

    setCurrentDiaryId(routeDiaryId);
  }, [currentDiaryId, isAuthenticated, routeDiaryId, setCurrentDiaryId]);

  // Render view content
  const renderViewContent = () => {
    if (!currentView) {
      return null;
    }

    switch (currentView) {
      case 'profile':
        return (
          <ProfilePage
            config={config}
            onUpdateConfig={(newConfig: Config) => updateConfig(newConfig)}
            onDownloadData={downloadUserData}
            onBack={() => handleViewChange('journal')}
            t={t}
            stats={profileStats ?? undefined}
          />
        );
      case 'tags':
        return (
          <TagManagerPage
            config={config}
            allTags={allTags}
            onUpdateConfig={(newConfig: Config) => updateConfig(newConfig)}
            onRenameTag={handleRenameTag}
            t={t}
          />
        );
      case 'diaries':
        return (
          <DiaryManager
            diaries={diaries}
            onCreateDiary={handleCreateDiary}
            onUpdateDiary={async (id, data) => {
              await handleUpdateDiary(id, data);
              fetchEntries();
            }}
            onDeleteDiary={(id: number) => handleDeleteDiary(id, fetchEntries)}
            onSetDefault={handleSetDefaultDiary}
            onReorderDiaries={handleReorderDiaries}
            onBack={handleBackFromDiaries}
            theme={config.theme}
            t={t}
          />
        );
      case 'stats':
        return (
          <>
            <DiaryTabs
              diaries={diaries}
              currentDiaryId={currentDiaryId}
              onDiaryChange={handleDiaryChange}
              onManageDiaries={() => handleManageDiaries('stats')}
              theme={config.theme}
              t={t}
            />
            <Stats theme={config.theme} t={t} diaryId={currentDiaryId} tagMetadata={tagMetadata} />
          </>
        );
      case 'importExport':
        return (
          <>
            <DiaryTabs
              diaries={diaries}
              currentDiaryId={currentDiaryId}
              onDiaryChange={handleDiaryChange}
              onManageDiaries={() => handleManageDiaries('importExport')}
              theme={config.theme}
              t={t}
            />
            <ImportExport
              theme={config.theme}
              t={t}
              diaryId={currentDiaryId}
              diaryName={diaries.find(d => d.id === currentDiaryId)?.name || t('allDiaries')}
              initialSection={importExportSection}
              initialExportFormat={importExportFormat}
              initialIncludeVisibility={importExportIncludeVisibility}
              onRouteStateChange={handleImportExportRouteStateChange}
            />
          </>
        );
      default: // 'journal' view
        return (
          <JournalView
            diaries={diaries}
            currentDiaryId={currentDiaryId}
            onDiaryChange={handleDiaryChange}
            onManageDiaries={() => handleManageDiaries('journal')}
            highlightsModalOpen={highlightsModalOpen}
            setHighlightsModalOpen={setHighlightsModalOpen}
            newEntryText={newEntryText}
            setNewEntryText={setNewEntryText}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            tags={tags}
            setTags={setTags}
            visibility={visibility}
            setVisibility={setVisibility}
            format={format}
            setFormat={setFormat}
            allTags={allTags}
            tagMetadata={tagMetadata}
            formError={formError}
            suggestingTags={suggestingTags}
            onSuggestTags={handleSuggestTags}
            fixingWriting={fixingWriting}
            onFixWriting={handleFixWriting}
            onSubmit={handleSubmit}
            pendingFiles={pendingFiles}
            uploadedAttachments={uploadedAttachments}
            onAddFile={addPendingFile}
            onRemovePendingFile={removePendingFile}
            onRemoveUploadedAttachment={removeUploadedAttachment}
            search={search}
            setSearch={setSearch}
            filterTags={filterTags}
            setFilterTags={setFilterTags}
            filterDateObj={filterDateObj}
            setFilterDateObj={setFilterDateObj}
            filterVisibility={filterVisibility}
            setFilterVisibility={setFilterVisibility}
            filterFavorites={filterFavorites}
            setFilterFavorites={setFilterFavorites}
            setPage={setPage}
            loading={loading}
            entries={entries}
            groupedEntries={groupedEntries}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleVisibility={toggleVisibility}
            onToggleFavorite={toggleFavorite}
            editingEntry={editingEntry}
            editText={editText}
            setEditText={setEditText}
            editTags={editTags}
            setEditTags={setEditTags}
            editDate={editDate}
            setEditDate={setEditDate}
            editVisibility={editVisibility}
            setEditVisibility={setEditVisibility}
            editFormat={editFormat}
            setEditFormat={setEditFormat}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            editPendingFiles={editPendingFiles}
            editExistingAttachments={editExistingAttachments}
            onAddEditFile={addEditPendingFile}
            onRemoveEditPendingFile={removeEditPendingFile}
            onRemoveEditAttachment={removeEditAttachment}
            onNavigateToEntry={handleNavigateToEntry}
            onShareEntry={handleShareEntry}
            getEntryPermalink={buildEntryPermalink}
            sourceEntry={sourceEntry}
            targetEntryId={targetEntryId}
            activeTargetId={activeTargetId}
            onBackToSource={handleBackToSource}
            bulkMode={bulkMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onBulkAction={requestBulkAction}
            onToggleBulkMode={toggleBulkMode}
            page={page}
            totalPages={totalPages}
            inputPage={inputPage}
            setInputPage={setInputPage}
            availableYears={availableYears}
            availableMonths={availableMonths}
            onNavigateToFirst={handleNavigateToFirst}
            onFetchHistory={fetchEntryHistory}
            onDeleteRevision={deleteRevision}
            onReorderEntries={reorderEntries}
            onDiscuss={handleDiscuss}
            config={config}
            t={t}
          />
        );
    }
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return <LoadingSpinner />;
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    if (!publicView) {
      return <Navigate to={getPublicPathForView('intro')} replace />;
    }

    if (publicView === 'intro') {
      return (
        <IntroPage
          theme={config.theme || 'dark'}
          t={t}
          onSignIn={() => handlePublicViewChange('login')}
          onSignUp={() => handlePublicViewChange('register')}
        />
      );
    }

    return (
      <AuthPage
        t={t}
        theme={config.theme || 'dark'}
        mode={publicView}
        onAuthSuccess={handleAuthSuccess}
        onModeChange={handlePublicViewChange}
        onBack={() => handlePublicViewChange('intro')}
      />
    );
  }

  if (location.pathname === '/') {
    return <Navigate to={getPathForView('journal')} replace />;
  }

  if (!currentView) {
    return <Navigate to={getPathForView('journal')} replace />;
  }

  return (
    <div className={`min-h-screen p-4 md:p-6 lg:p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
      <div className="max-w-7xl mx-auto">
        <NavMenu
          currentView={currentView}
          onViewChange={handleViewChange}
          theme={config.theme ?? 'dark'}
          name={config.name || user?.username || 'User'}
          avatarUrl={config.avatarUrl || user?.avatarUrl}
          t={t}
          onLogout={handleLogout}
        />

        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title={t('deleteEntryTitle')}
          message={t('deleteEntryMessage')}
          theme={config.theme}
        />

        <ConfirmModal
          isOpen={bulkModalOpen}
          onClose={cancelBulkModal}
          onConfirm={confirmBulkDelete}
          title={t('bulkDeleteTitle')}
          message={t('bulkDeleteMessage', { count: selectedIds.size })}
          theme={config.theme}
        />

        {entryToastVisible && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
            <div
              role="alert"
              aria-live="assertive"
              className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-xl backdrop-blur ${config.theme === 'light' ? 'border-amber-200 bg-white/95 text-gray-900' : 'border-amber-400/30 bg-gray-800/95 text-gray-100'}`}
            >
              <p className="text-sm font-semibold text-amber-500">{t('entryNotFound')}</p>
              <p className={`mt-1 text-sm ${config.theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>{t('entryNotFoundMessage')}</p>
            </div>
          </div>
        )}

        {chatEntry && (
          <AiChatModal
            entry={chatEntry}
            isOpen={!!chatEntry}
            onClose={() => setChatEntry(null)}
            onSend={handleAiChat}
            theme={config.theme}
            t={t}
          />
        )}

        {renderViewContent()}

        <Footer t={t} theme={config.theme ?? 'dark'} />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
