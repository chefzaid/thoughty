import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PeoplePage from './PeoplePage';
import type { Person } from '../../services/api';
import { getTranslation } from '../../utils/translations';

const person = (id: number, name: string, handles: string[], entryCount: number, lastMentionedOn: string | null = null): Person => ({
  id, name, handles, entryCount, lastMentionedOn, createdAt: '', updatedAt: '',
});

const peopleHook = vi.hoisted(() => ({
  state: { people: [] as Person[], isLoading: false, isError: false, isSuccess: true },
  rename: vi.fn(),
  merge: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('./usePeople', () => ({
  usePeople: () => ({
    list: {
      isLoading: peopleHook.state.isLoading,
      isError: peopleHook.state.isError,
      isSuccess: peopleHook.state.isSuccess,
      data: peopleHook.state.isSuccess ? { people: peopleHook.state.people, limit: 1000 } : undefined,
    },
    people: peopleHook.state.people,
    rename: peopleHook.rename,
    merge: peopleHook.merge,
    remove: peopleHook.remove,
  }),
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const marie = person(12, 'Marie', ['marie'], 3, '2026-10-20');
const marieC = person(14, 'MarieC', ['mariec'], 1);
const paul = person(15, 'Paul', ['paul'], 0);

function renderPage(theme: 'light' | 'dark' = 'dark', language = 'en') {
  render(<MemoryRouter><PeoplePage theme={theme} language={language} t={t} /></MemoryRouter>);
}

describe('PeoplePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    peopleHook.state = { people: [marie, marieC, paul], isLoading: false, isError: false, isSuccess: true };
  });

  it('lists each person with their handles, counts and a link to their entries', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'People' })).toBeInTheDocument();
    expect(screen.getByText('People: 3 of 1000')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: '3 people' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByRole('link', { name: 'Marie' })).toHaveAttribute('href', '/journal?diary=all&person=12');
    expect(items[0]).toHaveTextContent('@marie');
    expect(items[0]).toHaveTextContent('3 entries · last mentioned Oct 20, 2026');
    expect(items[2]).toHaveTextContent('0 entries');
  });

  it('finds people by name or handle', () => {
    renderPage('light');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), { target: { value: 'MARIEC' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), { target: { value: 'nobody' } });
    expect(screen.getByText('No one matches this search.')).toBeInTheDocument();
  });

  it('renames the name shown in place, refusing an empty name and showing a refused save', async () => {
    peopleHook.rename
      .mockResolvedValueOnce({ data: null, error: 'apiError_PERSON_NOT_FOUND' })
      .mockResolvedValueOnce({ data: { ...marie, name: 'Marie Curie' }, error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Rename Marie' }));
    const field = screen.getByRole('textbox', { name: 'Name shown for @marie' });
    fireEvent.change(field, { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
    expect(peopleHook.rename).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: ' Marie Curie ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This person no longer exists.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('textbox', { name: /Name shown/ })).not.toBeInTheDocument());
    expect(peopleHook.rename).toHaveBeenLastCalledWith(12, 'Marie Curie');
    expect(screen.getByRole('status')).toHaveTextContent('Renamed to Marie Curie.');
  });

  it('leaves the name alone when it is unchanged, and cancels with Escape', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Rename Paul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /Name shown/ })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Rename Paul' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name shown for @paul' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: /Name shown/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Paul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(peopleHook.rename).not.toHaveBeenCalled();
  });

  it('merges a duplicate chosen in a dialog that explains what merging does', async () => {
    peopleHook.merge
      .mockResolvedValueOnce({ data: null, error: 'personMergeFailed' })
      .mockResolvedValueOnce({ data: { ...marie, handles: ['marie', 'mariec'] }, error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Merge someone into Marie' }));
    const dialog = screen.getByRole('dialog', { name: 'Merge into Marie' });
    expect(dialog).toHaveAccessibleDescription(/their handles then mention Marie/);
    const choice = within(dialog).getByRole('combobox', { name: 'Person to merge' });
    expect(within(choice).getAllByRole('option').map((option) => option.textContent)).toEqual(['MarieC (@mariec)', 'Paul (@paul)']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('These people could not be merged.');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(peopleHook.merge).toHaveBeenLastCalledWith(12, 14);
    expect(screen.getByRole('status')).toHaveTextContent('MarieC was merged into Marie.');

    fireEvent.click(screen.getByRole('button', { name: 'Merge someone into Paul' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes a person after a confirmation that the text stays', async () => {
    peopleHook.remove.mockResolvedValueOnce({ data: { success: true }, error: null }).mockResolvedValueOnce({ data: null, error: 'personDeleteFailed' });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Paul' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete Paul?' });
    expect(confirm).toHaveTextContent('Your entries keep the text @paul');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Paul was deleted.'));
    expect(peopleHook.remove).toHaveBeenCalledWith(15);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Marie' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('This person could not be deleted.'));
  });

  it('offers no merge with a single person, and says when there is no one or the list failed', () => {
    peopleHook.state = { people: [marie], isLoading: false, isError: false, isSuccess: true };
    const { unmount } = render(<MemoryRouter><PeoplePage t={t} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /Merge/ })).not.toBeInTheDocument();
    unmount();

    peopleHook.state = { people: [], isLoading: false, isError: false, isSuccess: true };
    const empty = render(<MemoryRouter><PeoplePage t={t} /></MemoryRouter>);
    expect(screen.getByText(/No one yet/)).toBeInTheDocument();
    empty.unmount();

    peopleHook.state = { people: [], isLoading: true, isError: false, isSuccess: false };
    const loading = render(<MemoryRouter><PeoplePage t={t} /></MemoryRouter>);
    expect(screen.getByText('Loading your people…')).toBeInTheDocument();
    loading.unmount();

    peopleHook.state = { people: [], isLoading: false, isError: true, isSuccess: false };
    render(<MemoryRouter><PeoplePage t={t} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Your people could not be loaded.');
  });
});
