import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listOf, noFilters, renderSavedSearches, savedSearch } from './SavedSearches.test-helpers';

const savedSearchesService = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => savedSearchesService,
}));

const filters = () => JSON.parse(screen.getByTestId('filters').textContent ?? '{}') as Record<string, unknown>;
const location = () => screen.getByTestId('location').textContent;
const openDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: /^savedSearches/ }));
  return screen.findByRole('dialog', { name: 'savedSearches' });
};

describe('SavedSearches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedSearchesService.list.mockResolvedValue(listOf([savedSearch(), savedSearch({ id: 5, name: 'Trips', diaryId: null, filters: noFilters })]));
  });

  it('lists the saved searches with what each one shows', async () => {
    renderSavedSearches();
    const dialog = await openDialog();

    const family = await within(dialog).findByRole('button', { name: 'Family' });
    expect(family).toHaveAccessibleDescription('Travel · family · 2019-07-14 · favorites');
    expect(within(dialog).getByRole('button', { name: 'Trips' })).toHaveAccessibleDescription('allDiaries · savedSearchNoFilters');
    expect(within(dialog).getByText('savedSearchCount 2 | 50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^savedSearches$/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows a saved search in one click, names it in the URL, and lets go of it when a filter changes', async () => {
    renderSavedSearches('?diary=all&entry=9');
    const dialog = await openDialog();

    fireEvent.click(await within(dialog).findByRole('button', { name: 'Family' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(filters()).toEqual(expect.objectContaining({
      filterTags: ['family'],
      date: new Date(2019, 6, 14).toDateString(),
      filterFavorites: true,
      page: 1,
    }));
    await waitFor(() => expect(location()).toBe('?diary=2&view=4'));
    const trigger = screen.getByRole('button', { name: 'savedSearchesShowing Family' });
    expect(trigger).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle favorites' }));

    await waitFor(() => expect(location()).toBe('?diary=2'));
    expect(screen.getByRole('button', { name: 'savedSearches' })).toBeInTheDocument();
  });

  it('restores and names the life era a search is narrowed to', async () => {
    savedSearchesService.list.mockResolvedValue(listOf([savedSearch({ id: 7, name: 'Uni', diaryId: null, filters: { ...noFilters, eraId: 3 } })]));
    renderSavedSearches();
    const dialog = await openDialog();

    const uni = await within(dialog).findByRole('button', { name: 'Uni' });
    expect(uni).toHaveAccessibleDescription('allDiaries · 🎓 University');
    fireEvent.click(uni);

    expect(filters()).toEqual(expect.objectContaining({ filterEraId: 3 }));
    await waitFor(() => expect(location()).toBe('?diary=all&view=7'));
  });

  it('applies the saved search a link names once the list has loaded', async () => {
    renderSavedSearches('?view=4');

    await waitFor(() => expect(filters()).toEqual(expect.objectContaining({ filterTags: ['family'], filterFavorites: true })));
    await waitFor(() => expect(location()).toBe('?view=4&diary=2'));
    expect(screen.getByRole('button', { name: 'savedSearchesShowing Family' })).toBeInTheDocument();
  });

  it('says so when a link names a saved search that is gone, and keeps the filters', async () => {
    const { notify } = renderSavedSearches('?diary=all&view=99');

    await waitFor(() => expect(notify).toHaveBeenCalledWith('savedSearchMissing'));
    await waitFor(() => expect(location()).toBe('?diary=all'));
    expect(filters()).toEqual(expect.objectContaining({ filterTags: [], filterFavorites: false }));
  });

  it('runs a saved meaning search once it is applied', async () => {
    savedSearchesService.list.mockResolvedValue(listOf([
      savedSearch({ id: 6, name: 'Calm', diaryId: null, filters: { ...noFilters, search: 'feeling calm', searchMode: 'semantic' } }),
    ]));
    const { onSemanticSearch } = renderSavedSearches();
    const dialog = await openDialog();

    fireEvent.click(await within(dialog).findByRole('button', { name: 'Calm' }));

    await waitFor(() => expect(onSemanticSearch).toHaveBeenCalledTimes(1));
    expect(filters()).toEqual(expect.objectContaining({ search: 'feeling calm', searchMode: 'semantic' }));
  });

  it('saves the current filters and diary under a trimmed name and names the new search in the URL', async () => {
    savedSearchesService.create.mockImplementation(async (draft) => {
      const created = savedSearch({ id: 7, ...draft });
      savedSearchesService.list.mockResolvedValue(listOf([savedSearch(), created]));
      return { data: created, error: null };
    });
    renderSavedSearches('?diary=1');
    fireEvent.click(screen.getByRole('button', { name: 'Type a search' }));
    const dialog = await openDialog();

    expect(await within(dialog).findByText('savedSearchWillSave Journal · savedSearchText morning')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('savedSearchName'), { target: { value: '  Mornings ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchSaveCurrent' }));

    await waitFor(() => expect(savedSearchesService.create).toHaveBeenCalledWith({
      name: 'Mornings',
      diaryId: 1,
      filters: { ...noFilters, search: 'morning' },
    }));
    expect(await within(dialog).findByRole('status')).toHaveTextContent('savedSearchSaved Mornings');
    await waitFor(() => expect(location()).toBe('?diary=1&view=7'));
    expect(within(dialog).getByLabelText('savedSearchName')).toHaveValue('');
  });

  it('asks for a name and shows why a save was refused', async () => {
    savedSearchesService.create.mockResolvedValue({ data: null, error: 'apiError_SAVED_SEARCH_NAME_TAKEN' });
    renderSavedSearches();
    const dialog = await openDialog();
    const name = await within(dialog).findByLabelText('savedSearchName');

    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchSaveCurrent' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('savedSearchNameRequired');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(savedSearchesService.create).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: 'Family' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchSaveCurrent' }));
    expect(await within(dialog).findByText('apiError_SAVED_SEARCH_NAME_TAKEN')).toHaveAttribute('role', 'alert');
  });

  it('stops saving at the limit', async () => {
    savedSearchesService.list.mockResolvedValue(listOf([savedSearch(), savedSearch({ id: 5, name: 'Trips' })], 2));
    renderSavedSearches();
    const dialog = await openDialog();

    expect(await within(dialog).findByText('savedSearchLimitReached 2')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'savedSearchSaveCurrent' })).toBeDisabled();
    expect(within(dialog).getByLabelText('savedSearchName')).toBeDisabled();
  });

  it('renames a search in place, shows a refusal, and returns focus when cancelled', async () => {
    savedSearchesService.rename
      .mockResolvedValueOnce({ data: null, error: 'apiError_SAVED_SEARCH_NAME_TAKEN' })
      .mockResolvedValueOnce({ data: savedSearch({ name: 'Family, 2019' }), error: null });
    renderSavedSearches();
    const dialog = await openDialog();

    fireEvent.click(await within(dialog).findByRole('button', { name: 'savedSearchRename Family' }));
    const input = within(dialog).getByRole('textbox', { name: 'savedSearchNewName Family' });
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchRenameSave' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('savedSearchNameRequired');

    fireEvent.change(input, { target: { value: 'Trips' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchRenameSave' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('apiError_SAVED_SEARCH_NAME_TAKEN');

    fireEvent.change(input, { target: { value: 'Family, 2019' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchRenameSave' }));
    await waitFor(() => expect(savedSearchesService.rename).toHaveBeenLastCalledWith(4, 'Family, 2019'));
    expect(await within(dialog).findByRole('status')).toHaveTextContent('savedSearchRenamed Family, 2019');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'savedSearchRename Family' })).toHaveFocus());

    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchRename Trips' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'savedSearchRename Trips' })).toHaveFocus());
    expect(savedSearchesService.rename).toHaveBeenCalledTimes(2);
  });

  it('deletes a search after confirming', async () => {
    savedSearchesService.remove.mockImplementation(async () => {
      savedSearchesService.list.mockResolvedValue(listOf([savedSearch({ id: 5, name: 'Trips' })]));
      return { data: { success: true }, error: null };
    });
    renderSavedSearches();
    const dialog = await openDialog();

    fireEvent.click(await within(dialog).findByRole('button', { name: 'savedSearchDelete Family' }));
    const confirm = screen.getByRole('alertdialog', { name: 'savedSearchDeleteTitle' });
    expect(confirm).toHaveAccessibleDescription('savedSearchDeleteMessage Family');
    fireEvent.click(within(confirm).getByRole('button', { name: 'delete' }));

    await waitFor(() => expect(savedSearchesService.remove).toHaveBeenCalledWith(4));
    expect(await within(dialog).findByRole('status')).toHaveTextContent('savedSearchDeleted Family');
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Family' })).not.toBeInTheDocument());
    await waitFor(() => expect(within(dialog).getByLabelText('savedSearchName')).toHaveFocus());
  });

  it('says how many book versions go with a search before deleting it', async () => {
    savedSearchesService.list.mockResolvedValue(listOf([
      savedSearch({ bookVersionCount: 2 }),
      savedSearch({ id: 5, name: 'Trips', bookVersionCount: 1 }),
    ]));
    savedSearchesService.remove.mockResolvedValue({ data: { success: true }, error: null });
    renderSavedSearches();
    const dialog = await openDialog();

    fireEvent.click(await within(dialog).findByRole('button', { name: 'savedSearchDelete Family' }));
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('savedSearchDeleteWithBooks_other Family | 2');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'cancel' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchDelete Trips' }));
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('savedSearchDeleteWithBooks_one Trips | 1');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'delete' }));
    await waitFor(() => expect(savedSearchesService.remove).toHaveBeenCalledWith(5));
  });

  it('says when a delete failed, and keeps a search when the confirmation is cancelled', async () => {
    savedSearchesService.remove.mockResolvedValue({ data: null, error: 'savedSearchDeleteFailed' });
    renderSavedSearches();
    const dialog = await openDialog();

    fireEvent.click(await within(dialog).findByRole('button', { name: 'savedSearchDelete Family' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'cancel' }));
    expect(savedSearchesService.remove).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'savedSearchDelete Family' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'delete' }));
    expect(await within(dialog).findByRole('status')).toHaveTextContent('savedSearchDeleteFailed');
  });

  it('offers to load the list again when it failed, and says when there is nothing saved yet', async () => {
    savedSearchesService.list.mockResolvedValueOnce({ data: null, error: 'savedSearchesLoadFailed' }).mockResolvedValue(listOf([]));
    renderSavedSearches();
    const dialog = await openDialog();

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('savedSearchesLoadFailed');
    fireEvent.click(within(dialog).getByRole('button', { name: 'tryAgain' }));
    expect(await within(dialog).findByText('savedSearchesEmpty')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
