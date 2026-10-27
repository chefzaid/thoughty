import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppShellModel } from './useAppShellModel';
import {
  mocks,
  stubShellModelHooks,
  t,
  fetchProfileStats,
  updateConfig,
  fetchEntries,
  setPage,
  setTargetEntryId,
  setFilterTags,
  setTags,
  setEditTags,
  handleEdit,
  setEditText,
  fixWriting,
  renameTag,
  deleteTag,
  navigateToFirst,
  navigate,
} from './useAppShellModel.test-helpers';
import type { MockedRoutesProps } from './useAppShellModel.test-helpers';

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: (await import('./useAppShellModel.test-helpers')).mocks.useNavigate,
}));
vi.mock('../contexts/AuthContext', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.authContext);
vi.mock('./useAppRouteState', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appRouteState);
vi.mock('./useAppShellEffects', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appShellEffects);
vi.mock('./useAppShellRouting', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appShellRouting);
vi.mock('./useEntryNavigation', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.entryNavigation);
vi.mock('./useAppState', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appState);
vi.mock('../utils/tagMetadata', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.tagMetadata);
vi.mock('../utils/appShellProps', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.appShellProps);

describe('useAppShellModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubShellModelHooks();
  });

  it('deletes a tag everywhere it is selected and loads tag usage', async () => {
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;

    await expect(routesProps.handleDeleteTag('current')).resolves.toBe(true);
    expect(deleteTag).toHaveBeenCalledWith('current');
    const nextFormTags = (setTags.mock.calls.at(-1)?.[0] as (tags: string[]) => string[])(['current', 'other']);
    const nextFilterTags = (setFilterTags.mock.calls.at(-1)?.[0] as (tags: string[]) => string[])(['current']);
    expect(nextFormTags).toEqual(['other']);
    expect(nextFilterTags).toEqual([]);
    expect(fetchEntries).toHaveBeenCalled();

    await expect(routesProps.handleLoadTagUsage()).resolves.toEqual([{ tag: 'current', count: 2 }]);
  });

  it('returns false for a failed tag rename and skips follow-up updates', async () => {
    renameTag.mockResolvedValueOnce({ success: false });
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;

    await expect(routesProps.handleRenameTag('current', 'blocked')).resolves.toBe(false);

    expect(setTags).not.toHaveBeenCalled();
    expect(setEditTags).not.toHaveBeenCalled();
    expect(setFilterTags).not.toHaveBeenCalled();
    expect(fetchEntries).not.toHaveBeenCalled();
    expect(fetchProfileStats).not.toHaveBeenCalled();
  });

  it('skips page updates when navigate-to-first does not find an entry', async () => {
    navigateToFirst.mockResolvedValueOnce({ found: false, page: 9, entryId: 88 });
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;

    await act(async () => {
      await routesProps.handleNavigateToFirst(2023, null);
    });

    expect(navigateToFirst).toHaveBeenCalledWith(2023, null, 25);
    expect(setPage).not.toHaveBeenCalled();
    expect(setTargetEntryId).not.toHaveBeenCalled();
  });

  it('shows a notice and skips edit state updates when rephrasing returns null', async () => {
    fixWriting.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;

    await act(async () => {
      await routesProps.handleRephrase?.({ id: 44, content: 'Needs help' }, 'rewrite');
    });

    expect(fixWriting).toHaveBeenCalledWith('Needs help', 'rewrite');
    expect(result.current.authenticatedLayoutProps).toMatchObject({
      appNotice: { text: 'rephraseEntryFailed', toast: expect.objectContaining({ visible: true }) },
    });
    expect(handleEdit).not.toHaveBeenCalled();
    expect(setEditText).not.toHaveBeenCalled();
  });

  it('says in the notice toast when settings changed on purpose could not be saved', async () => {
    updateConfig.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;

    await act(async () => {
      await expect(routesProps.saveConfig({ theme: 'light' })).resolves.toBe(true);
    });
    expect(result.current.authenticatedLayoutProps).toMatchObject({
      appNotice: { toast: expect.objectContaining({ visible: false }) },
    });

    await act(async () => {
      await expect(routesProps.saveConfig({ theme: 'light' })).resolves.toBe(false);
    });
    expect(updateConfig).toHaveBeenCalledTimes(2);
    expect(updateConfig).toHaveBeenLastCalledWith({ theme: 'light' });
    expect(result.current.authenticatedLayoutProps).toMatchObject({
      appNotice: { text: 'settingsSaveFailed', toast: expect.objectContaining({ visible: true }) },
    });
    // The quiet update stays available for saves that report a failure themselves
    expect(routesProps.updateConfig).toBe(updateConfig);
  });

  it('hands the notifier to the entry hooks', () => {
    renderHook(() => useAppShellModel());

    const notifier = expect.objectContaining({ notify: expect.any(Function), t, language: 'en' });
    expect(mocks.useEntries).toHaveBeenCalledWith(true, expect.anything(), expect.anything(), notifier, expect.anything());
    expect(mocks.useEntryEdit).toHaveBeenCalledWith(expect.anything(), expect.any(Function), notifier);
    expect(mocks.useDeleteModal).toHaveBeenCalledWith(expect.any(Function), notifier);
    expect(mocks.useBulkSelect).toHaveBeenCalledWith(expect.any(Function), expect.anything(), notifier, expect.any(Function));
  });

  it('opens the book converter of the current diary on the entries picked in the journal', () => {
    renderHook(() => useAppShellModel());
    const makeBook = mocks.useBulkSelect.mock.calls.at(-1)![3] as (entryIds: number[]) => void;

    act(() => makeBook([4, 2]));

    expect(navigate).toHaveBeenCalledWith(
      { pathname: '/import-export', search: '?diary=9&section=book&format=txt' },
      { state: { bookEntryIds: [4, 2] } },
    );
  });
});
