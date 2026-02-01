import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JournalView from './JournalView';
import type { Config, Entry, Diary, GroupedEntries } from '../../types';

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
  default: ({ isOpen, onClose, theme, t, diaryId, onNavigateToEntry }: {
    isOpen: boolean; onClose: () => void; theme: string; t: (key: string) => string;
    diaryId: number | null; onNavigateToEntry: (date: string, index: number) => void;
  }) => (
    <div data-testid="thought-of-day">
      <span data-testid="totd-open">{isOpen.toString()}</span>
      <span data-testid="totd-diary-id">{diaryId}</span>
      <button data-testid="totd-close-btn" onClick={onClose}>Close</button>
      <button data-testid="totd-navigate-btn" onClick={() => onNavigateToEntry('2024-01-01', 0)}>Navigate</button>
    </div>
  )
}));

vi.mock('../EntryForm/EntryForm', () => ({
  default: ({ newEntryText, setNewEntryText, selectedDate, setSelectedDate, tags, setTags, 
    visibility, setVisibility, allTags, formError, onSubmit, theme, t }: {
    newEntryText: string; setNewEntryText: (text: string) => void; selectedDate: Date;
    setSelectedDate: (date: Date) => void; tags: string[]; setTags: (tags: string[]) => void;
    visibility: string | null; setVisibility: (v: string | null) => void; allTags: string[];
    formError: string; onSubmit: (e: React.FormEvent) => void; theme: string; t: (key: string) => string;
  }) => (
    <form data-testid="entry-form" onSubmit={onSubmit}>
      <input data-testid="entry-text" value={newEntryText} onChange={(e) => setNewEntryText(e.target.value)} />
      <span data-testid="form-error">{formError}</span>
      <span data-testid="entry-tags">{tags.join(',')}</span>
      <span data-testid="entry-visibility">{visibility}</span>
      <button type="submit">Submit</button>
    </form>
  )
}));

vi.mock('../FilterControls/FilterControls', () => ({
  default: ({ search, setSearch, filterVisibility, setFilterVisibility, setPage, theme, onOpenHighlights }: {
    search: string; setSearch: (s: string) => void; filterVisibility: string;
    setFilterVisibility: (v: string) => void; setPage: (p: number) => void;
    theme: string; onOpenHighlights: () => void;
  }) => (
    <div data-testid="filter-controls">
      <input data-testid="search-input" value={search} onChange={(e) => setSearch(e.target.value)} />
      <span data-testid="filter-visibility">{filterVisibility}</span>
      <button data-testid="open-highlights-btn" onClick={onOpenHighlights}>Highlights</button>
    </div>
  )
}));

vi.mock('../EntriesList/EntriesList', () => ({
  default: ({ loading, entries, onEdit, onDelete, onToggleVisibility, onNavigateToEntry, 
    sourceEntry, activeTargetId, onBackToSource }: {
    loading: boolean; entries: Entry[]; onEdit: (e: Entry) => void; onDelete: (id: number) => void;
    onToggleVisibility: (e: Entry) => void; onNavigateToEntry: (date: string, index: number) => void;
    sourceEntry: object | null; activeTargetId: number | null; onBackToSource: () => void;
  }) => (
    <div data-testid="entries-list">
      <span data-testid="loading">{loading.toString()}</span>
      <span data-testid="entries-count">{entries.length}</span>
      <span data-testid="active-target-id">{activeTargetId}</span>
      <span data-testid="has-source-entry">{(!!sourceEntry).toString()}</span>
      <button data-testid="back-to-source-btn" onClick={onBackToSource}>Back</button>
    </div>
  )
}));

vi.mock('../Pagination/Pagination', () => ({
  default: ({ page, totalPages, setPage, inputPage, setInputPage }: {
    page: number; totalPages: number; setPage: (p: number) => void;
    inputPage: string; setInputPage: (p: string) => void;
  }) => (
    <div data-testid="pagination">
      <span data-testid="current-page">{page}</span>
      <span data-testid="total-pages">{totalPages}</span>
      <button data-testid="next-page-btn" onClick={() => setPage(page + 1)}>Next</button>
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
    dateFormat: 'YYYY-MM-DD',
    groupEntriesBy: 'day',
    entriesPerPage: 10,
    showPublicEntries: true,
    defaultVisibility: 'private',
  };

  const mockDiaries: Diary[] = [
    { id: 1, name: 'Personal', icon: '📓', isDefault: true },
    { id: 2, name: 'Work', icon: '💼', isDefault: false },
  ];

  const mockEntries: Entry[] = [
    { id: 1, content: 'Entry 1', date: '2024-01-01', tags: ['tag1'], visibility: 'public', diaryId: 1 },
    { id: 2, content: 'Entry 2', date: '2024-01-02', tags: ['tag2'], visibility: 'private', diaryId: 1 },
  ];

  const mockGroupedEntries: GroupedEntries = {
    '2024-01-01': [mockEntries[0]],
    '2024-01-02': [mockEntries[1]],
  };

  let defaultProps: Parameters<typeof JournalView>[0];

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps = {
      diaries: mockDiaries,
      currentDiaryId: 1,
      onDiaryChange: vi.fn(),
      onManageDiaries: vi.fn(),
      highlightsModalOpen: false,
      setHighlightsModalOpen: vi.fn(),
      newEntryText: '',
      setNewEntryText: vi.fn(),
      selectedDate: new Date('2024-01-15'),
      setSelectedDate: vi.fn(),
      tags: [],
      setTags: vi.fn(),
      visibility: 'private',
      setVisibility: vi.fn(),
      allTags: ['tag1', 'tag2', 'tag3'],
      formError: '',
      onSubmit: vi.fn(),
      search: '',
      setSearch: vi.fn(),
      filterTags: [],
      setFilterTags: vi.fn(),
      filterDateObj: null,
      setFilterDateObj: vi.fn(),
      filterVisibility: 'all',
      setFilterVisibility: vi.fn(),
      entryDates: ['2024-01-01', '2024-01-02'],
      setPage: vi.fn(),
      loading: false,
      entries: mockEntries,
      groupedEntries: mockGroupedEntries,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleVisibility: vi.fn(),
      editingEntry: null,
      editText: '',
      setEditText: vi.fn(),
      editTags: [],
      setEditTags: vi.fn(),
      editDate: null,
      setEditDate: vi.fn(),
      editVisibility: 'private',
      setEditVisibility: vi.fn(),
      onSaveEdit: vi.fn(),
      onCancelEdit: vi.fn(),
      onNavigateToEntry: vi.fn(),
      sourceEntry: null,
      activeTargetId: null,
      onBackToSource: vi.fn(),
      page: 1,
      totalPages: 5,
      inputPage: '1',
      setInputPage: vi.fn(),
      availableYears: [2023, 2024],
      availableMonths: ['January', 'February', 'March'],
      onNavigateToFirst: vi.fn(),
      config: mockConfig,
      t: mockT,
    };
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
    
    expect(defaultProps.onDiaryChange).toHaveBeenCalledWith(2);
    expect(defaultProps.setPage).toHaveBeenCalledWith(1);
  });

  it('handles manage diaries action', () => {
    render(<JournalView {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('manage-diaries-btn'));
    
    expect(defaultProps.onManageDiaries).toHaveBeenCalled();
  });

  it('passes highlights modal state to ThoughtOfTheDay', () => {
    render(<JournalView {...defaultProps} highlightsModalOpen={true} />);
    
    expect(screen.getByTestId('totd-open')).toHaveTextContent('true');
    expect(screen.getByTestId('totd-diary-id')).toHaveTextContent('1');
  });

  it('closes highlights modal', () => {
    render(<JournalView {...defaultProps} highlightsModalOpen={true} />);
    
    fireEvent.click(screen.getByTestId('totd-close-btn'));
    
    expect(defaultProps.setHighlightsModalOpen).toHaveBeenCalledWith(false);
  });

  it('opens highlights modal from filter controls', () => {
    render(<JournalView {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('open-highlights-btn'));
    
    expect(defaultProps.setHighlightsModalOpen).toHaveBeenCalledWith(true);
  });

  it('shows form error when present', () => {
    render(<JournalView {...defaultProps} formError="Error message" />);
    
    expect(screen.getByTestId('form-error')).toHaveTextContent('Error message');
  });

  it('passes entry data to entries list', () => {
    render(<JournalView {...defaultProps} />);
    
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('entries-count')).toHaveTextContent('2');
  });

  it('shows loading state in entries list', () => {
    render(<JournalView {...defaultProps} loading={true} />);
    
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('passes pagination data correctly', () => {
    render(<JournalView {...defaultProps} page={3} totalPages={10} />);
    
    expect(screen.getByTestId('current-page')).toHaveTextContent('3');
    expect(screen.getByTestId('total-pages')).toHaveTextContent('10');
  });

  it('handles page navigation', () => {
    render(<JournalView {...defaultProps} page={2} />);
    
    fireEvent.click(screen.getByTestId('next-page-btn'));
    
    expect(defaultProps.setPage).toHaveBeenCalledWith(3);
  });

  it('passes available years and months to navigator', () => {
    render(<JournalView {...defaultProps} />);
    
    expect(screen.getByTestId('available-years')).toHaveTextContent('2023,2024');
    expect(screen.getByTestId('available-months')).toHaveTextContent('January,February,March');
  });

  it('handles year/month navigation', () => {
    render(<JournalView {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('navigate-btn'));
    
    expect(defaultProps.onNavigateToFirst).toHaveBeenCalledWith(2024, 1);
  });

  it('handles back to source action', () => {
    render(<JournalView {...defaultProps} sourceEntry={{ date: '2024-01-01', index: 0, id: 1, diaryId: 1 }} />);
    
    expect(screen.getByTestId('has-source-entry')).toHaveTextContent('true');
    
    fireEvent.click(screen.getByTestId('back-to-source-btn'));
    
    expect(defaultProps.onBackToSource).toHaveBeenCalled();
  });

  it('displays active target id for navigation', () => {
    render(<JournalView {...defaultProps} activeTargetId={5} />);
    
    expect(screen.getByTestId('active-target-id')).toHaveTextContent('5');
  });

  it('renders with light theme', () => {
    const lightConfig = { ...mockConfig, theme: 'light' as const };
    render(<JournalView {...defaultProps} config={lightConfig} />);
    
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('renders with no current diary', () => {
    render(<JournalView {...defaultProps} currentDiaryId={null} />);
    
    expect(screen.getByTestId('current-diary-id')).toHaveTextContent('');
    expect(screen.getByTestId('totd-diary-id')).toHaveTextContent('');
  });

  it('renders with empty diaries list', () => {
    render(<JournalView {...defaultProps} diaries={[]} />);
    
    expect(screen.getByTestId('diary-count')).toHaveTextContent('0');
  });

  it('renders with empty entries list', () => {
    render(<JournalView {...defaultProps} entries={[]} groupedEntries={{}} />);
    
    expect(screen.getByTestId('entries-count')).toHaveTextContent('0');
  });

  it('handles form submission', () => {
    render(<JournalView {...defaultProps} newEntryText="New entry content" />);
    
    fireEvent.submit(screen.getByTestId('entry-form'));
    
    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it('displays entry visibility correctly', () => {
    render(<JournalView {...defaultProps} visibility="public" />);
    
    expect(screen.getByTestId('entry-visibility')).toHaveTextContent('public');
  });

  it('handles thought of day navigation', () => {
    render(<JournalView {...defaultProps} highlightsModalOpen={true} />);
    
    fireEvent.click(screen.getByTestId('totd-navigate-btn'));
    
    expect(defaultProps.onNavigateToEntry).toHaveBeenCalledWith('2024-01-01', 0);
  });
});
