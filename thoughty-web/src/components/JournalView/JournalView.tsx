import { useState, type ComponentPropsWithoutRef, type Dispatch, type SetStateAction } from 'react';
import DiaryTabs from '../DiaryTabs/DiaryTabs';
import ThoughtOfTheDay from '../ThoughtOfTheDay/ThoughtOfTheDay';
import EntryForm from '../EntryForm/EntryForm';
import FilterControls from '../FilterControls/FilterControls';
import EntriesList from '../EntriesList/EntriesList';
import Pagination from '../Pagination/Pagination';
import YearMonthNavigator from '../YearMonthNavigator/YearMonthNavigator';
import BackToTopButton from '../BackToTopButton/BackToTopButton';
import type { Entry, Diary, Config, GroupedEntries, SourceEntryInfo, VisibilityFilter, Attachment, EntryRevision } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';

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
  format: 'plain' | 'markdown';
  setFormat: Dispatch<SetStateAction<'plain' | 'markdown'>>;
  allTags: string[];
  tagMetadata?: TagMetadataMap;
  formError: string;
  suggestingTags?: boolean;
  onSuggestTags?: () => Promise<boolean> | boolean;
  fixingWriting?: boolean;
  onFixWriting?: () => Promise<boolean> | boolean;
  onSubmit: NonNullable<ComponentPropsWithoutRef<'form'>['onSubmit']>;
  
  // Attachments
  pendingFiles?: File[];
  uploadedAttachments?: Attachment[];
  onAddFile?: (file: File) => void;
  onRemovePendingFile?: (index: number) => void;
  onRemoveUploadedAttachment?: (id: number) => void;
  
  // Filters
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  filterTags: string[];
  setFilterTags: Dispatch<SetStateAction<string[]>>;
  filterDateObj: Date | null;
  setFilterDateObj: Dispatch<SetStateAction<Date | null>>;
  filterVisibility: VisibilityFilter;
  setFilterVisibility: Dispatch<SetStateAction<VisibilityFilter>>;
  filterFavorites: boolean;
  setFilterFavorites: Dispatch<SetStateAction<boolean>>;
  setPage: Dispatch<SetStateAction<number>>;
  
  // Entries list
  loading: boolean;
  entries: Entry[];
  groupedEntries: GroupedEntries;
  onEdit: (entry: Entry) => void;
  onDelete: (id: number) => void;
  onToggleVisibility: (entry: Entry) => void;
  onToggleFavorite: (entry: Entry) => void;
  editingEntry: Entry | null;
  editText: string;
  setEditText: Dispatch<SetStateAction<string>>;
  editTags: string[];
  setEditTags: Dispatch<SetStateAction<string[]>>;
  editDate: Date | null;
  setEditDate: Dispatch<SetStateAction<Date | null>>;
  editVisibility: 'public' | 'private';
  setEditVisibility: Dispatch<SetStateAction<'public' | 'private'>>;
  editFormat: 'plain' | 'markdown';
  setEditFormat: Dispatch<SetStateAction<'plain' | 'markdown'>>;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  editPendingFiles?: File[];
  editExistingAttachments?: Attachment[];
  onAddEditFile?: (file: File) => void;
  onRemoveEditPendingFile?: (index: number) => void;
  onRemoveEditAttachment?: (id: number) => void;
  onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
  onShareEntry?: (entry: Entry) => Promise<boolean>;
  getEntryPermalink?: (entryId: number) => string;
  sourceEntry: SourceEntryInfo | null;
  targetEntryId: number | null;
  activeTargetId: number | null;
  onBackToSource: () => void;
  
  // Bulk operations
  bulkMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onSelectAll?: (ids: number[]) => void;
  onClearSelection?: () => void;
  onBulkAction?: (action: 'delete' | 'visibility' | 'tags' | 'move', options?: { visibility?: 'public' | 'private'; tags?: string[]; diaryId?: number }) => void;
  onToggleBulkMode?: () => void;
  
  // Pagination
  page: number;
  totalPages: number;
  inputPage: string;
  setInputPage: Dispatch<SetStateAction<string>>;
  
  // Navigation
  availableYears: number[];
  availableMonths: string[];
  onNavigateToFirst: (year: number, month: number | null) => void;
  
  // History
  onFetchHistory?: (entryId: number) => Promise<EntryRevision[]>;
  onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
  
  // Reorder
  onReorderEntries?: (date: string, orderedIds: number[]) => void;
  
  // AI Chat
  onDiscuss?: (entry: Entry) => void;
  
  // Config
  config: Config;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function JournalView({
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
  format,
  setFormat,
  allTags,
  tagMetadata,
  formError,
  suggestingTags,
  onSuggestTags,
  fixingWriting,
  onFixWriting,
  onSubmit,
  pendingFiles,
  uploadedAttachments,
  onAddFile,
  onRemovePendingFile,
  onRemoveUploadedAttachment,
  search,
  setSearch,
  filterTags,
  setFilterTags,
  filterDateObj,
  setFilterDateObj,
  filterVisibility,
  setFilterVisibility,
  filterFavorites,
  setFilterFavorites,
  setPage,
  loading,
  entries,
  groupedEntries,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleFavorite,
  editingEntry,
  editText,
  setEditText,
  editTags,
  setEditTags,
  editDate,
  setEditDate,
  editVisibility,
  setEditVisibility,
  editFormat,
  setEditFormat,
  onSaveEdit,
  onCancelEdit,
  editPendingFiles,
  editExistingAttachments,
  onAddEditFile,
  onRemoveEditPendingFile,
  onRemoveEditAttachment,
  onNavigateToEntry,
  onShareEntry,
  getEntryPermalink,
  sourceEntry,
  targetEntryId,
  activeTargetId,
  onBackToSource,
  bulkMode,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkAction,
  onToggleBulkMode,
  page,
  totalPages,
  inputPage,
  setInputPage,
  availableYears,
  availableMonths,
  onNavigateToFirst,
  onFetchHistory,
  onDeleteRevision,
  onReorderEntries,
  onDiscuss,
  config,
  t
}: Readonly<JournalViewProps>) {
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
        format={format}
        setFormat={setFormat}
        allTags={allTags}
        tagMetadata={tagMetadata}
        formError={formError}
        suggestingTags={suggestingTags}
        onSuggestTags={onSuggestTags}
        fixingWriting={fixingWriting}
        onFixWriting={onFixWriting}
        onSubmit={onSubmit}
        theme={config.theme}
        t={t}
        pendingFiles={pendingFiles}
        uploadedAttachments={uploadedAttachments}
        onAddFile={onAddFile}
        onRemovePendingFile={onRemovePendingFile}
        onRemoveUploadedAttachment={onRemoveUploadedAttachment}
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
        filterFavorites={filterFavorites}
        setFilterFavorites={setFilterFavorites}
        allTags={allTags}
        tagMetadata={tagMetadata}
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
        onToggleFavorite={onToggleFavorite}
        editingEntry={editingEntry}
        editText={editText}
        setEditText={setEditText}
        editTags={editTags}
        setEditTags={setEditTags}
        editDate={editDate}
        setEditDate={setEditDate}
        editVisibility={editVisibility}
        setEditVisibility={setEditVisibility}
        editFormat={editFormat}
        setEditFormat={setEditFormat}
        allTags={allTags}
        tagMetadata={tagMetadata}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        editPendingFiles={editPendingFiles}
        editExistingAttachments={editExistingAttachments}
        onAddEditFile={onAddEditFile}
        onRemoveEditPendingFile={onRemoveEditPendingFile}
        onRemoveEditAttachment={onRemoveEditAttachment}
        onNavigateToEntry={onNavigateToEntry}
        onShareEntry={onShareEntry}
        getEntryPermalink={getEntryPermalink}
        sourceEntry={sourceEntry}
        targetEntryId={targetEntryId}
        activeTargetId={activeTargetId}
        onBackToSource={onBackToSource}
        searchTerm={search}
        bulkMode={bulkMode}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
        onBulkAction={onBulkAction}
        onToggleBulkMode={onToggleBulkMode}
        diaries={diaries}
        onFetchHistory={onFetchHistory}
        onDeleteRevision={onDeleteRevision}
        onReorderEntries={onReorderEntries}
        onDiscuss={onDiscuss}
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
}

export default JournalView;
