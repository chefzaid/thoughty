import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JournalView from './JournalView';
import { createProps, mockConfig } from './JournalView.test-helpers';
import type { JournalViewProps } from './JournalView.test-helpers';

vi.mock('../DiaryTabs/DiaryTabs', async () => ({ default: (await import('./JournalView.test-helpers')).MockDiaryTabs }));
vi.mock('../ThoughtOfTheDay/ThoughtOfTheDay', async () => ({ default: (await import('./JournalView.test-helpers')).MockThoughtOfTheDay }));
vi.mock('../WritingStreak/WritingStreakCard', async () => ({ default: (await import('./JournalView.test-helpers')).MockWritingStreakCard }));
vi.mock('../ComfortReads/ComfortReadsCard', async () => ({ default: (await import('./JournalView.test-helpers')).MockComfortReadsCard }));
vi.mock('../EntryForm/EntryForm', async () => ({ default: (await import('./JournalView.test-helpers')).MockEntryForm }));
vi.mock('../FilterControls/FilterControls', async () => ({ default: (await import('./JournalView.test-helpers')).MockFilterControls }));
vi.mock('../EntriesList/EntriesList', async () => ({ default: (await import('./JournalView.test-helpers')).MockEntriesList }));
vi.mock('./JournalFeed', async () => ({ default: (await import('./JournalView.test-helpers')).MockJournalFeed }));
vi.mock('../YearMonthNavigator/YearMonthNavigator', async () => ({ default: (await import('./JournalView.test-helpers')).MockYearMonthNavigator }));
vi.mock('../BackToTopButton/BackToTopButton', async () => ({ default: (await import('./JournalView.test-helpers')).MockBackToTopButton }));
vi.mock('../DuplicateReview/DuplicateReview', async () => ({ default: (await import('./JournalView.test-helpers')).MockDuplicateReview }));
vi.mock('../SavedSearches/SavedSearches', async () => ({ default: (await import('./JournalView.test-helpers')).MockSavedSearches }));
vi.mock('./RandomEntryButton', async () => ({ default: (await import('./JournalView.test-helpers')).MockRandomEntryButton }));
vi.mock('../LifeEras/useLifeEras', async () => ({ useLifeEraList: (await import('./JournalView.test-helpers')).mockUseLifeEraList }));
vi.mock('../People/usePeople', async () => ({ usePeopleList: (await import('./JournalView.test-helpers')).mockUsePeopleList }));
// These specs render without a router, so the person filter is left out of the address
vi.mock('./usePersonFilterRoute', () => ({ usePersonFilterRoute: () => undefined }));
vi.mock('./composerFocusRoute', () => ({ useComposerFocusRoute: () => undefined }));
vi.mock('../EntryReader/useEntryReaderRoute', async () => {
  const { closedReaderRoute } = await import('./JournalView.test-helpers');
  return { useEntryReaderRoute: () => closedReaderRoute };
});
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

  it('renders all child components', () => {
    render(<JournalView {...defaultProps} />);

    expect(screen.getByTestId('diary-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('thought-of-day')).toBeInTheDocument();
    expect(screen.getByTestId('entry-form')).toBeInTheDocument();
    expect(screen.getByTestId('filter-controls')).toBeInTheDocument();
    expect(screen.getByTestId('entries-list')).toBeInTheDocument();
    expect(screen.getByTestId('journal-feed')).toContainElement(screen.getByTestId('entries-list'));
    expect(screen.getByTestId('year-month-navigator')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-top')).toBeInTheDocument();
  });

  it('renders the duplicate finder inside the filter controls', () => {
    render(<JournalView {...defaultProps} />);

    expect(screen.getByTestId('filter-controls')).toContainElement(screen.getByTestId('duplicate-review'));
  });

  it('puts the saved searches in the filter controls with the diary scope and the notice toast', () => {
    render(<JournalView {...defaultProps} />);

    expect(screen.getByTestId('filter-controls')).toContainElement(screen.getByTestId('saved-searches'));
    expect(screen.getByTestId('saved-searches-diary')).toHaveTextContent('1');
    expect(screen.getByTestId('saved-searches-diaries')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: 'Saved search notice' }));
    expect(defaultProps.onNotify).toHaveBeenCalledWith('Saved search notice');
  });

  it('passes diaries data to DiaryTabs', () => {
    render(<JournalView {...defaultProps} />);

    expect(screen.getByTestId('diary-count')).toHaveTextContent('2');
    expect(screen.getByTestId('current-diary-id')).toHaveTextContent('1');
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('changes the diary, which starts the list over', () => {
    render(<JournalView {...defaultProps} />);

    fireEvent.click(screen.getByTestId('diary-change-btn'));

    expect(defaultProps.diaryTabs.onDiaryChange).toHaveBeenCalledWith(2);
  });

  it('handles manage diaries action', () => {
    render(<JournalView {...defaultProps} />);

    fireEvent.click(screen.getByTestId('manage-diaries-btn'));

    expect(defaultProps.diaryTabs.onManageDiaries).toHaveBeenCalled();
  });

  it('passes highlights modal state to ThoughtOfTheDay', () => {
    render(<JournalView {...createProps({ thoughtOfDay: { isOpen: true } })} />);

    expect(screen.getByTestId('totd-open')).toHaveTextContent('true');
    expect(screen.getByTestId('totd-diary-id')).toHaveTextContent('1');
  });

  it('closes highlights modal', () => {
    const props = createProps({ thoughtOfDay: { isOpen: true } });
    render(<JournalView {...props} />);

    fireEvent.click(screen.getByTestId('totd-close-btn'));

    expect(props.thoughtOfDay.setOpen).toHaveBeenCalledWith(false);
  });

  it('opens highlights modal from filter controls', () => {
    render(<JournalView {...defaultProps} />);

    fireEvent.click(screen.getByTestId('open-highlights-btn'));

    expect(defaultProps.thoughtOfDay.setOpen).toHaveBeenCalledWith(true);
  });

  it('shows form error when present', () => {
    render(<JournalView {...createProps({ entryForm: { formError: 'Error message' } })} />);

    expect(screen.getByTestId('form-error')).toHaveTextContent('Error message');
  });

  it('passes entry data to entries list', () => {
    render(<JournalView {...defaultProps} />);

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('entries-count')).toHaveTextContent('2');
  });

  it('shows loading state in entries list', () => {
    render(<JournalView {...createProps({ entriesList: { loading: true } })} />);

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('hands the infinite scroll its state, loading newer entries by themselves only once no jump is settling', () => {
    const props = createProps({ feed: { total: 340 } });
    const { rerender } = render(<JournalView {...props} />);

    expect(screen.getByTestId('feed-total')).toHaveTextContent('340');
    expect(screen.getByTestId('feed-auto-newer')).toHaveTextContent('true');
    fireEvent.click(screen.getByTestId('load-older-btn'));
    fireEvent.click(screen.getByTestId('load-newer-btn'));
    expect(props.feed.loadOlder).toHaveBeenCalled();
    expect(props.feed.loadNewer).toHaveBeenCalled();

    rerender(<JournalView {...createProps({ entriesList: { targetEntryId: 9 } })} />);
    expect(screen.getByTestId('feed-auto-newer')).toHaveTextContent('false');
  });

  it('renders with light theme', () => {
    const lightConfig = { ...mockConfig, theme: 'light' as const };
    render(<JournalView {...defaultProps} config={lightConfig} />);

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('renders with no current diary', () => {
    render(<JournalView {...createProps({ diaryTabs: { currentDiaryId: null }, thoughtOfDay: { diaryId: null } })} />);

    expect(screen.getByTestId('current-diary-id')).toHaveTextContent('');
    expect(screen.getByTestId('totd-diary-id')).toHaveTextContent('');
  });

  it('renders with empty diaries list', () => {
    render(<JournalView {...createProps({ diaryTabs: { diaries: [] } })} />);

    expect(screen.getByTestId('diary-count')).toHaveTextContent('0');
  });

  it('renders with empty entries list', () => {
    render(<JournalView {...createProps({ entriesList: { entries: [], groupedEntries: {} } })} />);

    expect(screen.getByTestId('entries-count')).toHaveTextContent('0');
  });
});
