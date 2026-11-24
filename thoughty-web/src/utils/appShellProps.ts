import type { ComponentProps } from 'react';

import type { AppNotice } from '../hooks/useAppNotice';
import type { TransientMessage } from '../hooks/useTransientMessage';

import { type Config, type Entry, type ImportExportFormat, type ImportExportSection, type TranslationFunction, type ViewType } from '../types';
import type AuthenticatedAppLayout from '../routes/AuthenticatedAppLayout';
import type AuthenticatedRoutes from '../routes/AuthenticatedRoutes';
import type { DuplicateEntryScan, RephraseMode, SummaryGuidance } from '../services/api/aiService';
import { writeAboutState } from '../components/JournalView/composerFocusRoute';
import { buildEntriesListProps } from './entriesListProps';
import { createEntryTemplate, getEntryTemplates, parseCustomEntryTemplates, serializeCustomEntryTemplates, type EntryTemplateDraft } from './entryTemplates';
import { listKnownTags, type TagMetadataMap } from './tagMetadata';

export {
  buildPublicShellProps,
  type AboutPageProps,
  type AuthPageProps,
  type BlogPageProps,
  type CompleteSignUpPageProps,
  type ResetPasswordPageProps,
  type ContactPageProps,
  type FeedbackPageProps,
  type IntroPageProps,
  type JournalTemplatesPageProps,
  type LegalPageProps,
  type MemoirQuestionsPageProps,
  type UnsubscribePageProps,
  type VerifyEmailPageProps,
  type SessionUnreachablePageProps,
  type AddEmailPageProps,
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
  appNotice: Pick<AppNotice, 'text' | 'toast' | 'action'>;
  avatarUrl?: string;
  bulkSelectState: Pick<BulkSelectState, 'bulkModalOpen' | 'cancelBulkModal' | 'confirmBulkDelete' | 'selectedIds'>;
  chatEntry: Entry | null;
  config: Config;
  currentView: ViewType | null;
  deleteModalState: Pick<DeleteModalState, 'cancelDelete' | 'confirmDelete' | 'deleteModalOpen'>;
  entryToast: TransientMessage;
  handleAiChat: (entry: Entry, messages: { role: 'user' | 'assistant'; content: string }[]) => Promise<string | null | undefined>;
  handleLoadAiChatHistory: (entryId: number) => Promise<Array<{ role: 'user' | 'assistant'; content: string }>>;
  isEmailVerified: boolean;
  offline: boolean;
  quickCapture?: AuthenticatedLayoutProps['quickCapture'];
  routingState: Pick<AppShellRoutingState, 'handleLogout' | 'handleViewChange'>;
  setChatEntry: (entry: Entry | null) => void;
  t: TranslationFunction;
  userName: string;
}

export interface BuildAuthenticatedRoutesPropsParams {
  bulkSelectState: Pick<BulkSelectState, 'bulkMode' | 'clearSelection' | 'requestBulkAction' | 'selectedIds' | 'selectAll' | 'toggleBulkMode' | 'toggleSelect'>;
  config: Config;
  /** The settings have arrived, or failed to, or the journal is open offline. */
  configLoaded: boolean;
  /** The stored settings were really read from the API, so a setting built on its stored value can be saved. */
  configRead: boolean;
  deleteModalState: Pick<DeleteModalState, 'handleDelete'>;
  diariesState: Pick<DiariesState, 'currentDiaryId' | 'diaries' | 'fetchDiaries' | 'handleCreateDiary' | 'handleDeleteDiary' | 'handleReorderDiaries' | 'handleSetDefaultDiary' | 'handleUpdateDiary'>;
  downloadUserData: AuthenticatedRoutesProps['profileRouteProps']['onDownloadData'];
  entriesState: Pick<EntriesState, 'activeTargetId' | 'allTags' | 'availableMonths' | 'availableYears' | 'backlinksVersion' | 'deleteRevision' | 'entries' | 'fetchEntries' | 'fetchEntryBacklinks' | 'fetchEntryHistory' | 'filterArchiveStatus' | 'filterDateObj' | 'filterEraId' | 'filterFavorites' | 'filterMood' | 'filterPersonId' | 'filterTags' | 'filterVisibility' | 'feed' | 'groupedEntries' | 'listQuery' | 'loading' | 'rankedResults' | 'reorderEntries' | 'runSemanticSearch' | 'search' | 'searchMode' | 'searchSort' | 'semanticSearchResult' | 'semanticSearchStatus' | 'setEntryTask' | 'setFilterArchiveStatus' | 'setFilterDateObj' | 'setFilterEraId' | 'setFilterFavorites' | 'setFilterMood' | 'setFilterPersonId' | 'setFilterTags' | 'setFilterVisibility' | 'setSearch' | 'setSearchMode' | 'setSearchSort' | 'sourceEntry' | 'targetEntryId' | 'toggleArchived' | 'toggleFavorite' | 'togglePinned' | 'toggleVisibility' | 'unsealEntry'>;
  entryEditState: Pick<EntryEditState, 'addEditPendingFile' | 'editDate' | 'editDiaryId' | 'editExistingAttachments' | 'editFeelings' | 'editFormat' | 'editMood' | 'editPendingFiles' | 'editTags' | 'editText' | 'editTimeOfDay' | 'editTitle' | 'editVisibility' | 'editingEntry' | 'handleCancelEdit' | 'handleEdit' | 'handleSaveEdit' | 'removeEditAttachment' | 'removeEditPendingFile' | 'setEditDate' | 'setEditDiaryId' | 'setEditFeelings' | 'setEditFormat' | 'setEditMood' | 'setEditTags' | 'setEditText' | 'setEditTimeOfDay' | 'setEditTitle' | 'setEditVisibility'>;
  entryFormState: Pick<EntryFormState, 'addPendingFile' | 'diaryAiMode' | 'diaryTemplateName' | 'draft' | 'feelings' | 'fixingWriting' | 'formError' | 'format' | 'handleFixWriting' | 'handleSubmit' | 'handleSuggestTags' | 'mood' | 'newEntryText' | 'pendingFiles' | 'removePendingFile' | 'removeUploadedAttachment' | 'savedEntry' | 'selectedDate' | 'setFeelings' | 'setFormat' | 'setMood' | 'setNewEntryText' | 'setSelectedDate' | 'setTags' | 'setTimeCapsule' | 'setTimeOfDay' | 'setTitle' | 'setVisibility' | 'suggestingTags' | 'tags' | 'timeCapsule' | 'timeOfDay' | 'title' | 'uploadedAttachments' | 'visibility'>;
  entryNavigationState: Pick<EntryNavigationState, 'handleBackToSource' | 'handleNavigateToEntry' | 'handleOpenEntryInList' | 'handleShareEntry'>;
  handleDiscuss: (entry: Entry) => void;
  handleRephrase?: (entry: Entry, mode: RephraseMode) => Promise<void>;
  /** Resolves with the summary, null when it failed, undefined when the writer did not send the request. */
  handleSummarize?: (entry: Entry, guidance: SummaryGuidance) => Promise<string | null | undefined>;
  /** Moves one entry to another diary; resolves `false` when it could not. */
  handleMoveToDiary?: (entry: Entry, diaryId: number, closeAsker?: () => void) => Promise<boolean>;
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
  offline,
  quickCapture,
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
    offline,
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
    noticeAction: appNotice.action,
    chatEntry,
    onCloseChat: () => setChatEntry(null),
    onLoadChatHistory: handleLoadAiChatHistory,
    onSendChat: handleAiChat,
    quickCapture,
  };
}

export function buildAuthenticatedRoutesProps({
  bulkSelectState,
  config,
  configLoaded,
  configRead,
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
  handleMoveToDiary,
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
  // A change built on the stored settings (a settings page, the tag list, the templates) waits for them to be
  // read: built on the defaults instead, it would save those over the writer's settings
  const saveOverStoredConfig = (newConfig: Config): Promise<boolean> => {
    if (configRead) return saveConfig(newConfig);
    notify(t('settingsUnreadSaveRefused'));
    return Promise.resolve(false);
  };

  return {
    feedRouteProps: {
      theme: config.theme,
      language: config.language,
      readDates: config.readDates !== false,
      ttsVoiceUri: config.ttsVoiceUri,
      onWriteAbout: (entry) => routingState.handleViewChange('journal', writeAboutState({
        content: entry.content,
        format: entry.format,
        username: entry.author.username,
      })),
      t,
    },
    memoirRouteProps: {
      theme: config.theme,
      language: config.language,
      diaries: diariesState.diaries,
      onDiariesChanged: diariesState.fetchDiaries,
      simpleMode: config.memoirSimpleMode === true,
      onSimpleModeChange: (memoirSimpleMode: boolean) => saveConfig({ ...config, memoirSimpleMode }),
      t,
    },
    welcomeRouteProps: {
      theme: config.theme,
      language: config.language,
      diaries: diariesState.diaries,
      onFinish: () => saveConfig({ ...config, onboardingDone: true }),
      onSetDiaryTemplate: (diary, templateId) => diariesState.handleUpdateDiary(diary.id, {
        name: diary.name,
        icon: diary.icon,
        visibility: diary.visibility,
        ...(diary.color ? { color: diary.color } : {}),
        defaultTemplateId: templateId,
      }),
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
      onUpdateConfig: saveOverStoredConfig,
      onDownloadData: downloadUserData,
      onBack: () => routingState.handleViewChange('journal'),
      t,
      stats: profileStats ?? undefined,
      diaries: diariesState.diaries,
    },
    tagManagerRouteProps: {
      config,
      allTags: entriesState.allTags,
      onUpdateConfig: saveOverStoredConfig,
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
      entryTemplates: getEntryTemplates(config.entryTemplates, config.language),
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
        routingState.handleViewChange('journal');
      },
      onOpenJournalTag: (tag: string) => {
        entriesState.setFilterTags([tag]);
        entriesState.setFilterDateObj(null);
        routingState.handleViewChange('journal');
      },
      // The journal's search has no month filter, so a word opens its results from every month
      onSearchJournal: (word: string) => {
        entriesState.setSearchMode('keyword');
        entriesState.setSearch(word);
        entriesState.setFilterDateObj(null);
        routingState.handleViewChange('journal');
      },
      theme: config.theme,
      language: config.language,
      t,
      tagMetadata,
    },
    tasksRouteProps: {
      diaries: diariesState.diaries,
      currentDiaryId: diariesState.currentDiaryId,
      onDiaryChange: routingState.handleDiaryChange,
      onManageDiaries: () => routingState.handleManageDiaries('tasks'),
      theme: config.theme,
      language: config.language,
      t,
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
        entryTemplates: getEntryTemplates(config.entryTemplates, config.language),
        // The name dialog says itself when the template could not be saved (or, with the settings unread, was not)
        onSaveTemplate: (draft: EntryTemplateDraft) => {
          if (!configRead) return Promise.resolve(false);
          const currentTemplates = parseCustomEntryTemplates(config.entryTemplates);
          const nextTemplates = [...currentTemplates, createEntryTemplate(draft)];
          return updateConfig({
            ...config,
            entryTemplates: serializeCustomEntryTemplates(nextTemplates),
          });
        },
        onDeleteTemplate: (templateId: string) => {
          const nextTemplates = parseCustomEntryTemplates(config.entryTemplates)
            .filter((template) => template.id !== templateId);
          return saveOverStoredConfig({
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
        // A diary with AI off offers no AI action in the composer; one that asks each time asks before Auto Tag and
        // Rephrase, and offers no Get Inspired, which reads the tags of many entries
        onSuggestTags: entryFormState.diaryAiMode === 'off' ? undefined : entryFormState.handleSuggestTags,
        fixingWriting: entryFormState.fixingWriting,
        onFixWriting: entryFormState.diaryAiMode === 'off' ? undefined : entryFormState.handleFixWriting,
        onGetInspiration: entryFormState.diaryAiMode === 'on' ? handleGetInspiration : undefined,
        promptCardsDrawn: config.promptCardsDrawn,
        // A card drawn before the settings arrive would be drawn from an empty deck history and saved over it
        promptCardsReady: configLoaded,
        // A draw that fails to save (or, with the settings unread, is not saved) only lets a card come back sooner
        onPromptCardsDrawnChange: (promptCardsDrawn: string) => {
          if (configRead) void updateConfig({ ...config, promptCardsDrawn });
        },
        onSubmit: entryFormState.handleSubmit,
        pendingFiles: entryFormState.pendingFiles,
        uploadedAttachments: entryFormState.uploadedAttachments,
        onAddFile: entryFormState.addPendingFile,
        onRemovePendingFile: entryFormState.removePendingFile,
        onRemoveUploadedAttachment: entryFormState.removeUploadedAttachment,
        draft: entryFormState.draft,
        diaryTemplateName: entryFormState.diaryTemplateName,
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
      },
      entriesList: buildEntriesListProps({
        bulkSelectState,
        deleteModalState,
        diariesState,
        entriesState,
        entryEditState,
        entryNavigationState,
        handleDiscuss,
        handleMoveToDiary,
        handleRephrase,
        handleSummarize,
        knownTags,
        tagMetadata,
      }),
      feed: entriesState.feed,
      savedEntry: entryFormState.savedEntry,
      randomEntry: {
        query: entriesState.listQuery,
        listEmpty: !entriesState.loading && entriesState.entries.length === 0,
        onOpen: entryNavigationState.handleOpenEntryInList,
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