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
  openListAt,
  setTargetEntryId,
  setFilterTags,
  setTags,
  setEditTags,
  handleEdit,
  setEditText,
  fixWriting,
  fetchDiaries,
  renameTag,
  deleteTag,
  navigateToFirst,
  offerDeleteUndo,
  refreshEntryQueries,
  refreshBacklinks,
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
vi.mock('./useDeleteUndo', async () => (await import('./useAppShellModel.test-helpers')).mockedModules.deleteUndo);
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

  it('says so, and leaves the list where it is, when a month has no entry among the filters', async () => {
    navigateToFirst.mockResolvedValueOnce({ found: false, years: [2023], months: [] });
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;

    await act(async () => {
      await routesProps.handleNavigateToFirst(2023, null);
    });

    expect(navigateToFirst).toHaveBeenCalledWith(2023, null, expect.objectContaining({ filterDate: '' }));
    expect(openListAt).not.toHaveBeenCalled();
    expect(setTargetEntryId).not.toHaveBeenCalled();
    expect(result.current.authenticatedLayoutProps).toMatchObject({ entryToast: expect.objectContaining({ visible: true }) });
  });

  it('shows a notice and skips edit state updates when rephrasing returns null', async () => {
    fixWriting.mockResolvedValueOnce({ data: null, refusal: null });
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;

    await act(async () => {
      await routesProps.handleRephrase?.({ id: 44, content: 'Needs help', diary_id: 5 }, 'rewrite');
    });

    // The entry's diary goes with its text, so the server can refuse a diary with AI off
    expect(fixWriting).toHaveBeenCalledWith('Needs help', 'rewrite', 5, undefined);
    expect(result.current.authenticatedLayoutProps).toMatchObject({
      appNotice: { text: 'rephraseEntryFailed', toast: expect.objectContaining({ visible: true }) },
    });
    expect(handleEdit).not.toHaveBeenCalled();
    expect(setEditText).not.toHaveBeenCalled();
  });

  it('shows the refusal of a diary turned AI off elsewhere, and reloads the diaries', async () => {
    fixWriting.mockResolvedValueOnce({ data: null, refusal: 'apiError_DIARY_AI_OFF' });
    const { result } = renderHook(() => useAppShellModel());
    const routesProps = result.current.authenticatedRoutesProps as MockedRoutesProps;
    fetchDiaries.mockClear();

    await act(async () => {
      await routesProps.handleRephrase?.({ id: 44, content: 'Needs help', diary_id: 5 }, 'rewrite');
    });

    expect(result.current.authenticatedLayoutProps).toMatchObject({
      appNotice: { text: 'apiError_DIARY_AI_OFF', toast: expect.objectContaining({ visible: true }) },
    });
    expect(fetchDiaries).toHaveBeenCalledTimes(1);
    expect(handleEdit).not.toHaveBeenCalled();
    // The composer and the bulk rephrase reload them the same way
    expect(mocks.useEntryForm).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(), expect.any(Function), expect.any(Array), fetchDiaries, expect.any(Function),
    );
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
    expect(mocks.useEntries).toHaveBeenCalledWith(true, expect.anything(), notifier, expect.anything());
    // The editor moves an entry through the same move as the entry's menu, which the journal list gets too
    expect(mocks.useEntryEdit).toHaveBeenCalledWith(expect.anything(), expect.any(Function), notifier, expect.any(Function));
    expect(mocks.buildAuthenticatedRoutesProps).toHaveBeenCalledWith(expect.objectContaining({ handleMoveToDiary: expect.any(Function) }));
    expect(mocks.useDeleteModal).toHaveBeenCalledWith(expect.any(Function), notifier);
    expect(mocks.useBulkSelect).toHaveBeenCalledWith(expect.any(Function), expect.anything(), notifier, expect.any(Function), offerDeleteUndo, expect.any(Array), fetchDiaries);
    expect(mocks.useDeleteUndo).toHaveBeenCalledWith(expect.any(Function), notifier);
  });

  it('offers to undo a delete, and refreshes the journal when the entries come back', () => {
    renderHook(() => useAppShellModel());
    const onDelete = mocks.useDeleteModal.mock.calls.at(-1)![0] as (entryId: number) => void;
    const onRestored = mocks.useDeleteUndo.mock.calls.at(-1)![0] as () => void;

    act(() => onDelete(42));
    expect(refreshEntryQueries).toHaveBeenCalledTimes(1);
    expect(offerDeleteUndo).toHaveBeenCalledWith([42]);

    act(() => onRestored());
    expect(refreshEntryQueries).toHaveBeenCalledTimes(2);
    // Backlinks follow the entries that point at them
    expect(refreshBacklinks).toHaveBeenCalledTimes(2);
  });

  it('reads the backlinks and the list again once an entry is saved or edited', () => {
    renderHook(() => useAppShellModel());
    const onSaved = mocks.useEntryForm.mock.calls.at(-1)![2] as () => void;
    const onEdited = mocks.useEntryEdit.mock.calls.at(-1)![1] as () => void;

    act(() => onSaved());
    expect(refreshBacklinks).toHaveBeenCalledTimes(1);
    expect(refreshEntryQueries).toHaveBeenCalledTimes(1);

    act(() => onEdited());
    expect(refreshBacklinks).toHaveBeenCalledTimes(2);
    expect(fetchEntries).toHaveBeenCalled();
  });

  it('opens the book converter of the current diary on the entries picked in the journal', () => {
    renderHook(() => useAppShellModel());
    const makeBook = mocks.useBulkSelect.mock.calls.at(-1)![3] as (entryIds: number[]) => void;

    act(() => makeBook([4, 2]));

    expect(navigate).toHaveBeenCalledWith(
      { pathname: '/import-export', search: '?diary=9&section=book&format=txt' },
      { state: { bookStart: { kind: 'entries', entryIds: [4, 2] } } },
    );
  });
});
