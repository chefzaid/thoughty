import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentPropsWithoutRef } from 'react';
import JournalView from './JournalView';
import type { Config, Entry, Diary, GroupedEntries } from '../../types';

type SubmitEvent = Parameters<NonNullable<ComponentPropsWithoutRef<'form'>['onSubmit']>>[0];

// Mock all child components
vi.mock('../DiaryTabs/DiaryTabs', () => ({
  default: ({ diaries, currentDiaryId, onDiaryChange, onManageDiaries, theme, t }: { 
    diaries: Diary[]; currentDiaryId: number | null; onDiaryChange: (id: number | null) => void;
    onManageDiaries: () => void; theme: string; t: (key: string) => string;
  }) => (
    <div data-testid="diary-tabs">
      <span data-testid="diary-count">{diaries.length}</span>
      <span data-testid="current-diary-id">{currentDiaryId}</span>
      <span data-testid="theme">{theme}</span>
      <button data-testid="diary-change-btn" onClick={() => onDiaryChange(2)}>Change Diary</button>
      <button data-testid="manage-diaries-btn" onClick={onManageDiaries}>Manage</button>
      <span>{t('diaries')}</span>
    </div>
  )
}));

vi.mock('../ThoughtOfTheDay/ThoughtOfTheDay', () => ({
  default: (props: {
    isOpen: boolean;
    onClose: () => void;
    diaryId: number | null;
    onNavigateToEntry: (date: string, index: number) => void;
  }) => (
    <div data-testid="thought-of-day">
      <span data-testid="totd-open">{props.isOpen.toString()}</span>
      <span data-testid="totd-diary-id">{props.diaryId}</span>
      <button data-testid="totd-close-btn" onClick={props.onClose}>Close</button>
      <button data-testid="totd-navigate-btn" onClick={() => props.onNavigateToEntry('2024-01-01', 0)}>Navigate</button>
    </div>
  )
}));

vi.mock('../EntryForm/EntryForm', () => ({
  default: (props: {
    newEntryText: string;
    setNewEntryText: (text: string) => void;
    tags: string[];
    visibility: string | null;
    formError: string;
    onSubmit: (e: SubmitEvent) => void;
  }) => (
    <form data-testid="entry-form" onSubmit={props.onSubmit}>
      <input data-testid="entry-text" value={props.newEntryText} onChange={(e) => props.setNewEntryText(e.target.value)} />
      <span data-testid="form-error">{props.formError}</span>
      <span data-testid="entry-tags">{props.tags.join(',')}</span>
      <span data-testid="entry-visibility">{props.visibility}</span>
      <button type="submit">Submit</button>
    </form>
  )
}));

vi.mock('../FilterControls/FilterControls', () => ({
  default: (props: {
    search: string;
    setSearch: (s: string) => void;
    filterVisibility: string;
    onOpenHighlights: () => void;
  }) => (
    <div data-testid="filter-controls">
      <input data-testid="search-input" value={props.search} onChange={(e) => props.setSearch(e.target.value)} />
      <span data-testid="filter-visibility">{props.filterVisibility}</span>
      <button data-testid="open-highlights-btn" onClick={props.onOpenHighlights}>Highlights</button>
    </div>
  )
}));

vi.mock('../EntriesList/EntriesList', () => ({
  default: (props: {
    loading: boolean;
    entries: Entry[];
    sourceEntry: object | null;
    targetEntryId: number | null;
    activeTargetId: number | null;
    onBackToSource: () => void;
  }) => (
    <div data-testid="entries-list">
      <span data-testid="loading">{props.loading.toString()}</span>
      <span data-testid="entries-count">{props.entries.length}</span>
      <span data-testid="target-entry-id">{props.targetEntryId}</span>
      <span data-testid="active-target-id">{props.activeTargetId}</span>
      <span data-testid="has-source-entry">{(!!props.sourceEntry).toString()}</span>
      <button data-testid="back-to-source-btn" onClick={props.onBackToSource}>Back</button>
    </div>
  )
}));

vi.mock('../Pagination/Pagination', () => ({
  default: (props: {
    page: number;
    totalPages: number;
    setPage: (p: number) => void;
  }) => (
    <div data-testid="pagination">
      <span data-testid="current-page">{props.page}</span>
      <span data-testid="total-pages">{props.totalPages}</span>
      <button data-testid="next-page-btn" onClick={() => props.setPage(props.page + 1)}>Next</button>
    </div>
  )
}));

vi.mock('../YearMonthNavigator/YearMonthNavigator', () => ({
  default: ({ availableYears, availableMonths, onNavigate }: {
    availableYears: number[]; availableMonths: string[]; onNavigate: (year: number, month: number | null) => void;
  }) => (
    <div data-testid="year-month-navigator">
      <span data-testid="available-years">{availableYears.join(',')}</span>
      <span data-testid="available-months">{availableMonths.join(',')}</span>
      <button data-testid="navigate-btn" onClick={() => onNavigate(2024, 1)}>Navigate</button>
    </div>
  )
}));

vi.mock('../BackToTopButton/BackToTopButton', () => ({
  default: ({ t }: { t: (key: string) => string }) => (
    <button data-testid="back-to-top">{t('backToTop')}</button>
  )
}));

describe('JournalView', () => {
  const mockT = vi.fn((key: string) => key);
  const mockConfig: Config = {
    theme: 'dark',
    language: 'en',
    entriesPerPage: 10,
    defaultVisibility: 'private',
  };

  const mockDiaries: Diary[] = [
    { id: 1, name: 'Personal', icon: '📓', visibility: 'private', is_default: true },
    { id: 2, name: 'Work', icon: '💼', visibility: 'private', is_default: false },
  ];

  const mockEntries: [Entry, Entry] = [
    { id: 1, content: 'Entry 1', date: '2024-01-01', tags: ['tag1'], visibility: 'public', diary_id: 1 },
    { id: 2, content: 'Entry 2', date: '2024-01-02', tags: ['tag2'], visibility: 'private', diary_id: 1 },
  ];

  const mockGroupedEntries: GroupedEntries = {
    '2024-01-01': [mockEntries[0]],
    '2024-01-02': [mockEntries[1]],
  };

  type JournalViewProps = Parameters<typeof JournalView>[0];
  type PropsOverrides = {
    [K in keyof JournalViewProps]?: JournalViewProps[K] extends (...args: never[]) => unknown
      ? JournalViewProps[K]
      : JournalViewProps[K] extends object
        ? Partial<JournalViewProps[K]>
        : JournalViewProps[K];
  };

  const createProps = (overrides: PropsOverrides = {}): JournalViewProps => {
    const base: JournalViewProps = {
      diaryTabs: {
        diaries: mockDiaries,
        currentDiaryId: 1,
        onDiaryChange: vi.fn(),
        onManageDiaries: vi.fn(),
      },
      thoughtOfDay: {
        isOpen: false,
        setOpen: vi.fn(),
        diaryId: 1,
        onNavigateToEntry: vi.fn(),
      },
      entryForm: {
        newEntryText: '',
        setNewEntryText: vi.fn(),
        selectedDate: new Date('2024-01-15'),
        setSelectedDate: vi.fn(),
        tags: [],
        setTags: vi.fn(),
        visibility: 'private',
        setVisibility: vi.fn(),
        format: 'plain',
        setFormat: vi.fn(),
        allTags: ['tag1', 'tag2', 'tag3'],
        formError: '',
        onSubmit: vi.fn(),
      },
      filters: {
        search: '',
        setSearch: vi.fn(),
        filterTags: [],
        setFilterTags: vi.fn(),
        filterDateObj: null,
        setFilterDateObj: vi.fn(),
        filterVisibility: 'all',
        setFilterVisibility: vi.fn(),
        filterFavorites: false,
        setFilterFavorites: vi.fn(),
        filterArchiveStatus: 'active',
        setFilterArchiveStatus: vi.fn(),
        allTags: ['tag1', 'tag2', 'tag3'],
        setPage: vi.fn(),
      },
      entriesList: {
        loading: false,
        entries: mockEntries,
        groupedEntries: mockGroupedEntries,
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onToggleVisibility: vi.fn(),
        onToggleFavorite: vi.fn(),
        onToggleArchived: vi.fn(),
        editingEntry: null,
        editText: '',
        setEditText: vi.fn(),
        editTags: [],
        setEditTags: vi.fn(),
        editDate: null,
        setEditDate: vi.fn(),
        editVisibility: 'private',
        setEditVisibility: vi.fn(),
        editFormat: 'plain',
        setEditFormat: vi.fn(),
        allTags: ['tag1', 'tag2', 'tag3'],
        onSaveEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onNavigateToEntry: vi.fn(),
        sourceEntry: null,
        targetEntryId: null,
        activeTargetId: null,
        onBackToSource: vi.fn(),
      },
      pagination: {
        page: 1,
        totalPages: 5,
        inputPage: '1',
        setPage: vi.fn(),
        setInputPage: vi.fn(),
      },
      yearMonthNavigator: {
        availableYears: [2023, 2024],
        availableMonths: ['January', 'February', 'March'],
        onNavigate: vi.fn(),
      },
      config: mockConfig,
      t: mockT,
    };

    return {
      ...base,
      ...overrides,
      diaryTabs: { ...base.diaryTabs, ...overrides.diaryTabs },
      thoughtOfDay: { ...base.thoughtOfDay, ...overrides.thoughtOfDay },
      entryForm: { ...base.entryForm, ...overrides.entryForm },
      filters: { ...base.filters, ...overrides.filters },
      entriesList: { ...base.entriesList, ...overrides.entriesList },
      pagination: { ...base.pagination, ...overrides.pagination },
      yearMonthNavigator: { ...base.yearMonthNavigator, ...overrides.yearMonthNavigator },
    };
  };

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
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByTestId('year-month-navigator')).toBeInTheDocument();
    expect(screen.getByTestId('back-to-top')).toBeInTheDocument();
  });

  it('passes diaries data to DiaryTabs', () => {
    render(<JournalView {...defaultProps} />);
    
    expect(screen.getByTestId('diary-count')).toHaveTextContent('2');
    expect(screen.getByTestId('current-diary-id')).toHaveTextContent('1');
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('handles diary change and resets page to 1', () => {
    render(<JournalView {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('diary-change-btn'));
    
    expect(defaultProps.diaryTabs.onDiaryChange).toHaveBeenCalledWith(2);
    expect(defaultProps.pagination.setPage).toHaveBeenCalledWith(1);
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

  it('passes pagination data correctly', () => {
    render(<JournalView {...createProps({ pagination: { page: 3, totalPages: 10 } })} />);
    
    expect(screen.getByTestId('current-page')).toHaveTextContent('3');
    expect(screen.getByTestId('total-pages')).toHaveTextContent('10');
  });

  it('handles page navigation', () => {
    const props = createProps({ pagination: { page: 2 } });
    render(<JournalView {...props} />);
    
    fireEvent.click(screen.getByTestId('next-page-btn'));
    
    expect(props.pagination.setPage).toHaveBeenCalledWith(3);
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
});
