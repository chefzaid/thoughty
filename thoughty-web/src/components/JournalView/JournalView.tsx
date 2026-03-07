import React, { useState, Dispatch, SetStateAction } from 'react';
import DiaryTabs from '../DiaryTabs/DiaryTabs';
import ThoughtOfTheDay from '../ThoughtOfTheDay/ThoughtOfTheDay';
import EntryForm from '../EntryForm/EntryForm';
import FilterControls from '../FilterControls/FilterControls';
import EntriesList from '../EntriesList/EntriesList';
import Pagination from '../Pagination/Pagination';
import YearMonthNavigator from '../YearMonthNavigator/YearMonthNavigator';
import BackToTopButton from '../BackToTopButton/BackToTopButton';
import type { Entry, Diary, Config, GroupedEntries, SourceEntryInfo, VisibilityFilter } from '../../types';

interface JournalViewProps {
  // Diaries
  diaries: Diary[];
  currentDiaryId: number | null;
  onDiaryChange: (id: number | null) => void;
  onManageDiaries: () => void;
  
  // Highlights
  highlightsModalOpen: boolean;
  setHighlightsModalOpen: (open: boolean) => void;
  
  // Entry form
  newEntryText: string;
  setNewEntryText: Dispatch<SetStateAction<string>>;
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  tags: string[];
  setTags: Dispatch<SetStateAction<string[]>>;
  visibility: 'public' | 'private' | null;
  setVisibility: Dispatch<SetStateAction<'public' | 'private' | null>>;
  allTags: string[];
  formError: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  
  // Filters
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  filterTags: string[];
  setFilterTags: Dispatch<SetStateAction<string[]>>;
  filterDateObj: Date | null;
  setFilterDateObj: Dispatch<SetStateAction<Date | null>>;
  filterVisibility: VisibilityFilter;
  setFilterVisibility: Dispatch<SetStateAction<VisibilityFilter>>;
  entryDates: string[];
  setPage: Dispatch<SetStateAction<number>>;
  
  // Entries list
  loading: boolean;
  entries: Entry[];
  groupedEntries: GroupedEntries;
  onEdit: (entry: Entry) => void;
  onDelete: (id: number) => void;
  onToggleVisibility: (entry: Entry) => void;
  editingEntry: Entry | null;
  editText: string;
  setEditText: Dispatch<SetStateAction<string>>;
  editTags: string[];
  setEditTags: Dispatch<SetStateAction<string[]>>;
  editDate: Date | null;
  setEditDate: Dispatch<SetStateAction<Date | null>>;
  editVisibility: 'public' | 'private';
  setEditVisibility: Dispatch<SetStateAction<'public' | 'private'>>;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
  sourceEntry: SourceEntryInfo | null;
  activeTargetId: number | null;
  onBackToSource: () => void;
  
  // Pagination
  page: number;
  totalPages: number;
  inputPage: string;
  setInputPage: Dispatch<SetStateAction<string>>;
  
  // Navigation
  availableYears: number[];
  availableMonths: string[];
  onNavigateToFirst: (year: number, month: number | null) => void;
  
  // Config
  config: Config;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const JournalView: React.FC<JournalViewProps> = ({
  diaries,
  currentDiaryId,
  onDiaryChange,
  onManageDiaries,
  highlightsModalOpen,
  setHighlightsModalOpen,
  newEntryText,
  setNewEntryText,
  selectedDate,
  setSelectedDate,
  tags,
  setTags,
  visibility,
  setVisibility,
  allTags,
  formError,
  onSubmit,
  search,
  setSearch,
  filterTags,
  setFilterTags,
  filterDateObj,
  setFilterDateObj,
  filterVisibility,
  setFilterVisibility,
  entryDates,
  setPage,
  loading,
  entries,
  groupedEntries,
  onEdit,
  onDelete,
  onToggleVisibility,
  editingEntry,
  editText,
  setEditText,
  editTags,
  setEditTags,
  editDate,
  setEditDate,
  editVisibility,
  setEditVisibility,
  onSaveEdit,
  onCancelEdit,
  onNavigateToEntry,
  sourceEntry,
  activeTargetId,
  onBackToSource,
  page,
  totalPages,
  inputPage,
  setInputPage,
  availableYears,
  availableMonths,
  onNavigateToFirst,
  config,
  t
}) => {
  const [navYear, setNavYear] = useState<string>('');
  const [navMonth, setNavMonth] = useState<string>('');

  return (
    <>
      <DiaryTabs
        diaries={diaries}
        currentDiaryId={currentDiaryId}
        onDiaryChange={(id: number | null) => { onDiaryChange(id); setPage(1); }}
        onManageDiaries={onManageDiaries}
        theme={config.theme}
        t={t}
      />

      <ThoughtOfTheDay
        isOpen={highlightsModalOpen}
        onClose={() => setHighlightsModalOpen(false)}
        theme={config.theme}
        t={t}
        diaryId={currentDiaryId}
        onNavigateToEntry={onNavigateToEntry}
      />

      <EntryForm
        newEntryText={newEntryText}
        setNewEntryText={setNewEntryText}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        tags={tags}
        setTags={setTags}
        visibility={visibility}
        setVisibility={setVisibility}
        allTags={allTags}
        formError={formError}
        onSubmit={onSubmit}
        theme={config.theme}
        t={t}
      />

      <FilterControls
        search={search}
        setSearch={setSearch}
        filterTags={filterTags}
        setFilterTags={setFilterTags}
        filterDateObj={filterDateObj}
        setFilterDateObj={setFilterDateObj}
        filterVisibility={filterVisibility}
        setFilterVisibility={setFilterVisibility}
        allTags={allTags}
        entryDates={entryDates}
        setPage={setPage}
        theme={config.theme}
        t={t}
        onOpenHighlights={() => setHighlightsModalOpen(true)}
      />

      <EntriesList
        loading={loading}
        entries={entries}
        groupedEntries={groupedEntries}
        config={config}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleVisibility={onToggleVisibility}
        editingEntry={editingEntry}
        editText={editText}
        setEditText={setEditText}
        editTags={editTags}
        setEditTags={setEditTags}
        editDate={editDate}
        setEditDate={setEditDate}
        editVisibility={editVisibility}
        setEditVisibility={setEditVisibility}
        allTags={allTags}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        onNavigateToEntry={onNavigateToEntry}
        sourceEntry={sourceEntry}
        activeTargetId={activeTargetId}
        onBackToSource={onBackToSource}
        t={t}
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        setPage={setPage}
        inputPage={inputPage}
        setInputPage={setInputPage}
        theme={config.theme}
        t={t}
      />

      <YearMonthNavigator
        availableYears={availableYears}
        availableMonths={availableMonths}
        navYear={navYear}
        setNavYear={setNavYear}
        navMonth={navMonth}
        setNavMonth={setNavMonth}
        onNavigate={onNavigateToFirst}
        config={config}
        t={t}
      />

      <BackToTopButton t={t} />
    </>
  );
};

export default JournalView;
