import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppShellModel } from './useAppShellModel';
import {
  mocks,
  stubShellModelHooks,
  fetchProfileStats,
  updateConfig,
  fetchEntries,
  openListAt,
  setFilterDateObj,
  setTargetEntryId,
  setFilterTags,
  setTags,
  setEditTags,
  handleEdit,
  setEditText,
  aiChat,
  fixWriting,
  summarizeEntry,
  getInspiration,
  getChatHistory,
  renameTag,
  navigateToFirst,
} from './useAppShellModel.test-helpers';
import type { MockedLayoutProps, MockedRoutesProps } from './useAppShellModel.test-helpers';
import type { Entry } from '../types';

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: (await import('./useAppShellModel.test-helpers')).mocks.useNavigate,
}));
vi.mock('../contexts/AuthContext', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.authContext);
vi.mock('./useAppRouteState', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appRouteState);
vi.mock('./useAppShellEffects', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appShellEffects);
vi.mock('./useAppShellRouting', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appShellRouting);
vi.mock('./useEntryNavigation', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.entryNavigation);
vi.mock('./useDeleteUndo', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.deleteUndo);
vi.mock('./useAppState', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appState);
vi.mock('../utils/tagMetadata', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.tagMetadata);
vi.mock('../utils/appShellProps', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appShellProps);

describe('useAppShellModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubShellModelHooks();
  });

  it('assembles the shell model and wires side-effect inputs', () => {
    const { result } = renderHook(() => useAppShellModel());

    // The list waits for the config, the route's diary and the permalink lookup
    expect(mocks.useEntries).toHaveBeenCalledWith(true, 9, expect.anything(), {
      configLoaded: true,
      filtersReady: true,
      routeEntryId: 5,
      onEntryMissing: expect.any(Function),
    });
    expect(mocks.useAppShellEffects).toHaveBeenCalledWith(expect.objectContaining({
      allTags: ['current', 'later'],
      currentDiaryId: 9,
      isAuthenticated: true,
      routeDiaryId: 9,
      serializedTagMetadata: 'serialized-tag-metadata',
      tagMetadata: { current: { color: '#fff' } },
      updateConfig,
    }));
    expect(result.current.authLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.authPageProps).toMatchObject({ kind: 'auth', publicView: 'login' });
    expect(result.current.introPageProps).toMatchObject({ kind: 'intro', isAuthenticated: true, publicView: 'login' });
    expect(result.current.authenticatedLayoutProps).toMatchObject({
      kind: 'layout',
      userName: 'Config Name',
      avatarUrl: 'config-avatar.png',
      isEmailVerified: true,
      entryToast: expect.objectContaining({ visible: false }),
    });
    expect(result.current.authenticatedRoutesProps).toMatchObject({
      kind: 'routes',
      importExportFormat: 'json',
      importExportIncludeVisibility: true,
      importExportSection: 'import',
      highlightsModalOpen: false,
    });
  });

  it('holds the entries list until the diary in the route is applied', () => {
    mocks.useDiaries.mockReturnValue({ ...mocks.useDiaries(), currentDiaryId: null });

    renderHook(() => useAppShellModel());

    expect(mocks.useEntries).toHaveBeenLastCalledWith(true, null, expect.anything(), expect.objectContaining({
      filtersReady: false,
    }));
  });

  it('handles navigation, tag renaming, and AI chat callbacks', async () => {
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;
    const layoutProps = result.current.authenticatedLayoutProps as MockedLayoutProps;

    await act(async () => {
      await routesProps.handleNavigateToFirst(2024, 1);
    });

    // Among the list's filters, leaving the day out
    expect(navigateToFirst).toHaveBeenCalledWith(2024, 1, expect.objectContaining({ search: 'focus', diaryId: 9, filterDate: '' }));
    expect(setFilterDateObj).toHaveBeenCalledWith(null);
    expect(openListAt).toHaveBeenCalledWith(77);
    expect(setTargetEntryId).toHaveBeenCalledWith(77);

    await expect(layoutProps.handleLoadAiChatHistory(5)).resolves.toEqual([
      { role: 'assistant', content: 'history' },
    ]);
    expect(getChatHistory).toHaveBeenCalledWith(5);

    await expect(layoutProps.handleAiChat({ id: 5, content: 'entry text' } as Entry, [{ role: 'user', content: 'hello' }]))
      .resolves.toBe('assistant reply');
    expect(aiChat).toHaveBeenCalledWith(5, 'entry text', [{ role: 'user', content: 'hello' }], undefined);

    await expect(routesProps.handleRenameTag('current', 'renamed')).resolves.toBe(true);
    expect(renameTag).toHaveBeenCalledWith('current', 'renamed');

    const nextFormTags = (setTags.mock.calls[0]?.[0] as (tags: string[]) => string[])(['current', 'other', 'renamed']);
    const nextEditTags = (setEditTags.mock.calls[0]?.[0] as (tags: string[]) => string[])(['current', 'other']);
    const nextFilterTags = (setFilterTags.mock.calls[0]?.[0] as (tags: string[]) => string[])(['current', 'other']);

    expect(nextFormTags).toEqual(['renamed', 'other']);
    expect(nextEditTags).toEqual(['renamed', 'other']);
    expect(nextFilterTags).toEqual(['renamed', 'other']);
    expect(fetchEntries).toHaveBeenCalled();
    expect(fetchProfileStats).toHaveBeenCalled();

    act(() => {
      routesProps.handleDiscuss({ id: 33, content: 'Discuss me' });
    });

    expect(result.current.authenticatedLayoutProps.chatEntry).toEqual({ id: 33, content: 'Discuss me' });

    await act(async () => {
      await routesProps.handleRephrase?.({ id: 33, content: 'Discuss me' }, 'polish');
    });

    expect(fixWriting).toHaveBeenCalledWith('Discuss me', 'polish', undefined, undefined);
    expect(handleEdit).toHaveBeenCalledWith({ id: 33, content: 'Discuss me' });
    expect(setEditText).toHaveBeenCalledWith('Polished text');

    await expect(routesProps.handleSummarize?.({ id: 33, content: 'Discuss me' } as Entry, {
      includeDetails: 'decision',
      excludeDetails: 'names',
    })).resolves.toBe('Entry summary');
    expect(summarizeEntry).toHaveBeenCalledWith(33, {
      includeDetails: 'decision',
      excludeDetails: 'names',
    }, undefined);

    await expect(routesProps.handleGetInspiration?.()).resolves.toBe('Fresh question?');
    expect(getInspiration).toHaveBeenCalledWith(9);
  });
});
