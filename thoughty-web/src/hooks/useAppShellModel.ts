import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
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
import { parseTagMetadata, serializeTagMetadata } from '../utils/tagMetadata';
import {
  buildAuthenticatedLayoutProps,
  buildAuthenticatedRoutesProps,
  buildPublicShellProps,
  type AboutPageProps,
  type AuthPageProps,
  type AuthenticatedLayoutProps,
  type AuthenticatedRoutesProps,
  type ContactPageProps,
  type FeedbackPageProps,
  type IntroPageProps,
  type LegalPageProps,
} from '../utils/appShellProps';
import type { RephraseMode } from '../services/api/aiService';
import type { Entry, PublicViewType, ViewType } from '../types';

interface AppShellModel {
  authLoading: boolean;
  isAuthenticated: boolean;
  currentView: ViewType | null;
  pathname: string;
  publicView: PublicViewType | null;
  authPageProps: AuthPageProps;
  aboutPageProps: AboutPageProps;
  contactPageProps: ContactPageProps;
  feedbackPageProps: FeedbackPageProps;
  legalPageProps: Omit<LegalPageProps, 'page'>;
  authenticatedLayoutProps: AuthenticatedLayoutProps;
  authenticatedRoutesProps: AuthenticatedRoutesProps;
  introPageProps: IntroPageProps;
}

export function useAppShellModel(): AppShellModel {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    location,
    searchParams,
    currentView,
    publicView,
    routeDiaryId,
    routeEntryId,
    diaryReturnView,
    importExportSection,
    importExportFormat,
    importExportIncludeVisibility,
  } = useAppRouteState();
  const [highlightsModalOpen, setHighlightsModalOpen] = useState(false);
  const [chatEntry, setChatEntry] = useState<Entry | null>(null);

  const {
    config,
    profileStats,
    fetchConfig,
    fetchProfileStats,
    updateConfig,
    downloadUserData,
    t,
  } = useConfig(isAuthenticated);

  const diariesState = useDiaries(isAuthenticated, routeEntryId !== undefined || routeDiaryId !== undefined);
  const { currentDiaryId, setCurrentDiaryId, fetchDiaries } = diariesState;

  const entriesState = useEntries(isAuthenticated, config, currentDiaryId);

  const entryFormState = useEntryForm(config, currentDiaryId, () => {
    entriesState.setPage(1);
    entriesState.fetchEntries();
    entriesState.fetchEntryDates();
  });

  const entryEditState = useEntryEdit(config, entriesState.fetchEntries);

  const deleteModalState = useDeleteModal(entriesState.fetchEntries);

  const bulkSelectState = useBulkSelect(entriesState.fetchEntries, entriesState.entries);

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
    currentDiaryId,
    currentView,
    entries: entriesState.entries,
    entriesService: entriesState.entriesService,
    filterArchiveStatus: entriesState.filterArchiveStatus,
    filterDateObj: entriesState.filterDateObj,
    filterFavorites: entriesState.filterFavorites,
    filterTags: entriesState.filterTags,
    filterVisibility: entriesState.filterVisibility,
    getLimit: entriesState.getLimit,
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
    setFilterDateObj: entriesState.setFilterDateObj,
    setFilterFavorites: entriesState.setFilterFavorites,
    setFilterTags: entriesState.setFilterTags,
    setFilterVisibility: entriesState.setFilterVisibility,
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
    setCurrentDiaryId,
  });

  const { aiService } = useApiServices();

  const handleDiscuss = useCallback((entry: Entry) => {
    setChatEntry(entry);
  }, []);

  const handleRephrase = useCallback(async (entry: Entry, mode: RephraseMode) => {
    const rewritten = await aiService.fixWriting(entry.content, mode);

    if (rewritten === null) {
      alert('Unable to rephrase entry. Check your OpenRouter API key and try again.');
      return;
    }

    entryEditState.handleEdit(entry);
    entryEditState.setEditText(rewritten);
  }, [aiService, entryEditState]);

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
    contactPageProps,
    feedbackPageProps,
    legalPageProps,
    authPageProps,
  } = buildPublicShellProps({
    configTheme: config.theme,
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
  });

  const authenticatedLayoutProps = buildAuthenticatedLayoutProps({
    avatarUrl: config.avatarUrl || user?.avatarUrl,
    bulkSelectState,
    chatEntry,
    config,
    currentView,
    deleteModalState,
    entryToastVisible: entryNavigationState.entryToastVisible,
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
    pathname: location.pathname,
    publicView,
    authPageProps,
    aboutPageProps,
    contactPageProps,
    feedbackPageProps,
    legalPageProps,
    authenticatedLayoutProps,
    authenticatedRoutesProps,
    introPageProps,
  };
}
