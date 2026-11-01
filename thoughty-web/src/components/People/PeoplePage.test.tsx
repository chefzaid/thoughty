import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PeoplePage from './PeoplePage';
import type { Person } from '../../services/api';
import { getTranslation } from '../../utils/translations';

const person = (id: number, name: string, handles: string[], entryCount: number, lastMentionedOn: string | null = null, date: Person['date'] = null): Person => ({
  id, name, handles, entryCount, lastMentionedOn, date, createdAt: '', updatedAt: '',
});

const peopleHook = vi.hoisted(() => ({
  state: { people: [] as Person[], isLoading: false, isError: false, isSuccess: true },
  update: vi.fn(),
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
    update: peopleHook.update,
    merge: peopleHook.merge,
    remove: peopleHook.remove,
  }),
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const marie = person(12, 'Marie', ['marie'], 3, '2026-10-20');
const marieC = person(14, 'MarieC', ['mariec'], 1);
const paul = person(15, 'Paul', ['paul'], 0, null, { kind: 'anniversary', month: 2, day: 29, year: null });

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
    expect(items[2]).toHaveTextContent('Anniversary: February 29');
    expect(items[0]).not.toHaveTextContent('Birthday');
  });

  it('gives a person a birthday with its year, checking the month, day and year before saving', async () => {
    peopleHook.update
      .mockResolvedValueOnce({ data: null, error: 'apiError_PERSON_DATE_IN_FUTURE' })
      .mockResolvedValueOnce({ data: marie, error: null });
    renderPage('light');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Marie' }));
    const group = screen.getByRole('group', { name: 'Birthday or anniversary' });
    expect(group).toHaveAccessibleDescription(/Highlights shows Marie on this day each year/);
    expect(within(group).queryByRole('combobox', { name: 'Month' })).not.toBeInTheDocument();
    fireEvent.change(within(group).getByRole('combobox', { name: 'Date' }), { target: { value: 'birthday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose the month and the day.');
    expect(group).toHaveAccessibleDescription(/Choose the month and the day/);
    expect(within(group).getByRole('combobox', { name: 'Date' })).toHaveFocus();

    // The days follow the month: 29 in February, and a day the new month lacks is cleared
    fireEvent.change(within(group).getByRole('combobox', { name: 'Month' }), { target: { value: '1' } });
    fireEvent.change(within(group).getByRole('combobox', { name: 'Day' }), { target: { value: '31' } });
    fireEvent.change(within(group).getByRole('combobox', { name: 'Month' }), { target: { value: '2' } });
    expect(within(group).getByRole('combobox', { name: 'Day' })).toHaveValue('');
    expect(within(within(group).getByRole('combobox', { name: 'Day' })).getAllByRole('option')).toHaveLength(30);
    fireEvent.change(within(group).getByRole('combobox', { name: 'Day' }), { target: { value: '14' } });
    const year = within(group).getByRole('textbox', { name: 'Year (optional)' });
    expect(year).toHaveAccessibleDescription('Leave it empty if you do not know the year.');
    fireEvent.change(year, { target: { value: '92' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write the year with four digits, from 1000.');
    expect(peopleHook.update).not.toHaveBeenCalled();

    fireEvent.change(year, { target: { value: '2092' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('With its year, the date cannot be in the future.');
    expect(within(group).getByRole('combobox', { name: 'Date' })).toHaveFocus();
    fireEvent.change(year, { target: { value: '1992' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());
    expect(peopleHook.update).toHaveBeenLastCalledWith(12, { name: 'Marie', date: { kind: 'birthday', month: 2, day: 14, year: 1992 } });
    expect(screen.getByRole('status')).toHaveTextContent('Saved for Marie.');
    expect(screen.getByRole('button', { name: 'Edit Marie' })).toBeInTheDocument();
  });

  it('removes a date by choosing None, in French', async () => {
    peopleHook.update.mockResolvedValueOnce({ data: { ...paul, date: null }, error: null });
    const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
    render(<MemoryRouter><PeoplePage language="fr" t={fr} /></MemoryRouter>);

    expect(screen.getByText('Date anniversaire : 29 février')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier Paul' }));
    const group = screen.getByRole('group', { name: 'Anniversaire ou date anniversaire' });
    expect(within(group).getByRole('combobox', { name: 'Mois' })).toHaveDisplayValue('février');
    fireEvent.change(within(group).getByRole('combobox', { name: 'Date' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(peopleHook.update).toHaveBeenCalledWith(15, { name: 'Paul', date: null }));
  });

  it('finds people by name or handle', () => {
    renderPage('light');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), { target: { value: 'MARIEC' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), { target: { value: 'nobody' } });
    expect(screen.getByText('No one matches this search.')).toBeInTheDocument();
  });

  it('renames the name shown in place, refusing an empty name and showing a refused save', async () => {
    peopleHook.update
      .mockResolvedValueOnce({ data: null, error: 'apiError_PERSON_NOT_FOUND' })
      .mockResolvedValueOnce({ data: { ...marie, name: 'Marie Curie' }, error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Marie' }));
    const field = screen.getByRole('textbox', { name: 'Name shown for @marie' });
    fireEvent.change(field, { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
    expect(peopleHook.update).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: ' Marie Curie ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This person no longer exists.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('textbox', { name: /Name shown/ })).not.toBeInTheDocument());
    expect(peopleHook.update).toHaveBeenLastCalledWith(12, { name: 'Marie Curie' });
    expect(screen.getByRole('status')).toHaveTextContent('Renamed to Marie Curie.');
  });

  it('leaves the name alone when it is unchanged, and cancels with Escape', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Paul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /Name shown/ })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Paul' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name shown for @paul' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: /Name shown/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Paul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(peopleHook.update).not.toHaveBeenCalled();
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
