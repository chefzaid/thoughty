import { useCallback, useRef, useState, type ComponentProps } from 'react';
import DiaryTabs from '../DiaryTabs/DiaryTabs';
import ThoughtOfTheDay from '../ThoughtOfTheDay/ThoughtOfTheDay';
import EntryForm from '../EntryForm/EntryForm';
import FilterControls from '../FilterControls/FilterControls';
import EntriesList from '../EntriesList/EntriesList';
import Pagination from '../Pagination/Pagination';
import YearMonthNavigator from '../YearMonthNavigator/YearMonthNavigator';
import BackToTopButton from '../BackToTopButton/BackToTopButton';
import type { Config } from '../../types';
import { useJournalKeyboardShortcuts } from './useJournalKeyboardShortcuts';

type DiaryTabsProps = Pick<ComponentProps<typeof DiaryTabs>, 'diaries' | 'currentDiaryId' | 'onDiaryChange' | 'onManageDiaries'>;
interface ThoughtOfDayProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  diaryId: number | null;
  onNavigateToEntry: ComponentProps<typeof ThoughtOfTheDay>['onNavigateToEntry'];
}
type EntryFormProps = Omit<ComponentProps<typeof EntryForm>, 'theme' | 't' | 'fontColor'>;
type FilterControlsProps = Omit<ComponentProps<typeof FilterControls>, 'theme' | 't' | 'onOpenHighlights'>;
type EntriesListProps = Omit<ComponentProps<typeof EntriesList>, 'config' | 't' | 'searchTerm'>;
type PaginationProps = Pick<ComponentProps<typeof Pagination>, 'page' | 'totalPages' | 'setPage' | 'inputPage' | 'setInputPage'>;
type YearMonthNavigatorProps = Pick<ComponentProps<typeof YearMonthNavigator>, 'availableYears' | 'availableMonths' | 'onNavigate'>;
type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

interface JournalViewProps {
  diaryTabs: DiaryTabsProps;
  thoughtOfDay: ThoughtOfDayProps;
  entryForm: EntryFormProps;
  filters: FilterControlsProps;
  entriesList: EntriesListProps;
  pagination: PaginationProps;
  yearMonthNavigator: YearMonthNavigatorProps;
  config: Config;
  t: TranslationFn;
}

function JournalView({
  diaryTabs,
  thoughtOfDay,
  entryForm,
  filters,
  entriesList,
  pagination,
  yearMonthNavigator,
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
        />
      </div>

      <div ref={searchRef}>
        <FilterControls
          {...filters}
          theme={config.theme}
          t={t}
          onOpenHighlights={() => thoughtOfDay.setOpen(true)}
        />
      </div>

      <EntriesList
        {...entriesList}
        config={config}
        searchTerm={filters.search}
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

      <BackToTopButton t={t} />
    </>
  );
}

export default JournalView;
