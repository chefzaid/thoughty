import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JournalView from './JournalView';
import { createProps, focusModeTrigger, listLayoutRoute } from './JournalView.test-helpers';
import type { JournalViewProps } from './JournalView.test-helpers';

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
vi.mock('../JournalCalendar/useJournalLayoutRoute', async () => {
  const { listLayoutRoute } = await import('./JournalView.test-helpers');
  return { useJournalLayoutRoute: () => listLayoutRoute };
});

describe('JournalView', () => {
  let defaultProps: JournalViewProps;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps = createProps();
  });

  it('focuses the entry writer with Ctrl+N', () => {
    render(<JournalView {...defaultProps} />);

    fireEvent.keyDown(document, { key: 'n', ctrlKey: true });

    expect(screen.getByTestId('entry-text')).toHaveFocus();
  });

  it('shows the writing streak card for the diary, unless it is turned off in Profile', () => {
    const { rerender } = render(<JournalView {...defaultProps} diaryTabs={{ ...defaultProps.diaryTabs, currentDiaryId: 2 }} />);

    expect(screen.getByTestId('writing-streak-card')).toHaveAttribute('data-diary-id', '2');
    expect(screen.getByTestId('writing-streak-card')).toHaveAttribute('data-enabled', 'true');

    rerender(<JournalView {...defaultProps} config={{ ...defaultProps.config, streakCard: false }} />);
    expect(screen.getByTestId('writing-streak-card')).toHaveAttribute('data-enabled', 'false');
  });

  it('writes now in the composer, or rereads the last entry through its permalink', () => {
    render(<JournalView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write now' }));
    expect(screen.getByTestId('entry-text')).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Reread it' }));
    expect(listLayoutRoute.openEntry).toHaveBeenCalledWith(7);
  });

  it('opens focus mode for the composer with Ctrl+Shift+F', () => {
    render(<JournalView {...defaultProps} />);

    const event = fireEvent.keyDown(document, { key: 'F', ctrlKey: true, shiftKey: true });

    expect(focusModeTrigger).toHaveBeenCalledTimes(1);
    expect(event).toBe(false);
  });

  it('focuses journal search with Ctrl+/', () => {
    render(<JournalView {...defaultProps} />);

    fireEvent.keyDown(document, { key: '/', ctrlKey: true });

    expect(screen.getByTestId('search-input')).toHaveFocus();
  });

  it('closes highlights with Escape', () => {
    const props = createProps({ thoughtOfDay: { isOpen: true } });
    render(<JournalView {...props} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(props.thoughtOfDay.setOpen).toHaveBeenCalledWith(false);
  });

  it('changes pages with arrow keys outside editable fields', () => {
    const props = createProps({ pagination: { page: 2, totalPages: 5 } });
    render(<JournalView {...props} />);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowLeft' });

    expect(props.pagination.setPage).toHaveBeenCalledWith(3);
    expect(props.pagination.setPage).toHaveBeenCalledWith(1);
  });

  it('does not change pages with arrow keys while typing', () => {
    const props = createProps({ pagination: { page: 2, totalPages: 5 } });
    render(<JournalView {...props} />);

    const entryText = screen.getByTestId('entry-text');
    entryText.focus();
    fireEvent.keyDown(entryText, { key: 'ArrowRight' });

    expect(props.pagination.setPage).not.toHaveBeenCalled();
  });

  it('passes available years and months to navigator', () => {
    render(<JournalView {...defaultProps} />);

    expect(screen.getByTestId('available-years')).toHaveTextContent('2023,2024');
    expect(screen.getByTestId('available-months')).toHaveTextContent('January,February,March');
  });

  it('handles year/month navigation', () => {
    render(<JournalView {...defaultProps} />);

    fireEvent.click(screen.getByTestId('navigate-btn'));

    expect(defaultProps.yearMonthNavigator.onNavigate).toHaveBeenCalledWith(2024, 1);
  });

  it('handles back to source action', () => {
    const props = createProps({ entriesList: { sourceEntry: { date: '2024-01-01', index: 0, id: 1 } } });
    render(<JournalView {...props} />);

    expect(screen.getByTestId('has-source-entry')).toHaveTextContent('true');

    fireEvent.click(screen.getByTestId('back-to-source-btn'));

    expect(props.entriesList.onBackToSource).toHaveBeenCalled();
  });

  it('displays active target id for navigation', () => {
    render(<JournalView {...createProps({ entriesList: { activeTargetId: 5 } })} />);

    expect(screen.getByTestId('active-target-id')).toHaveTextContent('5');
  });

  it('passes target entry id for highlight rendering', () => {
    render(<JournalView {...createProps({ entriesList: { targetEntryId: 5 } })} />);

    expect(screen.getByTestId('target-entry-id')).toHaveTextContent('5');
  });

  it('handles form submission', () => {
    const props = createProps({ entryForm: { newEntryText: 'New entry content' } });
    render(<JournalView {...props} />);

    fireEvent.submit(screen.getByTestId('entry-form'));

    expect(props.entryForm.onSubmit).toHaveBeenCalled();
  });

  it('displays entry visibility correctly', () => {
    render(<JournalView {...createProps({ entryForm: { visibility: 'public' } })} />);

    expect(screen.getByTestId('entry-visibility')).toHaveTextContent('public');
  });

  it('handles thought of day navigation', () => {
    const props = createProps({ thoughtOfDay: { isOpen: true } });
    render(<JournalView {...props} />);

    fireEvent.click(screen.getByTestId('totd-navigate-btn'));

    expect(props.thoughtOfDay.onNavigateToEntry).toHaveBeenCalledWith('2024-01-01', 0);
  });

  it('opens the recycle bin from the filter bar tools', () => {
    const props = createProps();
    render(<JournalView {...props} />);

    const button = screen.getByRole('button', { name: 'recycleBin' });
    expect(screen.getByTestId('filter-controls')).toContainElement(button);
    fireEvent.click(button);

    expect(props.onOpenRecycleBin).toHaveBeenCalledTimes(1);
  });

  it('gives the filter bar the writer’s life eras and a way to manage them', () => {
    const props = createProps();
    render(<JournalView {...props} />);

    expect(screen.getByTestId('filter-era-count')).toHaveTextContent('0');
    fireEvent.click(screen.getByTestId('manage-eras-btn'));
    expect(props.onManageLifeEras).toHaveBeenCalledTimes(1);
  });
});
