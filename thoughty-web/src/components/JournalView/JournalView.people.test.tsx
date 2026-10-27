import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import JournalView from './JournalView';
import { createProps, peopleListMock, type JournalViewProps } from './JournalView.test-helpers';
import type { Person } from '../../services/api';

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

const marie: Person = { id: 12, name: 'Marie', handles: ['marie', 'mariec'], entryCount: 3, lastMentionedOn: '2026-10-20', createdAt: '', updatedAt: '' };

function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderJournal(props: JournalViewProps, search: string) {
  const view = render(
    <MemoryRouter initialEntries={[`/journal${search}`]}>
      <JournalView {...props} />
      <Location />
    </MemoryRouter>,
  );
  return {
    rerender: (next: JournalViewProps) => view.rerender(
      <MemoryRouter initialEntries={[`/journal${search}`]}>
        <JournalView {...next} />
        <Location />
      </MemoryRouter>,
    ),
  };
}

const location = () => screen.getByTestId('location').textContent;

describe('JournalView people', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    peopleListMock.people = [marie];
    peopleListMock.loaded = true;
  });

  afterEach(() => {
    peopleListMock.people = [];
    peopleListMock.loaded = false;
  });

  it('opens a person from the address with every other filter cleared, archived entries included', () => {
    const props = createProps();
    renderJournal(props, '?diary=all&person=12');

    const { filters } = props;
    expect(filters.setFilterPersonId).toHaveBeenCalledWith(12);
    expect(filters.setSearch).toHaveBeenCalledWith('');
    expect(filters.setFilterTags).toHaveBeenCalledWith([]);
    expect(filters.setFilterArchiveStatus).toHaveBeenCalledWith('all');
    expect(filters.setFilterEraId).toHaveBeenCalledWith(null);
    expect(filters.setPage).toHaveBeenCalledWith(1);
  });

  it('keeps the filters of a saved search the address also names', () => {
    const props = createProps();
    renderJournal(props, '?diary=all&view=4&person=12');

    expect(props.filters.setFilterPersonId).toHaveBeenCalledWith(12);
    expect(props.filters.setSearch).not.toHaveBeenCalled();
  });

  it('heads the list with the person, their count and handles, and clears the filter from there', () => {
    const props = createProps({ filters: { filterPersonId: 12 } });
    renderJournal(props, '?diary=all&person=12');

    const banner = screen.getByRole('region', { name: 'personViewTitle' });
    expect(banner).toHaveTextContent('@marie, @mariec');
    expect(screen.getByRole('link', { name: 'personViewAllPeople' })).toHaveAttribute('href', '/people');
    expect(screen.getByTestId('filter-people-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('manage-people-btn'));
    expect(props.onManagePeople).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'personViewClear' }));
    expect(props.filters.setFilterPersonId).toHaveBeenCalledWith(null);
    expect(props.filters.setPage).toHaveBeenCalledWith(1);
  });

  it('writes a person chosen in the filter bar to the address, and removes it when cleared', () => {
    const view = renderJournal(createProps(), '?diary=all');
    expect(location()).toBe('?diary=all');

    view.rerender(createProps({ filters: { filterPersonId: 12 } }));
    expect(location()).toBe('?diary=all&person=12');

    view.rerender(createProps({ filters: { filterPersonId: null } }));
    expect(location()).toBe('?diary=all');
  });

  it('follows the address when it no longer names the person', () => {
    const props = createProps({ filters: { filterPersonId: 12 } });
    renderJournal(props, '?diary=all');

    expect(props.filters.setFilterPersonId).toHaveBeenCalledWith(null);
  });

  it('stops narrowing to a person who no longer exists once the people have loaded, and says so', () => {
    peopleListMock.people = [];
    const props = createProps({ filters: { filterPersonId: 99 } });
    renderJournal(props, '?diary=all&person=99');

    expect(props.filters.setFilterPersonId).toHaveBeenCalledWith(null);
    expect(props.onNotify).toHaveBeenCalledWith('apiError_PERSON_NOT_FOUND');
  });
});
