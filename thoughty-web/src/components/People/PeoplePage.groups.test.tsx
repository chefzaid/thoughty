import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PeoplePage from './PeoplePage';
import type { Person } from '../../services/api';
import { getTranslation } from '../../utils/translations';

const person = (id: number, name: string, groups: string[] = []): Person => ({
  id, name, handles: [name.toLowerCase()], entryCount: 1, lastMentionedOn: null, dates: [], reachOutDays: null, lastContactOn: null,
  notes: null, groups, createdAt: '', updatedAt: '',
});

const peopleHook = vi.hoisted(() => ({
  people: [] as Person[],
  update: vi.fn(),
}));

vi.mock('./usePeople', () => ({
  usePeople: () => ({
    list: { isLoading: false, isError: false, isSuccess: true, data: { people: peopleHook.people, limit: 1000 } },
    people: peopleHook.people,
    update: peopleHook.update,
    merge: vi.fn(),
    remove: vi.fn(),
  }),
}));

const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
const marie = person(12, 'Marie', ['Friends', 'Climbing']);
const paul = person(14, 'Paul', ['friends']);
const ines = person(15, 'Ines');

function renderPage(t = en, theme: 'light' | 'dark' = 'light', language = 'en') {
  return render(<MemoryRouter><PeoplePage theme={theme} language={language} t={t} /></MemoryRouter>);
}

const rowOf = (name: string) => screen.getAllByRole('listitem').find((item) => within(item).queryByRole('link', { name }))!;

describe('PeoplePage groups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    peopleHook.people = [ines, marie, paul];
  });

  it('shows each person’s groups and narrows the list to one group, ignoring case', () => {
    renderPage();

    expect(within(within(rowOf('Marie')).getByRole('list', { name: 'Groups' })).getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(['Friends', 'Climbing']);
    expect(within(rowOf('Ines')).queryByRole('list', { name: 'Groups' })).toBeNull();
    const filter = screen.getByRole('combobox', { name: 'Group' });
    expect(within(filter).getAllByRole('option').map((option) => option.textContent)).toEqual(['Everyone', 'Climbing (1)', 'Friends (2)']);

    fireEvent.change(filter, { target: { value: 'friends' } });
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Marie', 'Paul']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), { target: { value: 'pa' } });
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Paul']);
    fireEvent.change(filter, { target: { value: '' } });
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Paul']);
  });

  it('shows everyone again once no one is left in the chosen group, and has no filter without groups', () => {
    const { rerender } = renderPage();
    fireEvent.change(screen.getByRole('combobox', { name: 'Group' }), { target: { value: 'climbing' } });
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Marie']);

    peopleHook.people = [ines, { ...marie, groups: ['Friends'] }, paul];
    rerender(<MemoryRouter><PeoplePage theme="light" language="en" t={en} /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: 'Group' })).toHaveValue('');
    expect(screen.getAllByRole('link')).toHaveLength(3);

    peopleHook.people = [ines];
    rerender(<MemoryRouter><PeoplePage theme="light" language="en" t={en} /></MemoryRouter>);
    expect(screen.queryByRole('combobox', { name: 'Group' })).toBeNull();
  });

  it('adds and removes groups in the editor, suggesting and spelling the writer’s other groups, and saves only a change', async () => {
    peopleHook.update.mockResolvedValue({ data: ines, error: null });
    renderPage(en, 'dark');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ines' }));
    expect(screen.getByText('Not in a group yet.')).toBeInTheDocument();
    const field = screen.getByRole('combobox', { name: 'Add to a group' });
    expect(field).toHaveAccessibleDescription(/Put Ines in groups of your own, like Friends, Family or Colleagues/);
    const suggestions = document.getElementById(field.getAttribute('list') ?? '')!;
    expect([...suggestions.querySelectorAll('option')].map((option) => option.value)).toEqual(['Climbing', 'Friends']);
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();

    fireEvent.change(field, { target: { value: '  FRIENDS ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('');
    fireEvent.change(field, { target: { value: 'Neighbours' } });
    fireEvent.click(add);
    fireEvent.change(field, { target: { value: 'friends' } });
    fireEvent.click(add);
    const chosen = within(screen.getByRole('button', { name: 'Save' }).closest('form')!).getByRole('list', { name: 'Groups' });
    expect(within(chosen).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Friends', 'Neighbours']);
    expect([...suggestions.querySelectorAll('option')].map((option) => option.value)).toEqual(['Climbing']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ines from Neighbours' }));
    // A group typed and not added yet is added on save
    fireEvent.change(field, { target: { value: 'Work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(peopleHook.update).toHaveBeenCalledWith(15, { name: 'Ines', groups: ['Friends', 'Work'] }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Marie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull());
    expect(peopleHook.update).toHaveBeenCalledTimes(1);
  });

  it('respells a group only the edited person is in, keeping the spelling of groups others are in', async () => {
    peopleHook.update.mockResolvedValue({ data: marie, error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Marie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Marie from Climbing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Marie from Friends' }));
    const field = screen.getByRole('combobox', { name: 'Add to a group' });
    for (const name of ['CLIMBING', 'FRIENDS']) {
      fireEvent.change(field, { target: { value: name } });
      fireEvent.keyDown(field, { key: 'Enter' });
    }
    fireEvent.keyDown(field, { key: 'a' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(peopleHook.update).toHaveBeenCalledWith(12, { name: 'Marie', groups: ['CLIMBING', 'Friends'] }));
  });

  it('stops adding at ten groups, and asks to remove some when a merge left more, in French', async () => {
    const many = Array.from({ length: 12 }, (_, index) => `Groupe ${index + 1}`);
    peopleHook.people = [{ ...marie, groups: many }];
    peopleHook.update.mockResolvedValue({ data: marie, error: null });
    renderPage(fr, 'dark', 'fr');

    fireEvent.click(screen.getByRole('button', { name: 'Modifier Marie' }));
    const field = screen.getByRole('combobox', { name: 'Ajouter à un groupe' });
    expect(field).toHaveAccessibleDescription(/Marie est dans 10 groupes, le maximum pour une personne\./);
    fireEvent.change(field, { target: { value: 'Voisins' } });
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.queryByText('Voisins')).toBeNull();
    fireEvent.change(field, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Marie de Groupe 12' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Une personne peut être dans 10 groupes au plus. Retirez-en pour enregistrer.');
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(peopleHook.update).not.toHaveBeenCalled();

    // Left as the merge joined them, they do not keep the writer from changing the name
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifier Marie' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom affiché pour @marie' }), { target: { value: 'Marie C' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(peopleHook.update).toHaveBeenCalledWith(12, { name: 'Marie C' }));
  });
});
