import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
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
import { useLifeEraList } from '../LifeEras/useLifeEras';
import { MentionPeopleContext } from '../People/PeopleContext';
import { usePeopleList } from '../People/usePeople';
import { peopleByHandle } from '../../utils/mentions';
import PersonFilterBanner from './PersonFilterBanner';
import { usePersonFilterRoute } from './usePersonFilterRoute';
import { useComposerSeed } from './useComposerSeed';
import { useComposerFocusRoute } from './composerFocusRoute';
import RandomEntryButton from './RandomEntryButton';
import EntryReader from '../EntryReader/EntryReader';
import ReadEntriesButton from '../EntryReader/ReadEntriesButton';
import { useEntryReaderRoute } from '../EntryReader/useEntryReaderRoute';
import { readerScopeFromList, readerScopeOfMonth } from '../../services/api/entryReaderService';
import ComfortReadsCard from '../ComfortReads/ComfortReadsCard';
import type { SavedEntry } from '../ComfortReads/comfortReadsState';

type DiaryTabsProps = Pick<ComponentProps<typeof DiaryTabs>, 'diaries' | 'currentDiaryId' | 'onDiaryChange' | 'onManageDiaries'>;
interface ThoughtOfDayProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  diaryId: number | null;
  onNavigateToEntry: ComponentProps<typeof ThoughtOfTheDay>['onNavigateToEntry'];
}
type EntryFormProps = Omit<
  ComponentProps<typeof EntryForm>,
  'theme' | 't' | 'fontColor' | 'lineSpacing' | 'letterSpacing' | 'fontFamily' | 'fontSize' | 'language'
>;
type FilterControlsProps = Omit<ComponentProps<typeof FilterControls>, 'theme' | 't' | 'onOpenHighlights' | 'actions' | 'eras' | 'onManageEras' | 'people' | 'onManagePeople'>;
type EntriesListProps = Omit<ComponentProps<typeof EntriesList>, 'config' | 't' | 'searchTerm'>;
type PaginationProps = Pick<ComponentProps<typeof Pagination>, 'page' | 'totalPages' | 'setPage' | 'inputPage' | 'setInputPage' | 'pageSize' | 'onPageSizeChange'>;
type YearMonthNavigatorProps = Pick<ComponentProps<typeof YearMonthNavigator>, 'availableYears' | 'availableMonths' | 'onNavigate'>;
type DuplicateReviewProps = Omit<ComponentProps<typeof DuplicateReview>, 'theme' | 'language' | 't'>;
type RandomEntryProps = Pick<ComponentProps<typeof RandomEntryButton>, 'query' | 'listEmpty' | 'onOpen'>;

interface JournalViewProps {
  diaryTabs: DiaryTabsProps;
  thoughtOfDay: ThoughtOfDayProps;
  entryForm: EntryFormProps;
  filters: FilterControlsProps;
  entriesList: EntriesListProps;
  pagination: PaginationProps;
  yearMonthNavigator: YearMonthNavigatorProps;
  duplicateReview: DuplicateReviewProps;
  randomEntry: RandomEntryProps;
  /** The entry the composer saved last, which a very low mood answers with an offer of comfort reads. */
  savedEntry?: SavedEntry | null;
  onOpenRecycleBin: () => void;
  /** Opens the profile's life eras. */
  onManageLifeEras: () => void;
  /** Opens the People page. */
  onManagePeople: () => void;
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
  randomEntry,
  savedEntry = null,
  onOpenRecycleBin,
  onManageLifeEras,
  onManagePeople,
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
  const reader = useEntryReaderRoute();
  const showCalendar = layoutRoute.layout === 'calendar';
  const language = resolveLanguage(config.language);
  const theme = config.theme ?? 'dark';
  const { list: eraList, eras } = useLifeEraList();
  const selectedEra = eras.find((era) => era.id === filters.filterEraId) ?? null;
  // An era deleted meanwhile (in the profile, or on another device) stops narrowing the journal
  const { filterEraId, setFilterEraId } = filters;
  const eraGone = eraList.isSuccess === true && filterEraId !== null && selectedEra === null;
  useEffect(() => {
    if (eraGone) setFilterEraId(null);
  }, [eraGone, setFilterEraId]);

  const { list: peopleList, people } = usePeopleList();
  const mentionPeople = useMemo(() => ({ people, byHandle: peopleByHandle(people) }), [people]);
  usePersonFilterRoute(filters);
  const { filterPersonId, setFilterPersonId } = filters;
  const selectedPerson = people.find((person) => person.id === filterPersonId) ?? null;
  // A person deleted or merged meanwhile (or a link to one) stops narrowing the journal
  const personGone = peopleList.isSuccess === true && filterPersonId !== null && selectedPerson === null;
  useEffect(() => {
    if (!personGone) return;
    setFilterPersonId(null);
    onNotify(t('apiError_PERSON_NOT_FOUND'));
  }, [onNotify, personGone, setFilterPersonId, t]);

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

  const composerSeed = useComposerSeed({
    composer: entryForm,
    defaultVisibility: config.defaultVisibility,
    formRef: entryFormRef,
    language: config.language,
    theme: config.theme,
    t,
  });
  useComposerFocusRoute(composerSeed.focusComposer);

  const keywordSearch = filters.searchMode === 'keyword';
  const calendarFilters = {
    search: keywordSearch ? filters.search : '',
    tags: filters.filterTags,
    visibility: filters.filterVisibility,
    favorites: filters.filterFavorites,
    archiveStatus: filters.filterArchiveStatus,
    mood: filters.filterMood,
    eraId: filters.filterEraId,
    personId: filters.filterPersonId,
    diaryId: diaryTabs.currentDiaryId,
    entryIds: keywordSearch ? null : filters.semanticSearchResult?.matches.map((match) => match.entryId) ?? null,
  };
  /** A day of the calendar opens in the list as the date filter, keeping the other filters and the diary. */
  const openCalendarDay = (date: string) => {
    filters.setFilterDateObj(parseSavedSearchDate(date));
    filters.setPage(1);
    layoutRoute.setLayout('list');
  };
  /** The reader reads the list's entries as they are filtered now, or a month of the calendar. */
  const readCurrentFilters = () => reader.open(readerScopeFromList(randomEntry.query));
  const readMonth = (month: string) => reader.open(readerScopeOfMonth({ ...calendarFilters, month }));
  /** An offered comfort read opens in the reader, which turns through the entries offered, archived or not. */
  const readComfortEntry = (entryId: number, offeredIds: readonly number[]) =>
    reader.open(new URLSearchParams({ ids: offeredIds.join(','), archiveStatus: 'all' }).toString(), entryId);
  /** A random entry opens in the list, on its page among the same filters. */
  const openRandomEntry = (entryId: number, page: number) => {
    if (showCalendar) layoutRoute.setLayout('list');
    randomEntry.onOpen(entryId, page);
  };

  return (
    <MentionPeopleContext.Provider value={mentionPeople}>
      {/* The diary tabs are the journal's visible header; the title is there for screen readers. */}
      <h1 className="sr-only">{t('journal')}</h1>
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
        language={language}
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
          lineSpacing={config.lineSpacing}
          letterSpacing={config.letterSpacing}
          fontFamily={config.fontFamily}
          fontSize={config.fontSize}
          language={config.language}
        />
      </div>
      {composerSeed.dialog}

      <ComfortReadsCard
        saved={savedEntry}
        enabled={config.comfortReads !== false}
        onOpenEntry={readComfortEntry}
        language={language}
        theme={theme}
        t={t}
      />

      <div ref={searchRef}>
        <FilterControls
          {...filters}
          eras={eras}
          onManageEras={onManageLifeEras}
          people={people}
          onManagePeople={onManagePeople}
          theme={config.theme}
          t={t}
          onOpenHighlights={() => thoughtOfDay.setOpen(true)}
          actions={(
            <>
              <ReadEntriesButton
                listEmpty={randomEntry.listEmpty}
                onRead={readCurrentFilters}
                theme={config.theme}
                t={t}
              />
              <RandomEntryButton
                query={randomEntry.query}
                listEmpty={randomEntry.listEmpty}
                onOpen={openRandomEntry}
                onNotify={onNotify}
                language={language}
                theme={config.theme}
                t={t}
              />
              <SavedSearches
                filters={filters}
                currentDiaryId={diaryTabs.currentDiaryId}
                diaries={diaryTabs.diaries}
                eras={eras}
                people={people}
                theme={config.theme}
                language={language}
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

      {selectedPerson && (
        <PersonFilterBanner
          person={selectedPerson}
          onClear={() => { setFilterPersonId(null); filters.setPage(1); }}
          onNotify={onNotify}
          language={language}
          theme={theme}
          t={t}
        />
      )}

      <div className="mb-4 flex justify-end">
        <JournalLayoutSwitch layout={layoutRoute.layout} onChange={layoutRoute.setLayout} theme={theme} t={t} />
      </div>

      {showCalendar ? (
        <JournalCalendar
          month={layoutRoute.month}
          onMonthChange={layoutRoute.setMonth}
          filters={calendarFilters}
          era={selectedEra}
          selectedDate={filters.filterDateObj ? formatEntryDate(filters.filterDateObj) : null}
          availableYears={yearMonthNavigator.availableYears}
          onOpenDay={openCalendarDay}
          onOpenEntry={(entry) => layoutRoute.openEntry(entry.id)}
          onReadMonth={readMonth}
          language={language}
          theme={theme}
          t={t}
        />
      ) : (
        <>
          <EntriesList
            {...entriesList}
            onUseAsStartingPoint={composerSeed.startFromEntry}
            onReply={composerSeed.replyToEntry}
            config={config}
            searchTerm={filters.searchMode === 'keyword' ? filters.search : undefined}
            t={t}
          />

          <Pagination
            {...pagination}
            pageEntryCount={entriesList.entries.length}
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

      {reader.isOpen && (
        <EntryReader
          scope={reader.scope}
          entryId={reader.entryId}
          onShow={reader.show}
          onClose={reader.close}
          config={config}
          t={t}
        />
      )}
    </MentionPeopleContext.Provider>
  );
}

export default JournalView;
