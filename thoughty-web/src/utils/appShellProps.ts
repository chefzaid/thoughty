import type { ComponentProps } from 'react';

import type { AppNotice } from '../hooks/useAppNotice';
import type { TransientMessage } from '../hooks/useTransientMessage';

import type { Config, Entry, ImportExportFormat, ImportExportSection, TranslationFunction, ViewType } from '../types';
import type AuthenticatedAppLayout from '../routes/AuthenticatedAppLayout';
import type AuthenticatedRoutes from '../routes/AuthenticatedRoutes';
import type { DuplicateEntryScan, RephraseMode, SummaryGuidance } from '../services/api/aiService';
import { buildEntryPermalink } from './appRouting';
import { createEntryTemplate, getEntryTemplates, serializeCustomEntryTemplates, type EntryTemplateDraft } from './entryTemplates';
import { listKnownTags, type TagMetadataMap } from './tagMetadata';

export {
  buildPublicShellProps,
  type AboutPageProps,
  type AuthPageProps,
  type BlogPageProps,
  type ContactPageProps,
  type FeedbackPageProps,
  type IntroPageProps,
  type LegalPageProps,
  type UnsubscribePageProps,
  type VerifyEmailPageProps,
} from './publicShellProps';

export type AuthenticatedLayoutProps = Omit<ComponentProps<typeof AuthenticatedAppLayout>, 'children'>;
export type AuthenticatedRoutesProps = ComponentProps<typeof AuthenticatedRoutes>;

type AppShellRoutingState = ReturnType<typeof import('../hooks/useAppShellRouting').useAppShellRouting>;
type EntryNavigationState = ReturnType<typeof import('../hooks/useEntryNavigation').useEntryNavigation>;
type BulkSelectState = ReturnType<typeof import('../hooks/useAppState').useBulkSelect>;
type DeleteModalState = ReturnType<typeof import('../hooks/useAppState').useDeleteModal>;
type DiariesState = ReturnType<typeof import('../hooks/useAppState').useDiaries>;
type EntriesState = ReturnType<typeof import('../hooks/useAppState').useEntries>;
type EntryEditState = ReturnType<typeof import('../hooks/useAppState').useEntryEdit>;
type EntryFormState = ReturnType<typeof import('../hooks/useAppState').useEntryForm>;

interface BuildAuthenticatedLayoutPropsParams {
  appNotice: Pick<AppNotice, 'text' | 'toast'>;
  avatarUrl?: string;
  bulkSelectState: Pick<BulkSelectState, 'bulkModalOpen' | 'cancelBulkModal' | 'confirmBulkDelete' | 'selectedIds'>;
  chatEntry: Entry | null;
  config: Config;
  currentView: ViewType | null;
  deleteModalState: Pick<DeleteModalState, 'cancelDelete' | 'confirmDelete' | 'deleteModalOpen'>;
  entryToast: TransientMessage;
  handleAiChat: (entryId: number, entryContent: string, messages: { role: 'user' | 'assistant'; content: string }[]) => Promise<string | null>;
  handleLoadAiChatHistory: (entryId: number) => Promise<Array<{ role: 'user' | 'assistant'; content: string }>>;
  isEmailVerified: boolean;
  routingState: Pick<AppShellRoutingState, 'handleLogout' | 'handleViewChange'>;
  setChatEntry: (entry: Entry | null) => void;
  t: TranslationFunction;
  userName: string;
}

interface BuildAuthenticatedRoutesPropsParams {
  bulkSelectState: Pick<BulkSelectState, 'bulkMode' | 'clearSelection' | 'requestBulkAction' | 'selectedIds' | 'selectAll' | 'toggleBulkMode' | 'toggleSelect'>;
  config: Config;
  deleteModalState: Pick<DeleteModalState, 'handleDelete'>;
  diariesState: Pick<DiariesState, 'currentDiaryId' | 'diaries' | 'fetchDiaries' | 'handleCreateDiary' | 'handleDeleteDiary' | 'handleReorderDiaries' | 'handleSetDefaultDiary' | 'handleUpdateDiary'>;
  downloadUserData: AuthenticatedRoutesProps['profileRouteProps']['onDownloadData'];
  entriesState: Pick<EntriesState, 'activeTargetId' | 'allTags' | 'availableMonths' | 'availableYears' | 'deleteRevision' | 'entries' | 'fetchEntries' | 'fetchEntryBacklinks' | 'fetchEntryHistory' | 'filterArchiveStatus' | 'filterDateObj' | 'filterEraId' | 'filterFavorites' | 'filterMood' | 'filterPersonId' | 'filterTags' | 'filterVisibility' | 'groupedEntries' | 'inputPage' | 'loading' | 'page' | 'rankedResults' | 'reorderEntries' | 'runSemanticSearch' | 'search' | 'searchMode' | 'searchSort' | 'semanticSearchResult' | 'semanticSearchStatus' | 'setEntryTask' | 'setFilterArchiveStatus' | 'setFilterDateObj' | 'setFilterEraId' | 'setFilterFavorites' | 'setFilterMood' | 'setFilterPersonId' | 'setFilterTags' | 'setFilterVisibility' | 'setInputPage' | 'setPage' | 'setSearch' | 'setSearchMode' | 'setSearchSort' | 'sourceEntry' | 'targetEntryId' | 'toggleArchived' | 'toggleFavorite' | 'togglePinned' | 'toggleVisibility' | 'totalPages' | 'unsealEntry'>;
  entryEditState: Pick<EntryEditState, 'addEditPendingFile' | 'editDate' | 'editExistingAttachments' | 'editFeelings' | 'editFormat' | 'editMood' | 'editPendingFiles' | 'editTags' | 'editText' | 'editTimeOfDay' | 'editTitle' | 'editVisibility' | 'editingEntry' | 'handleCancelEdit' | 'handleEdit' | 'handleSaveEdit' | 'removeEditAttachment' | 'removeEditPendingFile' | 'setEditDate' | 'setEditFeelings' | 'setEditFormat' | 'setEditMood' | 'setEditTags' | 'setEditText' | 'setEditTimeOfDay' | 'setEditTitle' | 'setEditVisibility'>;
  entryFormState: Pick<EntryFormState, 'addPendingFile' | 'feelings' | 'fixingWriting' | 'formError' | 'format' | 'handleFixWriting' | 'handleSubmit' | 'handleSuggestTags' | 'mood' | 'newEntryText' | 'pendingFiles' | 'removePendingFile' | 'removeUploadedAttachment' | 'selectedDate' | 'setFeelings' | 'setFormat' | 'setMood' | 'setNewEntryText' | 'setSelectedDate' | 'setTags' | 'setTimeCapsule' | 'setTimeOfDay' | 'setTitle' | 'setVisibility' | 'suggestingTags' | 'tags' | 'timeCapsule' | 'timeOfDay' | 'title' | 'uploadedAttachments' | 'visibility'>;
  entryNavigationState: Pick<EntryNavigationState, 'handleBackToSource' | 'handleNavigateToEntry' | 'handleShareEntry'>;
  handleDiscuss: (entry: Entry) => void;
  handleRephrase?: (entry: Entry, mode: RephraseMode) => Promise<void>;
  handleSummarize?: (entryId: number, guidance: SummaryGuidance) => Promise<string | null>;
  handleGetInspiration?: () => Promise<string | null>;
  handleFindDuplicateEntries: (diaryId?: number) => Promise<DuplicateEntryScan | null>;
  handleNavigateToFirst: AuthenticatedRoutesProps['journalRouteProps']['yearMonthNavigator']['onNavigate'];
  handleRenameTag: AuthenticatedRoutesProps['tagManagerRouteProps']['onRenameTag'];
  handleDeleteTag: AuthenticatedRoutesProps['tagManagerRouteProps']['onDeleteTag'];
  handleLoadTagUsage: AuthenticatedRoutesProps['tagManagerRouteProps']['onLoadTagUsage'];
  highlightsModalOpen: boolean;
  importExportFormat: ImportExportFormat;
  importExportIncludeVisibility: boolean;
  importExportSection: ImportExportSection;
  /** Shows a message in the app's notice toast. */
  notify: (message: string) => void;
  profileStats: AuthenticatedRoutesProps['profileRouteProps']['stats'] | null;
  routingState: Pick<AppShellRoutingState, 'handleBackFromDiaries' | 'handleDiaryChange' | 'handleImportExportRouteStateChange' | 'handleManageDiaries' | 'handleViewChange'>;
  setHighlightsModalOpen: (value: boolean) => void;
  t: TranslationFunction;
  tagMetadata: TagMetadataMap;
  /** Saves settings without a message when the save fails (resolves false, the old settings back). */
  updateConfig: (newConfig: Config) => Promise<boolean>;
  /** Saves settings and says in the app's notice toast when the save fails (resolves false). */
  saveConfig: (newConfig: Config) => Promise<boolean>;
}

export function buildAuthenticatedLayoutProps({
  appNotice,
  avatarUrl,
  bulkSelectState,
  chatEntry,
  config,
  currentView,
  deleteModalState,
  entryToast,
  handleAiChat,
  handleLoadAiChatHistory,
  isEmailVerified,
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
    isEmailVerified,
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
    entryToast,
    notice: appNotice.toast,
    noticeText: appNotice.text,
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
  handleSummarize,
  handleGetInspiration,
  handleFindDuplicateEntries,
  handleNavigateToFirst,
  handleRenameTag,
  handleDeleteTag,
  handleLoadTagUsage,
  highlightsModalOpen,
  importExportFormat,
  importExportIncludeVisibility,
  importExportSection,
  notify,
  profileStats,
  routingState,
  saveConfig,
  setHighlightsModalOpen,
  t,
  tagMetadata,
  updateConfig,
}: Readonly<BuildAuthenticatedRoutesPropsParams>): AuthenticatedRoutesProps {
  const knownTags = listKnownTags(entriesState.allTags, tagMetadata);

  return {
    feedRouteProps: {
      theme: config.theme,
      language: config.language,
      readDates: config.readDates !== false,
      ttsVoiceUri: config.ttsVoiceUri,
      t,
    },
    memoirRouteProps: {
      theme: config.theme,
      language: config.language,
      diaries: diariesState.diaries,
      onDiariesChanged: diariesState.fetchDiaries,
      t,
    },
    reviewRouteProps: {
      theme: config.theme,
      language: config.language,
      diaries: diariesState.diaries,
      t,
    },
    peopleRouteProps: {
      theme: config.theme,
      language: config.language,
      t,
    },
    recycleBinRouteProps: {
      theme: config.theme,
      language: config.language,
      diaries: diariesState.diaries,
      t,
    },
    profileRouteProps: {
      config,
      onUpdateConfig: saveConfig,
      onDownloadData: downloadUserData,
      onBack: () => routingState.handleViewChange('journal'),
      t,
      stats: profileStats ?? undefined,
      diaries: diariesState.diaries,
    },
    tagManagerRouteProps: {
      config,
      allTags: entriesState.allTags,
      onUpdateConfig: saveConfig,
      onRenameTag: handleRenameTag,
      onDeleteTag: handleDeleteTag,
      onLoadTagUsage: handleLoadTagUsage,
      onRetagApplied: async () => {
        await entriesState.fetchEntries();
      },
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
      language: config.language,
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
      language: config.language,
      t,
      tagMetadata,
    },
    importExportRouteProps: {
      diaries: diariesState.diaries,
      currentDiaryId: diariesState.currentDiaryId,
      onDiaryChange: routingState.handleDiaryChange,
      onManageDiaries: () => routingState.handleManageDiaries('importExport'),
      onDiariesChanged: diariesState.fetchDiaries,
      theme: config.theme,
      language: config.language,
      t,
      initialSection: importExportSection,
      initialExportFormat: importExportFormat,
      initialIncludeVisibility: importExportIncludeVisibility,
      onRouteStateChange: routingState.handleImportExportRouteStateChange,
    },
    journalRouteProps: {
      diaryTabs: {
        diaries: diariesState.diaries,
        currentDiaryId: diariesState.currentDiaryId,
        onDiaryChange: routingState.handleDiaryChange,
        onManageDiaries: () => routingState.handleManageDiaries('journal'),
      },
      thoughtOfDay: {
        isOpen: highlightsModalOpen,
        setOpen: setHighlightsModalOpen,
        diaryId: diariesState.currentDiaryId,
        onNavigateToEntry: entryNavigationState.handleNavigateToEntry,
      },
      duplicateReview: {
        diaryId: diariesState.currentDiaryId,
        onFindDuplicates: handleFindDuplicateEntries,
        onDelete: deleteModalState.handleDelete,
        onNavigateToEntry: entryNavigationState.handleNavigateToEntry,
      },
      entryForm: {
        entryTemplates: getEntryTemplates(config.entryTemplates),
        // The name dialog says itself when the template could not be saved
        onSaveTemplate: (draft: EntryTemplateDraft) => {
          const currentTemplates = getEntryTemplates(config.entryTemplates);
          const nextTemplates = [...currentTemplates, createEntryTemplate(draft)];
          return updateConfig({
            ...config,
            entryTemplates: serializeCustomEntryTemplates(nextTemplates),
          });
        },
        onDeleteTemplate: (templateId: string) => {
          const nextTemplates = getEntryTemplates(config.entryTemplates)
            .filter((template) => template.id !== templateId);
          return saveConfig({
            ...config,
            entryTemplates: serializeCustomEntryTemplates(nextTemplates),
          });
        },
        newEntryText: entryFormState.newEntryText,
        setNewEntryText: entryFormState.setNewEntryText,
        title: entryFormState.title,
        setTitle: entryFormState.setTitle,
        timeOfDay: entryFormState.timeOfDay,
        setTimeOfDay: entryFormState.setTimeOfDay,
        mood: entryFormState.mood,
        setMood: entryFormState.setMood,
        feelings: entryFormState.feelings,
        setFeelings: entryFormState.setFeelings,
        timeCapsule: entryFormState.timeCapsule,
        setTimeCapsule: entryFormState.setTimeCapsule,
        selectedDate: entryFormState.selectedDate,
        setSelectedDate: entryFormState.setSelectedDate,
        tags: entryFormState.tags,
        setTags: entryFormState.setTags,
        visibility: entryFormState.visibility,
        setVisibility: entryFormState.setVisibility,
        format: entryFormState.format,
        setFormat: entryFormState.setFormat,
        allTags: knownTags,
        tagMetadata,
        formError: entryFormState.formError,
        suggestingTags: entryFormState.suggestingTags,
        onSuggestTags: entryFormState.handleSuggestTags,
        fixingWriting: entryFormState.fixingWriting,
        onFixWriting: entryFormState.handleFixWriting,
        onGetInspiration: handleGetInspiration,
        onSubmit: entryFormState.handleSubmit,
        pendingFiles: entryFormState.pendingFiles,
        uploadedAttachments: entryFormState.uploadedAttachments,
        onAddFile: entryFormState.addPendingFile,
        onRemovePendingFile: entryFormState.removePendingFile,
        onRemoveUploadedAttachment: entryFormState.removeUploadedAttachment,
      },
      filters: {
        search: entriesState.search,
        setSearch: entriesState.setSearch,
        searchMode: entriesState.searchMode,
        setSearchMode: entriesState.setSearchMode,
        searchSort: entriesState.searchSort,
        setSearchSort: entriesState.setSearchSort,
        semanticSearchStatus: entriesState.semanticSearchStatus,
        semanticSearchResult: entriesState.semanticSearchResult,
        onSemanticSearch: entriesState.runSemanticSearch,
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
        filterMood: entriesState.filterMood,
        setFilterMood: entriesState.setFilterMood,
        filterEraId: entriesState.filterEraId,
        setFilterEraId: entriesState.setFilterEraId,
        filterPersonId: entriesState.filterPersonId,
        setFilterPersonId: entriesState.setFilterPersonId,
        allTags: entriesState.allTags,
        tagMetadata,
        setPage: entriesState.setPage,
      },
      entriesList: {
        loading: entriesState.loading,
        entries: entriesState.entries,
        groupedEntries: entriesState.groupedEntries,
        rankedOrder: entriesState.rankedResults,
        onEdit: entryEditState.handleEdit,
        onDelete: deleteModalState.handleDelete,
        onToggleVisibility: entriesState.toggleVisibility,
        onToggleFavorite: entriesState.toggleFavorite,
        onToggleArchived: entriesState.toggleArchived,
        onTogglePinned: entriesState.togglePinned,
        onToggleTask: entriesState.setEntryTask,
        onUnseal: entriesState.unsealEntry,
        editingEntry: entryEditState.editingEntry,
        editText: entryEditState.editText,
        setEditText: entryEditState.setEditText,
        editTitle: entryEditState.editTitle,
        setEditTitle: entryEditState.setEditTitle,
        editTimeOfDay: entryEditState.editTimeOfDay,
        setEditTimeOfDay: entryEditState.setEditTimeOfDay,
        editMood: entryEditState.editMood,
        setEditMood: entryEditState.setEditMood,
        editFeelings: entryEditState.editFeelings,
        setEditFeelings: entryEditState.setEditFeelings,
        editTags: entryEditState.editTags,
        setEditTags: entryEditState.setEditTags,
        editDate: entryEditState.editDate,
        setEditDate: entryEditState.setEditDate,
        editVisibility: entryEditState.editVisibility,
        setEditVisibility: entryEditState.setEditVisibility,
        editFormat: entryEditState.editFormat,
        setEditFormat: entryEditState.setEditFormat,
        allTags: knownTags,
        tagMetadata,
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
        diaries: diariesState.diaries,
        onFetchHistory: entriesState.fetchEntryHistory,
        onFetchBacklinks: entriesState.fetchEntryBacklinks,
        onDeleteRevision: entriesState.deleteRevision,
        onReorderEntries: entriesState.reorderEntries,
        onDiscuss: handleDiscuss,
        onRephrase: handleRephrase,
        onSummarize: handleSummarize,
      },
      pagination: {
        page: entriesState.page,
        totalPages: entriesState.totalPages,
        inputPage: entriesState.inputPage,
        setPage: entriesState.setPage,
        setInputPage: entriesState.setInputPage,
      },
      yearMonthNavigator: {
        availableYears: entriesState.availableYears,
        availableMonths: entriesState.availableMonths,
        onNavigate: handleNavigateToFirst,
      },
      onNotify: notify,
      config,
      t,
    },
  };
}