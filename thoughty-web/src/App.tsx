import React, { useState, useCallback } from 'react';
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

// Context and Hooks
import { useAuth } from './contexts/AuthContext';
import { 
  useConfig, 
  useDiaries, 
  useEntries, 
  useEntryForm, 
  useEntryEdit, 
  useDeleteModal 
} from './hooks/useAppState';

// Types
import type { ViewType, SourceEntryInfo, Config, Entry } from './types';

function App(): React.ReactElement {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  
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
    handleSetDefaultDiary
  } = useDiaries(isAuthenticated);

  // Entries management
  const {
    entries,
    setEntries,
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
    entriesService
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
    formError,
    handleSubmit
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
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleToggleVisibility
  } = useEntryEdit(fetchEntries);

  // Delete modal
  const {
    deleteModalOpen,
    handleDelete,
    confirmDelete,
    cancelDelete
  } = useDeleteModal(fetchEntries);

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
    sourceEntryInfo: SourceEntryInfo | null = null
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
      setTargetEntryId(data.entryId || null);
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

  // Render view content
  const renderViewContent = (): React.ReactElement => {
    switch (currentView) {
      case 'profile':
        return (
          <ProfilePage
            config={config}
            onUpdateConfig={(newConfig: Config) => updateConfig(newConfig)}
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
            allTags={allTags}
            formError={formError}
            onSubmit={handleSubmit}
            search={search}
            setSearch={setSearch}
            filterTags={filterTags}
            setFilterTags={setFilterTags}
            filterDateObj={filterDateObj}
            setFilterDateObj={setFilterDateObj}
            filterVisibility={filterVisibility}
            setFilterVisibility={setFilterVisibility}
            entryDates={entryDates}
            setPage={setPage}
            loading={loading}
            entries={entries}
            groupedEntries={groupedEntries}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleVisibility={(entry: Entry) => handleToggleVisibility(entry, setEntries)}
            editingEntry={editingEntry}
            editText={editText}
            setEditText={setEditText}
            editTags={editTags}
            setEditTags={setEditTags}
            editDate={editDate}
            setEditDate={setEditDate}
            editVisibility={editVisibility}
            setEditVisibility={setEditVisibility}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onNavigateToEntry={handleNavigateToEntry}
            sourceEntry={sourceEntry}
            activeTargetId={activeTargetId}
            onBackToSource={handleBackToSource}
            page={page}
            totalPages={totalPages}
            inputPage={inputPage}
            setInputPage={setInputPage}
            availableYears={availableYears}
            availableMonths={availableMonths}
            onNavigateToFirst={handleNavigateToFirst}
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
    return (
      <AuthPage
        t={t}
        theme={config.theme || 'dark'}
        onAuthSuccess={handleAuthSuccess}
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
          onLogout={logout}
        />

        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title={t('deleteEntryTitle')}
          message={t('deleteEntryMessage')}
          theme={config.theme}
        />

        {renderViewContent()}

        <Footer t={t} theme={config.theme ?? 'dark'} />
      </div>
    </div>
  );
}

export default App;
