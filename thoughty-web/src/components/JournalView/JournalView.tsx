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
import type { Config, TranslationFunction } from '../../types';
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
type DuplicateReviewProps = Omit<ComponentProps<typeof DuplicateReview>, 'theme' | 't'>;

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

  useJournalKeyboardShortcuts({
    entryFormRef,
    searchRef,
    page: pagination.page,
    totalPages: pagination.totalPages,
    setPage: pagination.setPage,
    closeHighlights,
    highlightsOpen: thoughtOfDay.isOpen,
  });

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
              <DuplicateReview
                {...duplicateReview}
                theme={config.theme}
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

      {entriesList.entries.length > 0 && <BackToTopButton t={t} />}
    </>
  );
}

export default JournalView;
