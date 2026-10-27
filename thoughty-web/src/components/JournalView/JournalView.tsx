import { useCallback, useRef, useState, type ComponentProps } from 'react';
import DiaryTabs from '../DiaryTabs/DiaryTabs';
import ThoughtOfTheDay from '../ThoughtOfTheDay/ThoughtOfTheDay';
import EntryForm from '../EntryForm/EntryForm';
import FilterControls from '../FilterControls/FilterControls';
import EntriesList from '../EntriesList/EntriesList';
import Pagination from '../Pagination/Pagination';
import YearMonthNavigator from '../YearMonthNavigator/YearMonthNavigator';
import BackToTopButton from '../BackToTopButton/BackToTopButton';
import DuplicateReview from '../DuplicateReview/DuplicateReview';
import SavedSearches from '../SavedSearches/SavedSearches';
import JournalCalendar from '../JournalCalendar/JournalCalendar';
import JournalLayoutSwitch from '../JournalCalendar/JournalLayoutSwitch';
import WritingStreakCard from '../WritingStreak/WritingStreakCard';
import { useJournalLayoutRoute } from '../JournalCalendar/useJournalLayoutRoute';
import type { Config, TranslationFunction } from '../../types';
import { resolveLanguage } from '../../utils/language';
import { formatEntryDate } from '../../utils/entryDate';
import { parseSavedSearchDate } from '../../utils/savedSearches';
import { useJournalKeyboardShortcuts } from './useJournalKeyboardShortcuts';

type DiaryTabsProps = Pick<ComponentProps<typeof DiaryTabs>, 'diaries' | 'currentDiaryId' | 'onDiaryChange' | 'onManageDiaries'>;
interface ThoughtOfDayProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  diaryId: number | null;
  onNavigateToEntry: ComponentProps<typeof ThoughtOfTheDay>['onNavigateToEntry'];
}
type EntryFormProps = Omit<ComponentProps<typeof EntryForm>, 'theme' | 't' | 'fontColor' | 'fontFamily' | 'fontSize' | 'language'>;
type FilterControlsProps = Omit<ComponentProps<typeof FilterControls>, 'theme' | 't' | 'onOpenHighlights' | 'actions'>;
type EntriesListProps = Omit<ComponentProps<typeof EntriesList>, 'config' | 't' | 'searchTerm'>;
type PaginationProps = Pick<ComponentProps<typeof Pagination>, 'page' | 'totalPages' | 'setPage' | 'inputPage' | 'setInputPage'>;
type YearMonthNavigatorProps = Pick<ComponentProps<typeof YearMonthNavigator>, 'availableYears' | 'availableMonths' | 'onNavigate'>;
type DuplicateReviewProps = Omit<ComponentProps<typeof DuplicateReview>, 'theme' | 'language' | 't'>;

interface JournalViewProps {
  diaryTabs: DiaryTabsProps;
  thoughtOfDay: ThoughtOfDayProps;
  entryForm: EntryFormProps;
  filters: FilterControlsProps;
  entriesList: EntriesListProps;
  pagination: PaginationProps;
  yearMonthNavigator: YearMonthNavigatorProps;
  duplicateReview: DuplicateReviewProps;
  onOpenRecycleBin: () => void;
  /** Shows a message in the app's notice toast. */
  onNotify: (message: string) => void;
  config: Config;
  t: TranslationFunction;
}

function JournalView({
  diaryTabs,
  thoughtOfDay,
  entryForm,
  filters,
  entriesList,
  pagination,
  yearMonthNavigator,
  duplicateReview,
  onOpenRecycleBin,
  onNotify,
  config,
  t
}: Readonly<JournalViewProps>) {
  const [navYear, setNavYear] = useState<string>('');
  const [navMonth, setNavMonth] = useState<string>('');
  const entryFormRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const closeHighlights = useCallback(() => {
    thoughtOfDay.setOpen(false);
  }, [thoughtOfDay]);
  const layoutRoute = useJournalLayoutRoute();
  const showCalendar = layoutRoute.layout === 'calendar';
  const language = resolveLanguage(config.language);
  const theme = config.theme ?? 'dark';

  useJournalKeyboardShortcuts({
    entryFormRef,
    searchRef,
    page: pagination.page,
    totalPages: pagination.totalPages,
    setPage: pagination.setPage,
    closeHighlights,
    highlightsOpen: thoughtOfDay.isOpen,
    pageKeysEnabled: !showCalendar,
  });

  const keywordSearch = filters.searchMode === 'keyword';
  const calendarFilters = {
    search: keywordSearch ? filters.search : '',
    tags: filters.filterTags,
    visibility: filters.filterVisibility,
    favorites: filters.filterFavorites,
    archiveStatus: filters.filterArchiveStatus,
    mood: filters.filterMood,
    diaryId: diaryTabs.currentDiaryId,
    entryIds: keywordSearch ? null : filters.semanticSearchResult?.matches.map((match) => match.entryId) ?? null,
  };
  /** A day of the calendar opens in the list as the date filter, keeping the other filters and the diary. */
  const openCalendarDay = (date: string) => {
    filters.setFilterDateObj(parseSavedSearchDate(date));
    filters.setPage(1);
    layoutRoute.setLayout('list');
  };

  return (
    <>
      <DiaryTabs
        {...diaryTabs}
        onDiaryChange={(id: number | null) => { diaryTabs.onDiaryChange(id); pagination.setPage(1); }}
        theme={config.theme}
        t={t}
      />

      <ThoughtOfTheDay
        isOpen={thoughtOfDay.isOpen}
        onClose={closeHighlights}
        diaryId={thoughtOfDay.diaryId}
        onNavigateToEntry={thoughtOfDay.onNavigateToEntry}
        theme={config.theme}
        t={t}
      />

      <WritingStreakCard
        diaryId={diaryTabs.currentDiaryId}
        enabled={config.streakCard !== false}
        onWriteNow={() => entryFormRef.current?.querySelector('textarea')?.focus()}
        onOpenEntry={layoutRoute.openEntry}
        language={language}
        theme={theme}
        t={t}
      />

      <div ref={entryFormRef}>
        <EntryForm
          {...entryForm}
          theme={config.theme}
          t={t}
          fontColor={config.fontColor}
          fontFamily={config.fontFamily}
          fontSize={config.fontSize}
          language={config.language}
        />
      </div>

      <div ref={searchRef}>
        <FilterControls
          {...filters}
          theme={config.theme}
          t={t}
          onOpenHighlights={() => thoughtOfDay.setOpen(true)}
          actions={(
            <>
              <SavedSearches
                filters={filters}
                currentDiaryId={diaryTabs.currentDiaryId}
                diaries={diaryTabs.diaries}
                theme={config.theme}
                t={t}
                notify={onNotify}
              />
              <DuplicateReview
                {...duplicateReview}
                theme={config.theme}
                language={language}
                t={t}
              />
              <button
                type="button"
                onClick={onOpenRecycleBin}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all ${config.theme === 'light'
                  ? 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  : 'border-gray-600 bg-gray-900 text-gray-300 hover:bg-gray-800'
                  }`}
                title={t('recycleBinOpenHint')}
              >
                <span className="codicon codicon-trash" aria-hidden="true" />
                {t('recycleBin')}
              </button>
            </>
          )}
        />
      </div>

      <div className="mb-4 flex justify-end">
        <JournalLayoutSwitch layout={layoutRoute.layout} onChange={layoutRoute.setLayout} theme={theme} t={t} />
      </div>

      {showCalendar ? (
        <JournalCalendar
          month={layoutRoute.month}
          onMonthChange={layoutRoute.setMonth}
          filters={calendarFilters}
          selectedDate={filters.filterDateObj ? formatEntryDate(filters.filterDateObj) : null}
          availableYears={yearMonthNavigator.availableYears}
          onOpenDay={openCalendarDay}
          onOpenEntry={(entry) => layoutRoute.openEntry(entry.id)}
          language={language}
          theme={theme}
          t={t}
        />
      ) : (
        <>
          <EntriesList
            {...entriesList}
            config={config}
            searchTerm={filters.searchMode === 'keyword' ? filters.search : undefined}
            t={t}
          />

          <Pagination
            {...pagination}
            theme={config.theme}
            t={t}
          />

          <YearMonthNavigator
            availableYears={yearMonthNavigator.availableYears}
            availableMonths={yearMonthNavigator.availableMonths}
            navYear={navYear}
            setNavYear={setNavYear}
            navMonth={navMonth}
            setNavMonth={setNavMonth}
            onNavigate={yearMonthNavigator.onNavigate}
            config={config}
            t={t}
          />

          {entriesList.entries.length > 0 && <BackToTopButton theme={config.theme} t={t} />}
        </>
      )}
    </>
  );
}

export default JournalView;
