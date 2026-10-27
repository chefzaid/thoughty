import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useAppNotice } from './useAppNotice';
import { useAppRouteState } from './useAppRouteState';
import { useAppShellEffects } from './useAppShellEffects';
import { useAppShellRouting } from './useAppShellRouting';
import { useEntryNavigation } from './useEntryNavigation';
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
  type ContactPageProps,
  type FeedbackPageProps,
  type IntroPageProps,
  type LegalPageProps,
  type UnsubscribePageProps,
  type VerifyEmailPageProps,
} from '../utils/appShellProps';
import type { RephraseMode, SummaryGuidance } from '../services/api/aiService';
import type { Entry, PublicViewType, ViewType } from '../types';

interface AppShellModel {
  authLoading: boolean;
  isAuthenticated: boolean;
  currentView: ViewType | null;
  publicView: PublicViewType | null;
  authPageProps: AuthPageProps;
  aboutPageProps: AboutPageProps;
  blogPageProps: BlogPageProps;
  contactPageProps: ContactPageProps;
  feedbackPageProps: FeedbackPageProps;
  legalPageProps: Omit<LegalPageProps, 'page'>;
  verifyEmailPageProps: VerifyEmailPageProps;
  unsubscribePageProps: UnsubscribePageProps;
  authenticatedLayoutProps: AuthenticatedLayoutProps;
  authenticatedRoutesProps: AuthenticatedRoutesProps;
  introPageProps: IntroPageProps;
}

export function useAppShellModel(): AppShellModel {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
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
  } = useConfig(isAuthenticated);
  const appNotice = useAppNotice(t, resolveLanguage(config.language));
  const { notifier } = appNotice;
  // Settings the reader changes on purpose say so when they could not be saved
  const saveConfig = useReportedConfigUpdate(updateConfig, notifier);

  const diariesState = useDiaries(isAuthenticated, routeEntryId !== undefined || routeDiaryId !== undefined);
  const { currentDiaryId, setCurrentDiaryId, fetchDiaries, diarySelectionReady } = diariesState;

  const entriesState = useEntries(isAuthenticated, config, currentDiaryId, notifier, {
    configLoaded,
    // A diary in the route is applied after the first render; the list waits for it
    filtersReady: diarySelectionReady && (routeDiaryId === undefined || routeDiaryId === currentDiaryId),
    routeEntryId,
    routePersonId,
  });

  const entryFormState = useEntryForm(config, currentDiaryId, () => {
    entriesState.setPage(1);
    // The list, its dates, and every view measured from the entries (calendar, writing streak) read them again
    void entriesState.refreshEntryQueries();
  });

  const entryEditState = useEntryEdit(config, entriesState.fetchEntries, notifier);

  // A deleted entry leaves every view measured from the entries (calendar, writing streak) too
  const deleteModalState = useDeleteModal(() => { void entriesState.refreshEntryQueries(); }, notifier);

  const handleMakeBook = useCallback((entryIds: number[]) => {
    const { state, ...to } = buildBookConverterRoute(currentDiaryId, entryIds);
    navigate(to, { state });
  }, [currentDiaryId, navigate]);

  const bulkSelectState = useBulkSelect(entriesState.fetchEntries, entriesState.entries, notifier, handleMakeBook);

  const handleNavigateToFirst = useCallback(async (year: number, month: number | null) => {
    const data = await entriesState.entriesService.navigateToFirst(year, month, entriesState.getLimit());
    if (data?.found) {
      entriesState.setPage(data.page || 1);
      if (data.entryId) {
        entriesState.setTargetEntryId(data.entryId);
      }
    }
  }, [entriesState]);

  const entryNavigationState = useEntryNavigation({
    configLoaded,
    currentDiaryId,
    currentView,
    entries: entriesState.entries,
    entriesService: entriesState.entriesService,
    filterArchiveStatus: entriesState.filterArchiveStatus,
    filterMood: entriesState.filterMood,
    filterEraId: entriesState.filterEraId,
    filterPersonId: entriesState.filterPersonId,
    filterDateObj: entriesState.filterDateObj,
    filterFavorites: entriesState.filterFavorites,
    filterTags: entriesState.filterTags,
    filterVisibility: entriesState.filterVisibility,
    getLimit: entriesState.getLimit,
    handledPermalinkEntryId: entriesState.handledPermalinkEntryId,
    isAuthenticated,
    loading: entriesState.loading,
    navigate,
    page: entriesState.page,
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
    setPage: entriesState.setPage,
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

  const { aiService } = useApiServices();

  const handleDiscuss = useCallback((entry: Entry) => {
    setChatEntry(entry);
  }, []);

  const handleRephrase = useCallback(async (entry: Entry, mode: RephraseMode) => {
    const rewritten = await aiService.fixWriting(entry.content, mode);

    if (rewritten === null) {
      notifier.notify(t('rephraseEntryFailed'));
      return;
    }

    entryEditState.handleEdit(entry);
    entryEditState.setEditText(rewritten);
  }, [aiService, entryEditState, notifier, t]);

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

  const {
    introPageProps,
    aboutPageProps,
    blogPageProps,
    contactPageProps,
    feedbackPageProps,
    legalPageProps,
    authPageProps,
    verifyEmailPageProps,
    unsubscribePageProps,
  } = buildPublicShellProps({
    configTheme: config.theme,
    isAuthenticated,
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
    entryToast: entryNavigationState.entryToast,
    handleAiChat,
    handleLoadAiChatHistory,
    isEmailVerified: user?.emailVerified ?? false,
    routingState,
    setChatEntry,
    t,
    userName: config.name || user?.username || 'User',
  });

  return {
    authLoading,
    isAuthenticated,
    currentView,
    publicView,
    authPageProps,
    aboutPageProps,
    blogPageProps,
    contactPageProps,
    feedbackPageProps,
    legalPageProps,
    verifyEmailPageProps,
    unsubscribePageProps,
    authenticatedLayoutProps,
    authenticatedRoutesProps,
    introPageProps,
  };
}
