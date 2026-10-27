import { vi } from 'vitest';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type JournalView from './JournalView';
import type { Config, Entry, Diary, GroupedEntries } from '../../types';
import { makeDiary } from '../../test/diaryFixture';

type SubmitEvent = Parameters<NonNullable<ComponentPropsWithoutRef<'form'>['onSubmit']>>[0];

/** Clicked by the mocked entry form's focus mode button. */
export const focusModeTrigger = vi.fn();

// Stand-ins for JournalView's children, which each spec mocks with
// vi.mock('../X/X', async () => ({ default: (await import('./JournalView.test-helpers')).MockX }));

export const MockDiaryTabs = ({ diaries, currentDiaryId, onDiaryChange, onManageDiaries, theme, t }: {
  diaries: Diary[]; currentDiaryId: number | null; onDiaryChange: (id: number | null) => void;
  onManageDiaries: () => void; theme: string; t: (key: string) => string;
}) => (
  <div data-testid="diary-tabs">
    <span data-testid="diary-count">{diaries.length}</span>
    <span data-testid="current-diary-id">{currentDiaryId}</span>
    <span data-testid="theme">{theme}</span>
    <button type="button" data-testid="diary-change-btn" onClick={() => onDiaryChange(2)}>Change Diary</button>
    <button type="button" data-testid="manage-diaries-btn" onClick={onManageDiaries}>Manage</button>
    <span>{t('diaries')}</span>
  </div>
);

export const MockThoughtOfTheDay = (props: {
  isOpen: boolean;
  onClose: () => void;
  diaryId: number | null;
  onNavigateToEntry: (date: string, index: number) => void;
}) => (
  <div data-testid="thought-of-day">
    <span data-testid="totd-open">{props.isOpen.toString()}</span>
    <span data-testid="totd-diary-id">{props.diaryId}</span>
    <button type="button" data-testid="totd-close-btn" onClick={props.onClose}>Close</button>
    <button type="button" data-testid="totd-navigate-btn" onClick={() => props.onNavigateToEntry('2024-01-01', 0)}>Navigate</button>
  </div>
);

export const MockWritingStreakCard = (props: {
  diaryId: number | null;
  enabled: boolean;
  onWriteNow: () => void;
  onOpenEntry: (entryId: number) => void;
}) => (
  <div data-testid="writing-streak-card" data-diary-id={props.diaryId ?? 'all'} data-enabled={String(props.enabled)}>
    <button type="button" onClick={props.onWriteNow}>Write now</button>
    <button type="button" onClick={() => props.onOpenEntry(7)}>Reread it</button>
  </div>
);

export const MockEntryForm = (props: {
  newEntryText: string;
  setNewEntryText: (text: string) => void;
  tags: string[];
  visibility: string | null;
  formError: string;
  onSubmit: (e: SubmitEvent) => void;
}) => (
  <form data-testid="entry-form" onSubmit={props.onSubmit}>
    <textarea data-testid="entry-text" value={props.newEntryText} onChange={(e) => props.setNewEntryText(e.target.value)} />
    <span data-testid="form-error">{props.formError}</span>
    <span data-testid="entry-tags">{props.tags.join(',')}</span>
    <span data-testid="entry-visibility">{props.visibility}</span>
    <button type="button" data-focus-mode-trigger="" onClick={focusModeTrigger}>Focus mode</button>
    <button type="submit">Submit</button>
  </form>
);

export const MockFilterControls = (props: {
  search: string;
  setSearch: (s: string) => void;
  filterVisibility: string;
  onOpenHighlights: () => void;
  actions?: ReactNode;
}) => (
  <div data-testid="filter-controls">
    {props.actions}
    <input data-testid="search-input" value={props.search} onChange={(e) => props.setSearch(e.target.value)} />
    <span data-testid="filter-visibility">{props.filterVisibility}</span>
    <button type="button" data-testid="open-highlights-btn" onClick={props.onOpenHighlights}>Highlights</button>
  </div>
);

export const MockEntriesList = (props: {
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
    <button type="button" data-testid="back-to-source-btn" onClick={props.onBackToSource}>Back</button>
  </div>
);

export const MockPagination = (props: {
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
}) => (
  <div data-testid="pagination">
    <span data-testid="current-page">{props.page}</span>
    <span data-testid="total-pages">{props.totalPages}</span>
    <button type="button" data-testid="next-page-btn" onClick={() => props.setPage(props.page + 1)}>Next</button>
  </div>
);

export const MockYearMonthNavigator = ({ availableYears, availableMonths, onNavigate }: {
  availableYears: number[]; availableMonths: string[]; onNavigate: (year: number, month: number | null) => void;
}) => (
  <div data-testid="year-month-navigator">
    <span data-testid="available-years">{availableYears.join(',')}</span>
    <span data-testid="available-months">{availableMonths.join(',')}</span>
    <button type="button" data-testid="navigate-btn" onClick={() => onNavigate(2024, 1)}>Navigate</button>
  </div>
);

export const MockBackToTopButton = ({ t }: { t: (key: string) => string }) => (
  <button type="button" data-testid="back-to-top">{t('backToTop')}</button>
);

export const MockSavedSearches = ({ currentDiaryId, diaries, notify }: {
  currentDiaryId: number | null; diaries: Diary[]; notify: (message: string) => void;
}) => (
  <div data-testid="saved-searches">
    <span data-testid="saved-searches-diary">{currentDiaryId}</span>
    <span data-testid="saved-searches-diaries">{diaries.length}</span>
    <button type="button" onClick={() => notify('Saved search notice')}>Saved search notice</button>
  </div>
);

export const MockDuplicateReview = ({ diaryId }: { diaryId: number | null }) => (
  <div data-testid="duplicate-review">{diaryId}</div>
);

/** The list layout, for the specs that render the journal without a router. */
export const listLayoutRoute = {
  layout: 'list' as const,
  month: null,
  setLayout: vi.fn(),
  setMonth: vi.fn(),
  openEntry: vi.fn(),
};

export const mockT = vi.fn((key: string) => key);
export const mockConfig: Config = {
  theme: 'dark',
  language: 'en',
  entriesPerPage: 10,
  defaultVisibility: 'private',
};

export const mockDiaries: Diary[] = [
  makeDiary({ id: 1, name: 'Personal', icon: '📓', isDefault: true }),
  makeDiary({ id: 2, name: 'Work', icon: '💼' }),
];

export const mockEntries: [Entry, Entry] = [
  { id: 1, content: 'Entry 1', date: '2024-01-01', tags: ['tag1'], visibility: 'public', diary_id: 1 },
  { id: 2, content: 'Entry 2', date: '2024-01-02', tags: ['tag2'], visibility: 'private', diary_id: 1 },
];

export const mockGroupedEntries: GroupedEntries = {
  '2024-01-01': [mockEntries[0]],
  '2024-01-02': [mockEntries[1]],
};

export type JournalViewProps = Parameters<typeof JournalView>[0];
type PropsOverrides = {
  [K in keyof JournalViewProps]?: JournalViewProps[K] extends (...args: never[]) => unknown
    ? JournalViewProps[K]
    : JournalViewProps[K] extends object
      ? Partial<JournalViewProps[K]>
      : JournalViewProps[K];
};

/** Props for `JournalView` with every callback mocked; each section can be partly overridden. */
export const createProps = (overrides: PropsOverrides = {}): JournalViewProps => {
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
    duplicateReview: {
      diaryId: 1,
      onFindDuplicates: vi.fn(),
      onDelete: vi.fn(),
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
      searchMode: 'keyword',
      setSearchMode: vi.fn(),
      searchSort: 'relevance',
      setSearchSort: vi.fn(),
      semanticSearchStatus: 'idle',
      semanticSearchResult: null,
      onSemanticSearch: vi.fn().mockResolvedValue(undefined),
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
      filterMood: '',
      setFilterMood: vi.fn(),
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
      onTogglePinned: vi.fn(),
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
    onOpenRecycleBin: vi.fn(),
    onNotify: vi.fn(),
    config: mockConfig,
    t: mockT,
  };

  return {
    ...base,
    ...overrides,
    diaryTabs: { ...base.diaryTabs, ...overrides.diaryTabs },
    thoughtOfDay: { ...base.thoughtOfDay, ...overrides.thoughtOfDay },
    duplicateReview: { ...base.duplicateReview, ...overrides.duplicateReview },
    entryForm: { ...base.entryForm, ...overrides.entryForm },
    filters: { ...base.filters, ...overrides.filters },
    entriesList: { ...base.entriesList, ...overrides.entriesList },
    pagination: { ...base.pagination, ...overrides.pagination },
    yearMonthNavigator: { ...base.yearMonthNavigator, ...overrides.yearMonthNavigator },
  };
};
