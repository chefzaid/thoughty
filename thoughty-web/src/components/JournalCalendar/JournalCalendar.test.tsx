import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntryCalendarItem } from '../../services/api';
import { createTestQueryClient } from '../../test/queryClient';
import type { CalendarMonth } from '../../utils/calendarMonth';
import { getTranslation } from '../../utils/translations';
import JournalCalendar from './JournalCalendar';

const calendarService = vi.hoisted(() => ({ fetchMonth: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => calendarService,
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const FILTERS = {
  search: '', tags: [], visibility: 'all', favorites: false, archiveStatus: 'active', mood: '', diaryId: null, entryIds: null,
} as const;

const item = (overrides: Partial<EntryCalendarItem>): EntryCalendarItem => ({
  id: 1, diary_id: 1, date: '2026-10-20', index: 1, time_of_day: null, title: null, snippet: 'Text', mood: null, ...overrides,
});

const OCTOBER: EntryCalendarItem[] = [
  item({ id: 1, index: 1, snippet: 'Errands in town' }),
  item({ id: 2, index: 2, title: 'Harbor run', time_of_day: '07:30', mood: 4 }),
  item({ id: 3, index: 3, snippet: '' }),
  item({ id: 4, index: 4, snippet: 'Late tea' }),
  item({ id: 5, date: '2026-10-05', snippet: 'Quiet Monday' }),
];

interface HarnessProps {
  readonly initialMonth?: CalendarMonth | null;
  readonly selectedDate?: string | null;
  readonly onMonthChange?: (month: CalendarMonth) => void;
  readonly onOpenDay?: (date: string) => void;
  readonly onOpenEntry?: (entry: EntryCalendarItem) => void;
  readonly theme?: 'light' | 'dark';
}

function Harness({ initialMonth = null, selectedDate = null, onMonthChange, onOpenDay = vi.fn(), onOpenEntry = vi.fn(), theme = 'dark' }: HarnessProps) {
  const [month, setMonth] = useState<CalendarMonth | null>(initialMonth);
  return (
    <JournalCalendar
      month={month}
      onMonthChange={(next) => { setMonth(next); onMonthChange?.(next); }}
      filters={FILTERS}
      selectedDate={selectedDate}
      availableYears={[2026, 2019]}
      onOpenDay={onOpenDay}
      onOpenEntry={onOpenEntry}
      language="en"
      theme={theme}
      t={t}
    />
  );
}

function renderCalendar(props: HarnessProps = {}) {
  const client = createTestQueryClient();
  const view = render(<QueryClientProvider client={client}><Harness {...props} /></QueryClientProvider>);
  return {
    ...view,
    rerenderWith: (next: HarnessProps) => view.rerender(<QueryClientProvider client={client}><Harness {...next} /></QueryClientProvider>),
  };
}

const cell = (name: string | RegExp) => screen.getByRole('gridcell', { name });

describe('JournalCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 9, 0));
    calendarService.fetchMonth.mockImplementation(async ({ month }: { month: string }) => ({
      data: { month, entries: month === '2026-10' ? OCTOBER : [] },
      error: null,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows this month's days from Monday with their entries, today marked", async () => {
    renderCalendar();

    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'MonMonday', 'TueTuesday', 'WedWednesday', 'ThuThursday', 'FriFriday', 'SatSaturday', 'SunSunday',
    ]);
    const busy = await screen.findByRole('gridcell', { name: 'Tuesday, October 20, 2026: 4 entries' });
    expect(within(busy).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Open Errands in town',
      'Open 07:30 Harbor run, mood: Good',
      'Open Entry 3',
    ]);
    expect(within(busy).getByText('+1')).toBeInTheDocument();
    expect(cell('Monday, October 5, 2026: 1 entry')).toBeInTheDocument();

    const today = cell('Wednesday, October 21, 2026: 0 entries, today');
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAttribute('tabindex', '0');
    expect(busy).toHaveAttribute('tabindex', '-1');
    expect(calendarService.fetchMonth).toHaveBeenCalledWith({ ...FILTERS, month: '2026-10' });
  });

  it("opens on the date filter's month with that day selected and focusable", async () => {
    renderCalendar({ selectedDate: '2019-07-14', theme: 'light' });

    expect(screen.getByRole('grid', { name: 'July 2019' })).toBeInTheDocument();
    const selected = cell(/July 14, 2019/);
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(await screen.findByText('No entries this month match the filters.')).toBeInTheDocument();
  });

  it('moves the focus with the keyboard and changes month past the edges', async () => {
    const onMonthChange = vi.fn();
    renderCalendar({ onMonthChange });
    const grid = screen.getByRole('grid');

    fireEvent.keyDown(cell(/October 21/), { key: 'ArrowLeft' });
    expect(cell(/October 20/)).toHaveFocus();
    fireEvent.keyDown(cell(/October 20/), { key: 'End' });
    expect(cell(/October 25/)).toHaveFocus();
    fireEvent.keyDown(cell(/October 25/), { key: 'PageDown' });
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 11 });
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
    expect(cell(/November 25/)).toHaveFocus();
    fireEvent.keyDown(cell(/November 25/), { key: 'PageUp', shiftKey: true });
    expect(cell(/November 25, 2025/)).toHaveFocus();

    // Keys with a modifier, keys the grid does not use, and keys from elsewhere are left alone
    fireEvent.keyDown(cell(/November 25, 2025/), { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(cell(/November 25, 2025/), { key: 'a' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(cell(/November 25, 2025/)).toHaveFocus();
    expect(onMonthChange).toHaveBeenCalledTimes(2);
  });

  it('opens a day with Enter, Space, or a click, and an entry with a click', async () => {
    const onOpenDay = vi.fn();
    const onOpenEntry = vi.fn();
    renderCalendar({ onOpenDay, onOpenEntry });

    fireEvent.keyDown(cell(/October 21/), { key: 'Enter' });
    fireEvent.keyDown(cell(/October 21/), { key: ' ' });
    fireEvent.click(cell(/October 6/));
    expect(onOpenDay.mock.calls).toEqual([['2026-10-21'], ['2026-10-21'], ['2026-10-06']]);

    fireEvent.click(await screen.findByRole('button', { name: 'Open Quiet Monday' }));
    expect(onOpenEntry).toHaveBeenCalledWith(OCTOBER[4]);
    expect(onOpenDay).toHaveBeenCalledTimes(3);
  });

  it('moves by month and year, jumps to a year, and comes back to today', async () => {
    const onMonthChange = vi.fn();
    renderCalendar({ onMonthChange });

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(screen.getByRole('grid', { name: 'November 2025' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument();

    const years = screen.getByRole('combobox', { name: 'Go to year' });
    expect(within(years).getAllByRole('option').map((option) => option.textContent)).toEqual(['2026', '2019']);
    fireEvent.change(years, { target: { value: '2019' } });
    expect(screen.getByRole('grid', { name: 'October 2019' })).toBeInTheDocument();
    expect(cell(/October 21, 2019/)).toHaveAttribute('tabindex', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument();
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2026, month: 10 });
    await waitFor(() => expect(calendarService.fetchMonth).toHaveBeenCalledWith(expect.objectContaining({ month: '2019-10' })));
  });

  it('follows a date picked in the filter bar', () => {
    const onMonthChange = vi.fn();
    const initialMonth = { year: 2026, month: 10 };
    const { rerenderWith } = renderCalendar({ initialMonth, onMonthChange });

    rerenderWith({ initialMonth, onMonthChange, selectedDate: '2026-10-03' });
    expect(onMonthChange).not.toHaveBeenCalled();
    expect(cell(/October 3, 2026/)).toHaveAttribute('tabindex', '0');

    rerenderWith({ initialMonth, onMonthChange, selectedDate: '2024-02-29' });
    expect(onMonthChange).toHaveBeenCalledWith({ year: 2024, month: 2 });
    expect(screen.getByRole('grid', { name: 'February 2024' })).toBeInTheDocument();

    rerenderWith({ initialMonth, onMonthChange, selectedDate: null });
    expect(screen.getByRole('grid', { name: 'February 2024' })).toBeInTheDocument();
  });

  it('says when the month could not be loaded and tries again', async () => {
    calendarService.fetchMonth.mockResolvedValueOnce({ data: null, error: 'calendarLoadFailed' });
    renderCalendar();

    expect(await screen.findByRole('alert')).toHaveTextContent('The month could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('gridcell', { name: 'Tuesday, October 20, 2026: 4 entries' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
