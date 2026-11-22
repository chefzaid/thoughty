import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PeoplePage from './PeoplePage';
import type { Person } from '../../services/api';
import { getTranslation } from '../../utils/translations';

type PersonDate = Person['dates'][number];

const person = (id: number, name: string, dates: PersonDate[] = []): Person => ({
  id, name, handles: [name.toLowerCase()], entryCount: 1, lastMentionedOn: null, dates, reachOutDays: null, lastContactOn: null,
  notes: null, groups: [], createdAt: '', updatedAt: '',
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
const birthday: PersonDate = { kind: 'birthday', label: null, month: 3, day: 14, year: 1992 };
const wedding: PersonDate = { kind: 'anniversary', label: 'Wedding', month: 6, day: 2, year: 2012 };
const marie = person(12, 'Marie');
const paul = person(14, 'Paul', [birthday, wedding]);
const anniversaries = (count: number) => Array.from({ length: count }, (_, index): PersonDate => ({ ...wedding, label: null, day: index + 1 }));

function renderPage(t = en, language = 'en') {
  return render(<MemoryRouter><PeoplePage theme="light" language={language} t={t} /></MemoryRouter>);
}

const rowOf = (name: string) => screen.getAllByRole('listitem').find((item) => within(item).queryByRole('link', { name }))!;
const datesGroup = () => screen.getByRole('group', { name: 'Important dates' });
const dateGroup = (number: number) => within(datesGroup()).getByRole('group', { name: `Date ${number}` });
const choose = (group: HTMLElement, name: string, value: string) =>
  fireEvent.change(within(group).getByRole(name.startsWith('Year') || name.startsWith('What') ? 'textbox' : 'combobox', { name }), { target: { value } });

describe('PeoplePage important dates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 22, 10));
    peopleHook.people = [marie, paul];
  });
  afterEach(() => vi.useRealTimers());

  it('shows each of a person’s dates on their row, with what it marks', () => {
    renderPage();

    expect(rowOf('Paul')).toHaveTextContent('Birthday: March 14, 1992 · Anniversary (Wedding): June 2, 2012');
    expect(rowOf('Marie')).not.toHaveTextContent('Birthday');
  });

  it('adds a birthday, then an anniversary with what it marks, checking each date before saving', async () => {
    peopleHook.update
      .mockResolvedValueOnce({ data: null, error: 'apiError_PERSON_DATE_IN_FUTURE' })
      .mockResolvedValueOnce({ data: marie, error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Marie' }));
    expect(datesGroup()).toHaveAccessibleDescription(/Highlights shows Marie on each of these days every year/);
    expect(within(datesGroup()).getByText('No date yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    // A new date is the birthday while there is none, and takes the focus
    expect(within(dateGroup(1)).getByRole('combobox', { name: 'Kind' })).toHaveValue('birthday');
    expect(within(dateGroup(1)).getByRole('combobox', { name: 'Kind' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    const second = within(dateGroup(2)).getByRole('combobox', { name: 'Kind' });
    expect(second).toHaveValue('anniversary');
    expect(within(second).getByRole('option', { name: 'Birthday' })).toBeDisabled();

    choose(dateGroup(1), 'Month', '3');
    choose(dateGroup(1), 'Day', '14');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose the month and the day.');
    expect(dateGroup(2)).toHaveAccessibleDescription('Choose the month and the day.');
    expect(second).toHaveFocus();

    // The days follow the month: 29 in February, and a day the new month lacks is cleared
    choose(dateGroup(2), 'Month', '1');
    choose(dateGroup(2), 'Day', '31');
    choose(dateGroup(2), 'Month', '2');
    expect(within(dateGroup(2)).getByRole('combobox', { name: 'Day' })).toHaveValue('');
    expect(within(within(dateGroup(2)).getByRole('combobox', { name: 'Day' })).getAllByRole('option')).toHaveLength(30);
    choose(dateGroup(2), 'Day', '29');
    choose(dateGroup(2), 'What it marks (optional)', '  Wedding ');
    choose(dateGroup(2), 'Year (optional)', '2001');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This day does not exist in that month (29 February only in a leap year).');
    choose(dateGroup(2), 'Year (optional)', '2000');
    choose(dateGroup(1), 'Year (optional)', '92');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write the year with four digits, from 1000.');
    expect(within(dateGroup(1)).getByRole('combobox', { name: 'Kind' })).toHaveFocus();
    choose(dateGroup(1), 'Year (optional)', '2027');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('With its year, the date cannot be in the future.');
    expect(peopleHook.update).not.toHaveBeenCalled();

    // The API refuses on the latest day on Earth: the first date takes the focus
    choose(dateGroup(1), 'Year (optional)', '2026');
    choose(dateGroup(1), 'Month', '11');
    choose(dateGroup(1), 'Day', '22');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('With its year, the date cannot be in the future.');
    expect(within(dateGroup(1)).getByRole('combobox', { name: 'Kind' })).toHaveFocus();
    choose(dateGroup(1), 'Year (optional)', '1992');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());
    expect(peopleHook.update).toHaveBeenLastCalledWith(12, {
      name: 'Marie',
      dates: [
        { kind: 'birthday', label: null, month: 11, day: 22, year: 1992 },
        { kind: 'anniversary', label: 'Wedding', month: 2, day: 29, year: 2000 },
      ],
    });
    expect(screen.getByRole('status')).toHaveTextContent('Saved for Marie.');
  });

  it('removes a date, moving the focus to Add a date, and sends the dates only when they changed', async () => {
    peopleHook.update.mockResolvedValue({ data: paul, error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Paul' }));
    expect(within(dateGroup(1)).getByRole('combobox', { name: 'Month' })).toHaveDisplayValue('March');
    expect(within(dateGroup(2)).getByRole('textbox', { name: 'What it marks (optional)' })).toHaveValue('Wedding');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());
    expect(peopleHook.update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Paul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove date 1' }));
    expect(screen.getByRole('button', { name: 'Add a date' })).toHaveFocus();
    // The anniversary left can now be the birthday
    expect(within(within(dateGroup(1)).getByRole('combobox', { name: 'Kind' })).getByRole('option', { name: 'Birthday' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(peopleHook.update).toHaveBeenLastCalledWith(14, { name: 'Paul', dates: [wedding] }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Paul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove date 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove date 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(peopleHook.update).toHaveBeenLastCalledWith(14, { name: 'Paul', dates: [] }));
  });

  it('keeps at most ten dates, and dates a merge joined past that until they change', async () => {
    peopleHook.people = [person(12, 'Marie', anniversaries(10)), person(14, 'Paul', anniversaries(11))];
    peopleHook.update.mockResolvedValue({ data: marie, error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Marie' }));
    expect(screen.getByRole('button', { name: 'Add a date' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add a date' })).toHaveAccessibleDescription('Marie has 10 dates, the most you can keep.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Paul' }));
    choose(dateGroup(11), 'What it marks (optional)', 'First met');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Keep at most 10 dates.');
    expect(within(dateGroup(11)).getByRole('combobox', { name: 'Kind' })).toHaveFocus();
    expect(peopleHook.update).not.toHaveBeenCalled();
    // Removing one leaves ten, Add a date still unavailable: the last date takes the focus
    fireEvent.click(screen.getByRole('button', { name: 'Remove date 1' }));
    expect(within(dateGroup(10)).getByRole('combobox', { name: 'Kind' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(peopleHook.update).toHaveBeenCalledWith(14, expect.objectContaining({ dates: expect.any(Array) })));
    expect(peopleHook.update.mock.calls[0]?.[1].dates).toHaveLength(10);
  });

  it('speaks French', () => {
    renderPage(fr, 'fr');

    expect(rowOf('Paul')).toHaveTextContent('Anniversaire : 14 mars 1992 · Date anniversaire (Wedding) : 2 juin 2012');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier Paul' }));
    const dates = screen.getByRole('group', { name: 'Dates importantes' });
    expect(within(dates).getByRole('group', { name: 'Date 2' })).toBeInTheDocument();
    expect(within(dates).getByRole('button', { name: 'Retirer la date 1' })).toBeInTheDocument();
    expect(within(dates).getByRole('button', { name: 'Ajouter une date' })).toBeInTheDocument();
    expect(within(dates).getAllByRole('combobox', { name: 'Type' })[1]).toHaveDisplayValue('Date anniversaire');
  });
});
