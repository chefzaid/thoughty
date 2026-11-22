import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useAppNotice } from './useAppNotice';
import { useAppQuickCapture } from './useAppQuickCapture';
import { useAppRouteState } from './useAppRouteState';
import { useAppShellEffects } from './useAppShellEffects';
import { useAppShellRouting } from './useAppShellRouting';
import { useDeleteUndo } from './useDeleteUndo';
import { useEntryNavigation } from './useEntryNavigation';
import { useTransientMessage } from './useTransientMessage';
import { useMoveToDiary } from './useMoveToDiary';
import {
  useApiServices,
  useBulkSelect,
  useConfig,
  useDeleteModal,
  useDiaries,
  useEntries,
  useEntryEdit,
  useEntryForm,
} from './useAppState';
import { useReportedConfigUpdate } from './useConfigState';
import { resolveLanguage } from '../utils/language';
import { buildBookConverterRoute } from '../utils/appRouting';
import { parseTagMetadata, serializeTagMetadata } from '../utils/tagMetadata';
import {
  buildAuthenticatedLayoutProps,
  buildAuthenticatedRoutesProps,
  buildPublicShellProps,
  type AboutPageProps,
  type AuthPageProps,
  type AuthenticatedLayoutProps,
  type AuthenticatedRoutesProps,
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
} from '../utils/appShellProps';
import type { RephraseMode, SummaryGuidance } from '../services/api/aiService';
import type { Entry, PublicViewType, ViewType } from '../types';
import { landingViewFor } from '../utils/landingView';

interface AppShellModel {
  authLoading: boolean;
  isAuthenticated: boolean;
  currentView: ViewType | null;
  /** Where a signed-in writer lands (the journal, simple memoir mode, or a new account's welcome page); null until the settings are read. */
  landingView: ViewType | null;
  publicView: PublicViewType | null;
  authPageProps: AuthPageProps;
  aboutPageProps: AboutPageProps;
  blogPageProps: BlogPageProps;
  contactPageProps: ContactPageProps;
  feedbackPageProps: FeedbackPageProps;
  memoirQuestionsPageProps: MemoirQuestionsPageProps;
  journalTemplatesPageProps: JournalTemplatesPageProps;
  legalPageProps: Omit<LegalPageProps, 'page'>;
  verifyEmailPageProps: VerifyEmailPageProps;
  completeSignUpPageProps: CompleteSignUpPageProps;
  resetPasswordPageProps: ResetPasswordPageProps;
  unsubscribePageProps: UnsubscribePageProps;
  authenticatedLayoutProps: AuthenticatedLayoutProps;
  authenticatedRoutesProps: AuthenticatedRoutesProps;
  introPageProps: IntroPageProps;
  /** Set while the session goes on but Thoughty could not say whose it is (and no writer here is theirs). */
  sessionUnreachablePageProps: SessionUnreachablePageProps | null;
}

export function useAppShellModel(): AppShellModel {
  const { isAuthenticated, loading: authLoading, user, logout, offline, unreachable, retrySession } = useAuth();
  const navigate = useNavigate();
  const {
    searchParams,
    currentView,
    publicView,
    routeDiaryId,
    routeEntryId,
    routePersonId,
    diaryReturnView,
    importExportSection,
    importExportFormat,
    importExportIncludeVisibility,
  } = useAppRouteState();
  const [highlightsModalOpen, setHighlightsModalOpen] = useState(false);
  const [chatEntry, setChatEntry] = useState<Entry | null>(null);

  const {
    config,
    configLoaded,
    profileStats,
    fetchConfig,
    fetchProfileStats,
    updateConfig,
    downloadUserData,
    t,
  } = useConfig(isAuthenticated, offline);
  const appNotice = useAppNotice(t, resolveLanguage(config.language));
  const { notifier } = appNotice;
  // Settings the reader changes on purpose say so when they could not be saved
  const saveConfig = useReportedConfigUpdate(updateConfig, notifier);

  const diariesState = useDiaries(isAuthenticated, routeEntryId !== undefined || routeDiaryId !== undefined);
  const { currentDiaryId, setCurrentDiaryId, fetchDiaries, diarySelectionReady } = diariesState;

  // Says that an entry to open (a link, a cross-reference, the entry being read) could not be found
  const entryToast = useTransientMessage();
  const entriesState = useEntries(isAuthenticated, currentDiaryId, notifier, {
    configLoaded,
    onEntryMissing: entryToast.show,
    // A diary in the route is applied after the first render; the list waits for it
    filtersReady: diarySelectionReady && (routeDiaryId === undefined || routeDiaryId === currentDiaryId),
    routeEntryId,
    routePersonId,
  });

  const { fetchEntries, refreshBacklinks, refreshEntryQueries } = entriesState;
  const entryFormState = useEntryForm(config, currentDiaryId, () => {
    // The list goes back to its start, where the new entry is
    entriesState.openListAt(null);
    // The list, its dates, and every view measured from the entries (calendar, writing streak) read them again,
    // and so do the backlinks, which the new entry's links (a reply's, say) add to
    refreshBacklinks();
    void refreshEntryQueries();
  }, diariesState.diaries);

  // Every view measured from the entries (list, calendar, writing streak, backlinks) reads them again
  const refreshEntryViews = useCallback(() => {
    refreshBacklinks();
    void refreshEntryQueries();
  }, [refreshBacklinks, refreshEntryQueries]);


  // An undone delete brings the entries back to every view measured from them
  const offerDeleteUndo = useDeleteUndo(refreshEntryViews, notifier);

  // A deleted entry leaves every view measured from the entries (calendar, writing streak, backlinks) too
  const deleteModalState = useDeleteModal((entryId) => {
    refreshBacklinks();
    void refreshEntryQueries();
    offerDeleteUndo([entryId]);
  }, notifier);

  const handleMakeBook = useCallback((entryIds: number[]) => {
    const { state, ...to } = buildBookConverterRoute(currentDiaryId, { kind: 'entries', entryIds });
    navigate(to, { state });
  }, [currentDiaryId, navigate]);

  const bulkSelectState = useBulkSelect(entriesState.fetchEntries, entriesState.entries, notifier, handleMakeBook, offerDeleteUndo);

  /** Opens the list at the first entry of a year or month among the filters, leaving out the day filter. */
  const { entriesService, listQuery, openListAt, setFilterDateObj, setTargetEntryId } = entriesState;
  const handleNavigateToFirst = useCallback(async (year: number, month: number | null) => {
    const data = await entriesService.navigateToFirst(year, month, { ...listQuery, filterDate: '' });
    if (data?.found && data.entryId) {
      setFilterDateObj(null);
      openListAt(data.entryId);
      setTargetEntryId(data.entryId);
    } else {
      entryToast.show();
    }
  }, [entriesService, entryToast, listQuery, openListAt, setFilterDateObj, setTargetEntryId]);

  const entryNavigationState = useEntryNavigation({
    currentDiaryId,
    currentView,
    entriesService: entriesState.entriesService,
    filterArchiveStatus: entriesState.filterArchiveStatus,
    filterMood: entriesState.filterMood,
    filterEraId: entriesState.filterEraId,
    filterPersonId: entriesState.filterPersonId,
    filterDateObj: entriesState.filterDateObj,
    filterFavorites: entriesState.filterFavorites,
    filterTags: entriesState.filterTags,
    filterVisibility: entriesState.filterVisibility,
    entryToast,
    handledPermalinkEntryId: entriesState.handledPermalinkEntryId,
    isAuthenticated,
    navigate,
    openListAt: entriesState.openListAt,
    routeEntryId,
    search: entriesState.search,
    searchParams,
    setActiveTargetId: entriesState.setActiveTargetId,
    setCurrentDiaryId,
    setFilterArchiveStatus: entriesState.setFilterArchiveStatus,
    setFilterMood: entriesState.setFilterMood,
    setFilterEraId: entriesState.setFilterEraId,
    setFilterPersonId: entriesState.setFilterPersonId,
    setFilterDateObj: entriesState.setFilterDateObj,
    setFilterFavorites: entriesState.setFilterFavorites,
    setFilterTags: entriesState.setFilterTags,
    setFilterVisibility: entriesState.setFilterVisibility,
    setHandledPermalinkEntryId: entriesState.setHandledPermalinkEntryId,
    filtersResetting: entriesState.filtersResetting,
    setFiltersResetting: entriesState.setFiltersResetting,
    setSearch: entriesState.setSearch,
    setSourceEntry: entriesState.setSourceEntry,
    setTargetEntryId: entriesState.setTargetEntryId,
    sourceEntry: entriesState.sourceEntry,
    t,
  });

  const routingState = useAppShellRouting({
    currentDiaryId,
    currentView,
    diaryReturnView,
    fetchConfig,
    fetchDiaries,
    fetchEntryDates: entriesState.fetchEntryDates,
    fetchProfileStats,
    importExportFormat,
    importExportIncludeVisibility,
    importExportSection,
    logout,
    navigate,
    searchParams,
    setCurrentDiaryId,
  });

  // A moved entry leaves the views that follow its old diary and joins those of the new one
  const moveToDiary = useMoveToDiary({
    diaries: diariesState.diaries,
    currentDiaryId,
    onMoved: refreshEntryViews,
    notifier,
    onShowDiary: routingState.handleDiaryChange,
  });
  const moveEntryToDiary = useCallback(
    (entry: Entry, diaryId: number, closeAsker?: () => void) => moveToDiary(entry.id, diaryId, closeAsker),
    [moveToDiary],
  );

  // An edit can add or remove links as well
  const entryEditState = useEntryEdit(config, useCallback(() => {
    refreshBacklinks();
    void fetchEntries();
  }, [fetchEntries, refreshBacklinks]), notifier, moveToDiary);

  const quickCapture = useAppQuickCapture({
    entriesService: entriesState.entriesService,
    notifier,
    currentView,
    searchParams,
    navigate,
    openView: routingState.handleViewChange,
    setComposerText: entryFormState.setNewEntryText,
    onSaved: refreshEntryViews,
  });

  const { aiService } = useApiServices();

  const handleDiscuss = useCallback((entry: Entry) => {
    setChatEntry(entry);
  }, []);

  // Kept the same between renders, so the entry cards that offer it are not drawn again with each batch
  const { handleEdit: editEntry, setEditText } = entryEditState;
  const handleRephrase = useCallback(async (entry: Entry, mode: RephraseMode) => {
    const rewritten = await aiService.fixWriting(entry.content, mode);

    if (rewritten === null) {
      notifier.notify(t('rephraseEntryFailed'));
      return;
    }

    editEntry(entry);
    setEditText(rewritten);
  }, [aiService, editEntry, notifier, setEditText, t]);

  const handleSummarize = useCallback(async (entryId: number, guidance: SummaryGuidance) => {
    return aiService.summarizeEntry(entryId, guidance);
  }, [aiService]);

  const handleGetInspiration = useCallback(async () => {
    return aiService.getInspiration(currentDiaryId ?? undefined);
  }, [aiService, currentDiaryId]);

  const handleFindDuplicateEntries = useCallback(async (diaryId?: number) => {
    return aiService.findDuplicateEntries(diaryId);
  }, [aiService]);

  const handleLoadAiChatHistory = useCallback(async (entryId: number) => {
    return aiService.getChatHistory(entryId);
  }, [aiService]);

  const handleAiChat = useCallback(async (
    entryId: number,
    entryContent: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
  ) => {
    return aiService.chat(entryId, entryContent, messages);
  }, [aiService]);

  const tagMetadata = useMemo(() => parseTagMetadata(config.tagMetadata), [config.tagMetadata]);
  const serializedTagMetadata = useMemo(() => serializeTagMetadata(tagMetadata), [tagMetadata]);

  const handleRenameTag = useCallback(async (currentTag: string, nextTag: string) => {
    const result = await entriesState.entriesService.renameTag(currentTag, nextTag);
    if (!result?.success) {
      return false;
    }

    entryFormState.setTags((previousTags) => [...new Set(previousTags.map((tag) => (tag === currentTag ? nextTag : tag)))]);
    entryEditState.setEditTags((previousTags) => [...new Set(previousTags.map((tag) => (tag === currentTag ? nextTag : tag)))]);
    entriesState.setFilterTags((previousTags) => [...new Set(previousTags.map((tag) => (tag === currentTag ? nextTag : tag)))]);

    entriesState.fetchEntries();
    fetchProfileStats();
    return true;
  }, [entriesState, entryEditState, entryFormState, fetchProfileStats]);

  const handleDeleteTag = useCallback(async (tag: string) => {
    const result = await entriesState.entriesService.deleteTag(tag);
    if (!result?.success) {
      return false;
    }

    const withoutTag = (previousTags: string[]) => previousTags.filter((current) => current !== tag);
    entryFormState.setTags(withoutTag);
    entryEditState.setEditTags(withoutTag);
    entriesState.setFilterTags(withoutTag);

    entriesState.fetchEntries();
    fetchProfileStats();
    return true;
  }, [entriesState, entryEditState, entryFormState, fetchProfileStats]);

  const handleLoadTagUsage = useCallback(
    () => entriesState.entriesService.fetchTagUsage(),
    [entriesState.entriesService],
  );

  useAppShellEffects({
    allTags: entriesState.allTags,
    config,
    currentDiaryId,
    isAuthenticated,
    routeDiaryId,
    serializedTagMetadata,
    setCurrentDiaryId,
    tagMetadata,
    updateConfig,
  });

  let landingView: ViewType | null = null;
  if (configLoaded) landingView = landingViewFor(config);

  const {
    introPageProps,
    aboutPageProps,
    blogPageProps,
    contactPageProps,
    feedbackPageProps,
    memoirQuestionsPageProps,
    journalTemplatesPageProps,
    legalPageProps,
    authPageProps,
    verifyEmailPageProps,
    completeSignUpPageProps,
    resetPasswordPageProps,
    unsubscribePageProps,
  } = buildPublicShellProps({
    configTheme: config.theme,
    configLanguage: config.language,
    isAuthenticated,
    landingView,
    publicView,
    routingState,
    t,
  });

  const authenticatedRoutesProps = buildAuthenticatedRoutesProps({
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
    handleMoveToDiary: moveEntryToDiary,
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
    notify: notifier.notify,
    profileStats,
    routingState,
    setHighlightsModalOpen,
    saveConfig,
    t,
    tagMetadata,
    updateConfig,
  });

  const authenticatedLayoutProps = buildAuthenticatedLayoutProps({
    avatarUrl: config.avatarUrl || user?.avatarUrl,
    bulkSelectState,
    chatEntry,
    config,
    currentView,
    deleteModalState,
    appNotice,
    entryToast,
    handleAiChat,
    handleLoadAiChatHistory,
    isEmailVerified: user?.emailVerified ?? false,
    offline,
    quickCapture,
    routingState,
    setChatEntry,
    t,
    userName: config.name || user?.username || 'User',
  });

  const sessionUnreachablePageProps: SessionUnreachablePageProps | null = unreachable
    ? { t, theme: config.theme || 'dark', onRetry: retrySession, onSignOut: logout }
    : null;

  return {
    authLoading,
    isAuthenticated,
    currentView,
    landingView,
    publicView,
    authPageProps,
    aboutPageProps,
    blogPageProps,
    contactPageProps,
    feedbackPageProps,
    memoirQuestionsPageProps,
    journalTemplatesPageProps,
    legalPageProps,
    verifyEmailPageProps,
    completeSignUpPageProps,
    resetPasswordPageProps,
    unsubscribePageProps,
    authenticatedLayoutProps,
    authenticatedRoutesProps,
    introPageProps,
    sessionUnreachablePageProps,
  };
}
