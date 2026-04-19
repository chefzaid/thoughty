import { useState, useCallback } from 'react';
import "react-datepicker/dist/react-datepicker.css";

// Components
import ProfilePage from './components/ProfilePage/ProfilePage';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import NavMenu from './components/NavMenu/NavMenu';
import Stats from './components/Stats/Stats';
import ImportExport from './components/ImportExport/ImportExport';
import Footer from './components/Footer/Footer';
import DiaryTabs from './components/DiaryTabs/DiaryTabs';
import DiaryManager from './components/DiaryManager/DiaryManager';
import AuthPage from './components/AuthPage/AuthPage';
import JournalView from './components/JournalView/JournalView';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import IntroPage from './components/IntroPage/IntroPage';
import AiChatModal from './components/AiChatModal/AiChatModal';

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
import type { ViewType, SourceEntryInfo, Config, Entry } from './types';

function App() {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  const [authView, setAuthView] = useState<'intro' | 'login' | 'register'>('intro');
  
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewType>('journal');
  const [highlightsModalOpen, setHighlightsModalOpen] = useState<boolean>(false);

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
  } = useDiaries(isAuthenticated);

  // Entries management
  const {
    entries,
    groupedEntries,
    loading,
    allTags,
    entryDates,
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
    deleteRevision
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

  const handleNavigateToEntry = useCallback(async (
    date: string,
    index: number = 1,
    sourceEntryInfo: SourceEntryInfo | null = null,
    highlight: boolean = true
  ) => {
    if (sourceEntryInfo) {
      setSourceEntry({
        id: sourceEntryInfo.id,
        date: sourceEntryInfo.date,
        index: sourceEntryInfo.index
      });
    }

    const data = await entriesService.navigateByDate(date, index, getLimit());
    if (data?.found) {
      setPage(data.page || 1);
      if (highlight) {
        setTargetEntryId(data.entryId || null);
      }
      setActiveTargetId(data.entryId || null);
    } else {
      alert(t('entryNotFound'));
      setSourceEntry(null);
    }
  }, [entriesService, getLimit, setPage, setTargetEntryId, setActiveTargetId, setSourceEntry, t]);

  const handleBackToSource = useCallback(async () => {
    if (!sourceEntry) return;

    const data = await entriesService.navigateById(sourceEntry.id, getLimit());
    if (data?.found) {
      setPage(data.page || 1);
      setTargetEntryId(data.entryId || null);
    }

    setSourceEntry(null);
    setActiveTargetId(null);
  }, [sourceEntry, entriesService, getLimit, setPage, setTargetEntryId, setSourceEntry, setActiveTargetId]);

  // Auth success handler
  const handleAuthSuccess = useCallback(() => {
    fetchConfig();
    fetchDiaries();
    fetchEntryDates();
    fetchProfileStats();
  }, [fetchConfig, fetchDiaries, fetchEntryDates, fetchProfileStats]);

  const handleLogout = useCallback(async () => {
    await logout();
    setAuthView('intro');
  }, [logout]);

  // AI Chat
  const { aiService } = useApiServices();
  const [chatEntry, setChatEntry] = useState<Entry | null>(null);

  const handleDiscuss = useCallback((entry: Entry) => {
    setChatEntry(entry);
  }, []);

  const handleAiChat = useCallback(async (entryContent: string, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    return aiService.chat(entryContent, messages);
  }, [aiService]);

  // Render view content
  const renderViewContent = () => {
    switch (currentView) {
      case 'profile':
        return (
          <ProfilePage
            config={config}
            onUpdateConfig={(newConfig: Config) => updateConfig(newConfig)}
            onDownloadData={downloadUserData}
            onBack={() => setCurrentView('journal')}
            t={t}
            stats={profileStats ?? undefined}
          />
        );
      case 'diaries':
        return (
          <DiaryManager
            diaries={diaries}
            onCreateDiary={handleCreateDiary}
            onUpdateDiary={handleUpdateDiary}
            onDeleteDiary={(id: number) => handleDeleteDiary(id, fetchEntries)}
            onSetDefault={handleSetDefaultDiary}
            onReorderDiaries={handleReorderDiaries}
            onBack={() => setCurrentView('journal')}
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
              onDiaryChange={(id: number | null) => { setCurrentDiaryId(id); }}
              onManageDiaries={() => setCurrentView('diaries')}
              theme={config.theme}
              t={t}
            />
            <Stats theme={config.theme} t={t} diaryId={currentDiaryId} />
          </>
        );
      case 'importExport':
        return (
          <>
            <DiaryTabs
              diaries={diaries}
              currentDiaryId={currentDiaryId}
              onDiaryChange={(id: number | null) => { setCurrentDiaryId(id); }}
              onManageDiaries={() => setCurrentView('diaries')}
              theme={config.theme}
              t={t}
            />
            <ImportExport
              theme={config.theme}
              t={t}
              diaryId={currentDiaryId}
              diaryName={diaries.find(d => d.id === currentDiaryId)?.name || t('allDiaries')}
            />
          </>
        );
      default: // 'journal' view
        return (
          <JournalView
            diaries={diaries}
            currentDiaryId={currentDiaryId}
            onDiaryChange={setCurrentDiaryId}
            onManageDiaries={() => setCurrentView('diaries')}
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
            entryDates={entryDates}
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
            sourceEntry={sourceEntry}
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
    if (authView === 'intro') {
      return (
        <IntroPage
          theme={config.theme || 'dark'}
          t={t}
          onSignIn={() => setAuthView('login')}
          onSignUp={() => setAuthView('register')}
        />
      );
    }

    return (
      <AuthPage
        t={t}
        theme={config.theme || 'dark'}
        initialMode={authView === 'register' ? 'register' : 'login'}
        onAuthSuccess={handleAuthSuccess}
        onBack={() => setAuthView('intro')}
      />
    );
  }

  return (
    <div className={`min-h-screen p-4 md:p-6 lg:p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
      <div className="max-w-7xl mx-auto">
        <NavMenu
          currentView={currentView}
          onViewChange={(view: string) => setCurrentView(view as ViewType)}
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

export default App;
