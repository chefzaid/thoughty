import type { ComponentProps } from 'react';

import AuthPage from '../components/AuthPage/AuthPage';
import IntroPage from '../components/IntroPage/IntroPage';
import type { Config, Entry, ImportExportFormat, ImportExportSection, PublicViewType, ViewType } from '../types';
import AuthenticatedAppLayout from '../routes/AuthenticatedAppLayout';
import AuthenticatedRoutes from '../routes/AuthenticatedRoutes';
import type { RephraseMode } from '../services/api/aiService';
import { buildEntryPermalink } from './appRouting';
import type { TagMetadataMap } from './tagMetadata';

export type IntroPageProps = ComponentProps<typeof IntroPage>;
export type AuthPageProps = ComponentProps<typeof AuthPage>;
export type AuthenticatedLayoutProps = Omit<ComponentProps<typeof AuthenticatedAppLayout>, 'children'>;
export type AuthenticatedRoutesProps = ComponentProps<typeof AuthenticatedRoutes>;

type TranslationFn = (key: string, params?: Record<string, string | number>) => string;
type AppShellRoutingState = ReturnType<typeof import('../hooks/useAppShellRouting').useAppShellRouting>;
type EntryNavigationState = ReturnType<typeof import('../hooks/useEntryNavigation').useEntryNavigation>;
type BulkSelectState = ReturnType<typeof import('../hooks/useAppState').useBulkSelect>;
type DeleteModalState = ReturnType<typeof import('../hooks/useAppState').useDeleteModal>;
type DiariesState = ReturnType<typeof import('../hooks/useAppState').useDiaries>;
type EntriesState = ReturnType<typeof import('../hooks/useAppState').useEntries>;
type EntryEditState = ReturnType<typeof import('../hooks/useAppState').useEntryEdit>;
type EntryFormState = ReturnType<typeof import('../hooks/useAppState').useEntryForm>;

interface BuildPublicShellPropsParams {
  configTheme?: 'light' | 'dark';
  publicView: PublicViewType | null;
  routingState: Pick<AppShellRoutingState, 'handleAuthSuccess' | 'handlePublicViewChange'>;
  t: TranslationFn;
}

interface BuildAuthenticatedLayoutPropsParams {
  avatarUrl?: string;
  bulkSelectState: Pick<BulkSelectState, 'bulkModalOpen' | 'cancelBulkModal' | 'confirmBulkDelete' | 'selectedIds'>;
  chatEntry: Entry | null;
  config: Config;
  currentView: ViewType | null;
  deleteModalState: Pick<DeleteModalState, 'cancelDelete' | 'confirmDelete' | 'deleteModalOpen'>;
  entryToastVisible: boolean;
  handleAiChat: (entryId: number, entryContent: string, messages: { role: 'user' | 'assistant'; content: string }[]) => Promise<string | null>;
  handleLoadAiChatHistory: (entryId: number) => Promise<Array<{ role: 'user' | 'assistant'; content: string }>>;
  routingState: Pick<AppShellRoutingState, 'handleLogout' | 'handleViewChange'>;
  setChatEntry: (entry: Entry | null) => void;
  t: TranslationFn;
  userName: string;
}

interface BuildAuthenticatedRoutesPropsParams {
  bulkSelectState: Pick<BulkSelectState, 'bulkMode' | 'clearSelection' | 'requestBulkAction' | 'selectedIds' | 'selectAll' | 'toggleBulkMode' | 'toggleSelect'>;
  config: Config;
  deleteModalState: Pick<DeleteModalState, 'handleDelete'>;
  diariesState: Pick<DiariesState, 'currentDiaryId' | 'diaries' | 'handleCreateDiary' | 'handleDeleteDiary' | 'handleReorderDiaries' | 'handleSetDefaultDiary' | 'handleUpdateDiary'>;
  downloadUserData: AuthenticatedRoutesProps['profileRouteProps']['onDownloadData'];
  entriesState: Pick<EntriesState, 'activeTargetId' | 'allTags' | 'availableMonths' | 'availableYears' | 'deleteRevision' | 'entries' | 'fetchEntries' | 'fetchEntryHistory' | 'filterArchiveStatus' | 'filterDateObj' | 'filterFavorites' | 'filterTags' | 'filterVisibility' | 'groupedEntries' | 'inputPage' | 'loading' | 'page' | 'reorderEntries' | 'search' | 'setFilterArchiveStatus' | 'setFilterDateObj' | 'setFilterFavorites' | 'setFilterTags' | 'setFilterVisibility' | 'setInputPage' | 'setPage' | 'setSearch' | 'sourceEntry' | 'targetEntryId' | 'toggleArchived' | 'toggleFavorite' | 'toggleVisibility' | 'totalPages'>;
  entryEditState: Pick<EntryEditState, 'addEditPendingFile' | 'editDate' | 'editExistingAttachments' | 'editFormat' | 'editPendingFiles' | 'editTags' | 'editText' | 'editVisibility' | 'editingEntry' | 'handleCancelEdit' | 'handleEdit' | 'handleSaveEdit' | 'removeEditAttachment' | 'removeEditPendingFile' | 'setEditDate' | 'setEditFormat' | 'setEditTags' | 'setEditText' | 'setEditVisibility'>;
  entryFormState: Pick<EntryFormState, 'addPendingFile' | 'fixingWriting' | 'formError' | 'format' | 'handleFixWriting' | 'handleSubmit' | 'handleSuggestTags' | 'newEntryText' | 'pendingFiles' | 'removePendingFile' | 'removeUploadedAttachment' | 'selectedDate' | 'setFormat' | 'setNewEntryText' | 'setSelectedDate' | 'setTags' | 'setVisibility' | 'suggestingTags' | 'tags' | 'uploadedAttachments' | 'visibility'>;
  entryNavigationState: Pick<EntryNavigationState, 'handleBackToSource' | 'handleNavigateToEntry' | 'handleShareEntry'>;
  handleDiscuss: (entry: Entry) => void;
  handleRephrase?: (entry: Entry, mode: RephraseMode) => Promise<void>;
  handleNavigateToFirst: AuthenticatedRoutesProps['journalRouteProps']['onNavigateToFirst'];
  handleRenameTag: AuthenticatedRoutesProps['tagManagerRouteProps']['onRenameTag'];
  highlightsModalOpen: boolean;
  importExportFormat: ImportExportFormat;
  importExportIncludeVisibility: boolean;
  importExportSection: ImportExportSection;
  profileStats: AuthenticatedRoutesProps['profileRouteProps']['stats'] | null;
  routingState: Pick<AppShellRoutingState, 'handleBackFromDiaries' | 'handleDiaryChange' | 'handleImportExportRouteStateChange' | 'handleManageDiaries' | 'handleViewChange'>;
  setHighlightsModalOpen: (value: boolean) => void;
  t: TranslationFn;
  tagMetadata: TagMetadataMap;
  updateConfig: (newConfig: Config) => Promise<void>;
}

export function buildPublicShellProps({
  configTheme,
  publicView,
  routingState,
  t,
}: Readonly<BuildPublicShellPropsParams>) {
  const theme = configTheme || 'dark';

  const introPageProps: IntroPageProps = {
    theme,
    t,
    onSignIn: () => routingState.handlePublicViewChange('login'),
    onSignUp: () => routingState.handlePublicViewChange('register'),
  };

  const authPageProps: AuthPageProps = {
    t,
    theme,
    mode: publicView === 'register' ? 'register' : 'login',
    onAuthSuccess: routingState.handleAuthSuccess,
    onModeChange: routingState.handlePublicViewChange,
    onBack: () => routingState.handlePublicViewChange('intro'),
  };

  return {
    introPageProps,
    authPageProps,
  };
}

export function buildAuthenticatedLayoutProps({
  avatarUrl,
  bulkSelectState,
  chatEntry,
  config,
  currentView,
  deleteModalState,
  entryToastVisible,
  handleAiChat,
  handleLoadAiChatHistory,
  routingState,
  setChatEntry,
  t,
  userName,
}: Readonly<BuildAuthenticatedLayoutPropsParams>): AuthenticatedLayoutProps {
  return {
    config,
    currentView: currentView ?? 'journal',
    userName,
    avatarUrl,
    onViewChange: routingState.handleViewChange,
    onLogout: routingState.handleLogout,
    t,
    deleteModalOpen: deleteModalState.deleteModalOpen,
    onCloseDeleteModal: deleteModalState.cancelDelete,
    onConfirmDelete: deleteModalState.confirmDelete,
    bulkModalOpen: bulkSelectState.bulkModalOpen,
    onCloseBulkModal: bulkSelectState.cancelBulkModal,
    onConfirmBulkDelete: bulkSelectState.confirmBulkDelete,
    selectedCount: bulkSelectState.selectedIds.size,
    entryToastVisible,
    chatEntry,
    onCloseChat: () => setChatEntry(null),
    onLoadChatHistory: handleLoadAiChatHistory,
    onSendChat: handleAiChat,
  };
}

export function buildAuthenticatedRoutesProps({
  bulkSelectState,
  config,
  deleteModalState,
  diariesState,
  downloadUserData,
  entriesState,
  entryEditState,
  entryFormState,
  entryNavigationState,
  handleDiscuss,
  handleRephrase,
  handleNavigateToFirst,
  handleRenameTag,
  highlightsModalOpen,
  importExportFormat,
  importExportIncludeVisibility,
  importExportSection,
  profileStats,
  routingState,
  setHighlightsModalOpen,
  t,
  tagMetadata,
  updateConfig,
}: Readonly<BuildAuthenticatedRoutesPropsParams>): AuthenticatedRoutesProps {
  return {
    profileRouteProps: {
      config,
      onUpdateConfig: (newConfig: Config) => updateConfig(newConfig),
      onDownloadData: downloadUserData,
      onBack: () => routingState.handleViewChange('journal'),
      t,
      stats: profileStats ?? undefined,
    },
    tagManagerRouteProps: {
      config,
      allTags: entriesState.allTags,
      onUpdateConfig: (newConfig: Config) => updateConfig(newConfig),
      onRenameTag: handleRenameTag,
      t,
    },
    diariesRouteProps: {
      diaries: diariesState.diaries,
      onCreateDiary: diariesState.handleCreateDiary,
      onUpdateDiary: async (id, data) => {
        await diariesState.handleUpdateDiary(id, data);
        await entriesState.fetchEntries();
      },
      onDeleteDiary: (id) => diariesState.handleDeleteDiary(id, () => entriesState.fetchEntries()),
      onSetDefault: diariesState.handleSetDefaultDiary,
      onReorderDiaries: diariesState.handleReorderDiaries,
      onBack: routingState.handleBackFromDiaries,
      theme: config.theme,
      t,
    },
    statsRouteProps: {
      diaries: diariesState.diaries,
      currentDiaryId: diariesState.currentDiaryId,
      onDiaryChange: routingState.handleDiaryChange,
      onManageDiaries: () => routingState.handleManageDiaries('stats'),
      onOpenJournalDay: (date: string) => {
        entriesState.setFilterDateObj(new Date(`${date}T00:00:00.000Z`));
        entriesState.setPage(1);
        routingState.handleViewChange('journal');
      },
      theme: config.theme,
      t,
      tagMetadata,
    },
    importExportRouteProps: {
      diaries: diariesState.diaries,
      currentDiaryId: diariesState.currentDiaryId,
      onDiaryChange: routingState.handleDiaryChange,
      onManageDiaries: () => routingState.handleManageDiaries('importExport'),
      theme: config.theme,
      t,
      initialSection: importExportSection,
      initialExportFormat: importExportFormat,
      initialIncludeVisibility: importExportIncludeVisibility,
      onRouteStateChange: routingState.handleImportExportRouteStateChange,
    },
    journalRouteProps: {
      diaries: diariesState.diaries,
      currentDiaryId: diariesState.currentDiaryId,
      onDiaryChange: routingState.handleDiaryChange,
      onManageDiaries: () => routingState.handleManageDiaries('journal'),
      highlightsModalOpen,
      setHighlightsModalOpen,
      newEntryText: entryFormState.newEntryText,
      setNewEntryText: entryFormState.setNewEntryText,
      selectedDate: entryFormState.selectedDate,
      setSelectedDate: entryFormState.setSelectedDate,
      tags: entryFormState.tags,
      setTags: entryFormState.setTags,
      visibility: entryFormState.visibility,
      setVisibility: entryFormState.setVisibility,
      format: entryFormState.format,
      setFormat: entryFormState.setFormat,
      allTags: entriesState.allTags,
      tagMetadata,
      formError: entryFormState.formError,
      suggestingTags: entryFormState.suggestingTags,
      onSuggestTags: entryFormState.handleSuggestTags,
      fixingWriting: entryFormState.fixingWriting,
      onFixWriting: entryFormState.handleFixWriting,
      onSubmit: entryFormState.handleSubmit,
      pendingFiles: entryFormState.pendingFiles,
      uploadedAttachments: entryFormState.uploadedAttachments,
      onAddFile: entryFormState.addPendingFile,
      onRemovePendingFile: entryFormState.removePendingFile,
      onRemoveUploadedAttachment: entryFormState.removeUploadedAttachment,
      search: entriesState.search,
      setSearch: entriesState.setSearch,
      filterTags: entriesState.filterTags,
      setFilterTags: entriesState.setFilterTags,
      filterDateObj: entriesState.filterDateObj,
      setFilterDateObj: entriesState.setFilterDateObj,
      filterVisibility: entriesState.filterVisibility,
      setFilterVisibility: entriesState.setFilterVisibility,
      filterFavorites: entriesState.filterFavorites,
      setFilterFavorites: entriesState.setFilterFavorites,
      filterArchiveStatus: entriesState.filterArchiveStatus,
      setFilterArchiveStatus: entriesState.setFilterArchiveStatus,
      setPage: entriesState.setPage,
      loading: entriesState.loading,
      entries: entriesState.entries,
      groupedEntries: entriesState.groupedEntries,
      onEdit: entryEditState.handleEdit,
      onDelete: deleteModalState.handleDelete,
      onToggleVisibility: entriesState.toggleVisibility,
      onToggleFavorite: entriesState.toggleFavorite,
      onToggleArchived: entriesState.toggleArchived,
      editingEntry: entryEditState.editingEntry,
      editText: entryEditState.editText,
      setEditText: entryEditState.setEditText,
      editTags: entryEditState.editTags,
      setEditTags: entryEditState.setEditTags,
      editDate: entryEditState.editDate,
      setEditDate: entryEditState.setEditDate,
      editVisibility: entryEditState.editVisibility,
      setEditVisibility: entryEditState.setEditVisibility,
      editFormat: entryEditState.editFormat,
      setEditFormat: entryEditState.setEditFormat,
      onSaveEdit: entryEditState.handleSaveEdit,
      onCancelEdit: entryEditState.handleCancelEdit,
      editPendingFiles: entryEditState.editPendingFiles,
      editExistingAttachments: entryEditState.editExistingAttachments,
      onAddEditFile: entryEditState.addEditPendingFile,
      onRemoveEditPendingFile: entryEditState.removeEditPendingFile,
      onRemoveEditAttachment: entryEditState.removeEditAttachment,
      onNavigateToEntry: entryNavigationState.handleNavigateToEntry,
      onShareEntry: entryNavigationState.handleShareEntry,
      getEntryPermalink: buildEntryPermalink,
      sourceEntry: entriesState.sourceEntry,
      targetEntryId: entriesState.targetEntryId,
      activeTargetId: entriesState.activeTargetId,
      onBackToSource: entryNavigationState.handleBackToSource,
      bulkMode: bulkSelectState.bulkMode,
      selectedIds: bulkSelectState.selectedIds,
      onToggleSelect: bulkSelectState.toggleSelect,
      onSelectAll: bulkSelectState.selectAll,
      onClearSelection: bulkSelectState.clearSelection,
      onBulkAction: bulkSelectState.requestBulkAction,
      onToggleBulkMode: bulkSelectState.toggleBulkMode,
      page: entriesState.page,
      totalPages: entriesState.totalPages,
      inputPage: entriesState.inputPage,
      setInputPage: entriesState.setInputPage,
      availableYears: entriesState.availableYears,
      availableMonths: entriesState.availableMonths,
      onNavigateToFirst: handleNavigateToFirst,
      onFetchHistory: entriesState.fetchEntryHistory,
      onDeleteRevision: entriesState.deleteRevision,
      onReorderEntries: entriesState.reorderEntries,
      onDiscuss: handleDiscuss,
      onRephrase: handleRephrase,
      config,
      t,
    },
  };
}