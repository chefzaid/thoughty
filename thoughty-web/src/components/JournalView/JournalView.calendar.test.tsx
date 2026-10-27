import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type JournalCalendar from '../JournalCalendar/JournalCalendar';
import JournalView from './JournalView';
import { createProps, lifeEraListMock, type JournalViewProps } from './JournalView.test-helpers';

vi.mock('../DiaryTabs/DiaryTabs', async () => ({ default: (await import('./JournalView.test-helpers')).MockDiaryTabs }));
vi.mock('../ThoughtOfTheDay/ThoughtOfTheDay', async () => ({ default: (await import('./JournalView.test-helpers')).MockThoughtOfTheDay }));
vi.mock('../WritingStreak/WritingStreakCard', async () => ({ default: (await import('./JournalView.test-helpers')).MockWritingStreakCard }));
vi.mock('../EntryForm/EntryForm', async () => ({ default: (await import('./JournalView.test-helpers')).MockEntryForm }));
vi.mock('../FilterControls/FilterControls', async () => ({ default: (await import('./JournalView.test-helpers')).MockFilterControls }));
vi.mock('../EntriesList/EntriesList', async () => ({ default: (await import('./JournalView.test-helpers')).MockEntriesList }));
vi.mock('../Pagination/Pagination', async () => ({ default: (await import('./JournalView.test-helpers')).MockPagination }));
vi.mock('../YearMonthNavigator/YearMonthNavigator', async () => ({ default: (await import('./JournalView.test-helpers')).MockYearMonthNavigator }));
vi.mock('../BackToTopButton/BackToTopButton', async () => ({ default: (await import('./JournalView.test-helpers')).MockBackToTopButton }));
vi.mock('../DuplicateReview/DuplicateReview', async () => ({ default: (await import('./JournalView.test-helpers')).MockDuplicateReview }));
vi.mock('../SavedSearches/SavedSearches', async () => ({ default: (await import('./JournalView.test-helpers')).MockSavedSearches }));
vi.mock('../LifeEras/useLifeEras', async () => ({ useLifeEraList: (await import('./JournalView.test-helpers')).mockUseLifeEraList }));
vi.mock('../People/usePeople', async () => ({ usePeopleList: (await import('./JournalView.test-helpers')).mockUsePeopleList }));

type CalendarProps = ComponentProps<typeof JournalCalendar>;
const calendarProps = vi.hoisted(() => ({ current: null as CalendarProps | null }));
vi.mock('../JournalCalendar/JournalCalendar', () => ({
  default: (props: CalendarProps) => {
    calendarProps.current = props;
    return <div data-testid="journal-calendar">{props.month ? `${props.month.year}-${props.month.month}` : 'default month'}</div>;
  },
}));

function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderJournal(props: JournalViewProps, search = '?diary=1') {
  render(
    <MemoryRouter initialEntries={[`/journal${search}`]}>
      <JournalView {...props} />
      <Location />
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId('location').textContent;
const calendar = () => calendarProps.current!;

describe('JournalView calendar layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarProps.current = null;
  });

  it('switches between the list and the calendar, keeping the layout in the URL', () => {
    renderJournal(createProps());

    expect(screen.getByRole('button', { name: 'journalLayoutList' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('entries-list')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'journalLayout' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'journalLayoutCalendar' }));
    expect(location()).toBe('?diary=1&layout=calendar');
    expect(screen.getByTestId('journal-calendar')).toHaveTextContent('default month');
    expect(screen.queryByTestId('entries-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    expect(screen.queryByTestId('year-month-navigator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('back-to-top')).not.toBeInTheDocument();

    // Pressing the shown layout again changes nothing
    fireEvent.click(screen.getByRole('button', { name: 'journalLayoutCalendar' }));
    expect(location()).toBe('?diary=1&layout=calendar');

    fireEvent.click(screen.getByRole('button', { name: 'journalLayoutList' }));
    expect(location()).toBe('?diary=1');
    expect(screen.getByTestId('entries-list')).toBeInTheDocument();
  });

  it('opens a calendar link on its month and moves between months in place', () => {
    renderJournal(createProps(), '?diary=1&layout=calendar&month=2019-07');
    expect(screen.getByTestId('journal-calendar')).toHaveTextContent('2019-7');

    act(() => calendar().onMonthChange({ year: 2020, month: 1 }));
    expect(screen.getByTestId('journal-calendar')).toHaveTextContent('2020-1');
    expect(location()).toBe('?diary=1&layout=calendar&month=2020-01');
  });

  it('ignores a month that is not one and drops a permalink when the calendar opens', () => {
    renderJournal(createProps(), '?diary=all&entry=7&month=2019-13');

    fireEvent.click(screen.getByRole('button', { name: 'journalLayoutCalendar' }));
    expect(location()).toBe('?diary=all&month=2019-13&layout=calendar');
    expect(screen.getByTestId('journal-calendar')).toHaveTextContent('default month');
  });

  it('reads the month with the diary and the filters, a meaning search by its matches', () => {
    const props = createProps({
      diaryTabs: { currentDiaryId: 2 },
      filters: {
        search: 'harbor', filterTags: ['sea'], filterVisibility: 'public', filterFavorites: true,
        filterArchiveStatus: 'all', filterMood: '4,5', filterDateObj: new Date(2026, 9, 20),
      },
      yearMonthNavigator: { availableYears: [2026, 2024] },
    });
    renderJournal(props, '?diary=2&layout=calendar');

    expect(calendar().filters).toEqual({
      search: 'harbor', tags: ['sea'], visibility: 'public', favorites: true, archiveStatus: 'all',
      mood: '4,5', eraId: null, personId: null, diaryId: 2, entryIds: null,
    });
    expect(calendar().era).toBeNull();
    expect(calendar().selectedDate).toBe('2026-10-20');
    expect(calendar().availableYears).toEqual([2026, 2024]);
    expect(calendar().language).toBe('en');
    expect(calendar().theme).toBe('dark');
  });

  it('narrows the month to the life era of the filter and names it', () => {
    const university = {
      id: 3, name: 'University', emoji: null, color: null, note: null,
      startDate: '2010-09-01', endDate: '2014-06-30', createdAt: '', updatedAt: '',
    };
    lifeEraListMock.eras = [university];
    renderJournal(createProps({ filters: { filterEraId: 3 } }), '?diary=1&layout=calendar');
    lifeEraListMock.eras = [];

    expect(calendar().filters).toMatchObject({ eraId: 3 });
    expect(calendar().era).toEqual(university);
  });

  it('stops narrowing to an era that no longer exists once the eras have loaded', () => {
    const setFilterEraId = vi.fn();
    lifeEraListMock.eras = [];
    renderJournal(createProps({ filters: { filterEraId: 7, setFilterEraId } }), '?diary=1&layout=calendar');
    expect(setFilterEraId).not.toHaveBeenCalled();

    lifeEraListMock.loaded = true;
    renderJournal(createProps({ filters: { filterEraId: 7, setFilterEraId } }), '?diary=1&layout=calendar');
    lifeEraListMock.loaded = false;
    expect(setFilterEraId).toHaveBeenCalledWith(null);
  });

  it('narrows a meaning search to its matches once it has run', () => {
    const semanticSearchResult = { matches: [{ entryId: 9 }, { entryId: 3 }], analyzedEntries: 20, truncated: false };
    renderJournal(createProps({
      filters: { search: 'calm days', searchMode: 'semantic', semanticSearchResult: semanticSearchResult as never },
    }), '?diary=1&layout=calendar');
    expect(calendar().filters).toMatchObject({ search: '', entryIds: [9, 3] });
  });

  it('shows a day in the list as the date filter, and an entry through its permalink', () => {
    const props = createProps();
    renderJournal(props, '?diary=1&layout=calendar&month=2026-10');

    act(() => calendar().onOpenDay('2026-10-20'));
    expect(props.filters.setFilterDateObj).toHaveBeenCalledWith(new Date(2026, 9, 20));
    expect(props.filters.setPage).toHaveBeenCalledWith(1);
    expect(location()).toBe('?diary=1');

    fireEvent.click(screen.getByRole('button', { name: 'journalLayoutCalendar' }));
    act(() => calendar().onOpenEntry({ id: 42, diary_id: 1, date: '2026-10-20', index: 2, time_of_day: null, title: null, snippet: '', mood: null, sealed: false }));
    expect(location()).toBe('?diary=all&entry=42');
    expect(screen.getByTestId('entries-list')).toBeInTheDocument();
  });

  it('leaves the arrow keys to the calendar instead of turning list pages', () => {
    const props = createProps({ pagination: { page: 2 } });
    renderJournal(props, '?diary=1&layout=calendar');

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(props.pagination.setPage).not.toHaveBeenCalled();
  });

  it('leaves the list pages alone for an arrow key a control has already handled', () => {
    const props = createProps({ pagination: { page: 2 } });
    renderJournal(props);

    const handled = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    expect(props.pagination.setPage).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(props.pagination.setPage).toHaveBeenCalledWith(3);
  });
});
