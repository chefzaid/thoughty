import { useMemo, useState as useLocalState, type Dispatch, type SetStateAction } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import MDEditor from '@uiw/react-md-editor';
import TagPicker from '../TagPicker/TagPicker';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import ListenButton from '../ListenButton/ListenButton';
import { useSpeech, type SpeechEntry } from '../../hooks/useSpeech';
import AttachmentDisplay from '../AttachmentDisplay/AttachmentDisplay';
import AttachmentUpload from '../AttachmentUpload/AttachmentUpload';
import type { Attachment } from '../../types';

interface Entry {
    id: number;
    content: string;
    tags: string[];
    date: string;
    visibility: 'public' | 'private';
    format?: 'plain' | 'markdown';
    index?: number;
    attachments?: Attachment[];
}

interface Config {
    theme?: 'light' | 'dark';
    language?: string;
    readDates?: boolean;
}

interface GroupedEntries {
    [date: string]: Entry[];
}

interface SourceEntryInfo {
    id: number;
    date: string;
    index: number;
}

interface Diary {
    id: number;
    name: string;
    icon: string;
}

interface EntriesListProps {
    loading: boolean;
    entries: Entry[];
    groupedEntries: GroupedEntries;
    config: Config;
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
    editFormat: 'plain' | 'markdown';
    setEditFormat: Dispatch<SetStateAction<'plain' | 'markdown'>>;
    allTags: string[];
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    editPendingFiles?: File[];
    editExistingAttachments?: Attachment[];
    onAddEditFile?: (file: File) => void;
    onRemoveEditPendingFile?: (index: number) => void;
    onRemoveEditAttachment?: (id: number) => void;
    onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    sourceEntry: SourceEntryInfo | null;
    activeTargetId: number | null;
    onBackToSource: () => void;
    searchTerm?: string;
    bulkMode?: boolean;
    selectedIds?: Set<number>;
    onToggleSelect?: (id: number) => void;
    onSelectAll?: (ids: number[]) => void;
    onClearSelection?: () => void;
    onBulkAction?: (action: 'delete' | 'visibility' | 'tags' | 'move', options?: { visibility?: 'public' | 'private'; tags?: string[]; diaryId?: number }) => void;
    onToggleBulkMode?: () => void;
    diaries?: Diary[];
    t: (key: string, params?: Record<string, string | number>) => string;
}

const extractDate = (date: string): string =>
    date.includes('T') ? (date.split('T')[0] ?? date) : date;

const GlobeIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LockIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
);

const VisibilityIcon = ({ visibility }: { visibility: 'public' | 'private' }) =>
    visibility === 'public' ? <GlobeIcon /> : <LockIcon />;

function getVisibilityButtonClass(editVisibility: 'public' | 'private', theme?: 'light' | 'dark'): string {
    if (editVisibility === 'public') {
        return 'border-green-500 bg-green-500/10 text-green-500';
    }
    return theme === 'light'
        ? 'border-gray-300 bg-gray-50 text-gray-500'
        : 'border-gray-600 bg-gray-800 text-gray-400';
}

function getBulkModeButtonClass(isDark: boolean): string {
    return isDark
        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300';
}

function getSelectedRingClass(isDark: boolean): string {
    return isDark ? 'ring-2 ring-blue-500/50' : 'ring-2 ring-blue-400/50';
}

function EditForm({
    config, editText, setEditText, editDate, setEditDate,
    allTags, editTags, setEditTags, editVisibility, setEditVisibility,
    editFormat, setEditFormat,
    editPendingFiles, editExistingAttachments, onAddEditFile, onRemoveEditPendingFile, onRemoveEditAttachment,
    onSaveEdit, onCancelEdit, t
}: Readonly<{
    config: Config;
    editText: string;
    setEditText: Dispatch<SetStateAction<string>>;
    editDate: Date | null;
    setEditDate: Dispatch<SetStateAction<Date | null>>;
    allTags: string[];
    editTags: string[];
    setEditTags: Dispatch<SetStateAction<string[]>>;
    editVisibility: 'public' | 'private';
    setEditVisibility: Dispatch<SetStateAction<'public' | 'private'>>;
    editFormat: 'plain' | 'markdown';
    setEditFormat: Dispatch<SetStateAction<'plain' | 'markdown'>>;
    editPendingFiles?: File[];
    editExistingAttachments?: Attachment[];
    onAddEditFile?: (file: File) => void;
    onRemoveEditPendingFile?: (index: number) => void;
    onRemoveEditAttachment?: (id: number) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    t: (key: string) => string;
}>) {
    const isDark = config.theme !== 'light';
    const inputClass = isDark
        ? 'bg-gray-900 border-gray-700 text-gray-100'
        : 'bg-gray-50 border-gray-300 text-gray-900';

    return (
        <div className="space-y-4">
            <div>
                {editFormat === 'markdown' ? (
                    <div data-color-mode={isDark ? 'dark' : 'light'}>
                        <MDEditor
                            value={editText}
                            onChange={(val) => setEditText(val ?? '')}
                            preview="edit"
                            visibleDragbar={false}
                            height={200}
                        />
                    </div>
                ) : (
                    <textarea
                        className={`w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none ${inputClass}`}
                        rows={3}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                    />
                )}
            </div>
            <div className="flex flex-wrap gap-3">
                <div className="w-40">
                    <DatePicker
                        selected={editDate}
                        onChange={(date: Date | null) => setEditDate(date)}
                        className={`w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${inputClass}`}
                        dateFormat="yyyy-MM-dd"
                    />
                </div>
                <div className="flex-1">
                    <TagPicker
                        availableTags={allTags}
                        selectedTags={editTags}
                        onChange={setEditTags}
                        placeholder={t('filterTagsPlaceholder').replace('Filter by ', '')}
                        theme={config.theme}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setEditFormat(f => f === 'plain' ? 'markdown' : 'plain')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${editFormat === 'markdown'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                        : config.theme === 'light'
                            ? 'border-gray-300 bg-gray-50 text-gray-500'
                            : 'border-gray-600 bg-gray-800 text-gray-400'
                        }`}
                    title={editFormat === 'markdown' ? t('markdownEnabled') : t('markdownDisabled')}
                >
                    <span className="text-sm font-bold" style={{ fontFamily: 'monospace' }}>MD</span>
                </button>
                {onAddEditFile && (
                    <AttachmentUpload
                        pendingFiles={editPendingFiles || []}
                        uploadedAttachments={editExistingAttachments || []}
                        onAddFile={onAddEditFile}
                        onRemovePendingFile={onRemoveEditPendingFile || (() => {})}
                        onRemoveUploadedAttachment={onRemoveEditAttachment || (() => {})}
                        theme={config.theme}
                        t={t}
                    />
                )}
                <button
                    type="button"
                    onClick={() => setEditVisibility(v => v === 'private' ? 'public' : 'private')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${getVisibilityButtonClass(editVisibility, config.theme)}`}
                    title={editVisibility === 'public' ? t('public') : t('private')}
                >
                    <VisibilityIcon visibility={editVisibility} />
                </button>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onSaveEdit}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    {t('save')}
                </button>
                <button
                    onClick={onCancelEdit}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    {t('cancel')}
                </button>
            </div>
        </div>
    );
}

function BackToSourceButton({ sourceEntry, onBackToSource, t }: Readonly<{
    sourceEntry: SourceEntryInfo;
    onBackToSource: () => void;
    t: (key: string) => string;
}>) {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onBackToSource();
            }}
            className="text-xs text-blue-500 hover:text-blue-600 hover:underline mr-2 flex items-center gap-1"
            title={t('backToSource')}
        >
            <span>&larr;</span>
            <span>
                {t('backToSource')}
                {Boolean(sourceEntry.date) && Boolean(sourceEntry.index) && (
                    <span className="ml-1 opacity-75">
                        ({sourceEntry.date}{sourceEntry.index > 1 ? `--${sourceEntry.index}` : ''})
                    </span>
                )}
            </span>
        </button>
    );
}

function EntryViewMode({
    entry, config, speaking, activeEntryId, activeTargetId, sourceEntry,
    flatEntries, speakEntry: speak, speakFromEntry: speakFrom, stop,
    onToggleVisibility, onEdit, onDelete, onNavigateToEntry, onBackToSource, searchTerm, t
}: Readonly<{
    entry: Entry;
    config: Config;
    speaking: boolean;
    activeEntryId: number | null;
    activeTargetId: number | null;
    sourceEntry: SourceEntryInfo | null;
    flatEntries: SpeechEntry[];
    speakEntry: (e: SpeechEntry) => void;
    speakFromEntry: (entries: SpeechEntry[], id: number) => void;
    stop: () => void;
    onToggleVisibility: (entry: Entry) => void;
    onEdit: (entry: Entry) => void;
    onDelete: (id: number) => void;
    onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    onBackToSource: () => void;
    searchTerm?: string;
    t: (key: string) => string;
}>) {
    const isDark = config.theme !== 'light';

    return (
        <>
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2 flex-wrap">
                    {entry.tags.map((tag) => (
                        <span
                            key={tag}
                            className={`text-xs px-2 py-1 rounded-full border ${isDark
                                ? 'bg-purple-900/30 text-purple-300 border-purple-500/20'
                                : 'bg-purple-100 text-purple-700 border-purple-300'
                                }`}
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {activeTargetId === entry.id && sourceEntry && (
                        <BackToSourceButton
                            sourceEntry={sourceEntry}
                            onBackToSource={onBackToSource}
                            t={t}
                        />
                    )}
                    <span className="text-xs text-gray-500 font-mono">#{entry.index}</span>
                    <button
                        onClick={() => onToggleVisibility(entry)}
                        className={`p-1 rounded transition-colors ${entry.visibility === 'public' ? 'text-green-500 hover:bg-green-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                        title={entry.visibility === 'public' ? t('publicTooltip') : t('privateTooltip')}
                    >
                        <VisibilityIcon visibility={entry.visibility} />
                    </button>
                    <ListenButton
                        entryId={entry.id}
                        speaking={speaking}
                        activeEntryId={activeEntryId}
                        onListenOne={() => speak({
                            id: entry.id,
                            content: entry.content,
                            date: extractDate(entry.date),
                        })}
                        onListenFrom={() => speakFrom(flatEntries, entry.id)}
                        onStop={stop}
                        theme={config.theme}
                        t={t}
                    />
                    <button
                        onClick={() => onEdit(entry)}
                        className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                        title={t('edit')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onDelete(entry.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        title={t('delete')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className={`leading-relaxed text-sm ${entry.format === 'markdown' ? '' : 'whitespace-pre-wrap'} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <EntryContentRenderer
                    content={entry.content}
                    format={entry.format}
                    onNavigateToEntry={onNavigateToEntry}
                    sourceEntry={{
                        id: entry.id,
                        date: extractDate(entry.date),
                        index: entry.index || 1
                    }}
                    searchTerm={searchTerm}
                />
            </div>
            {entry.attachments && entry.attachments.length > 0 && (
                <AttachmentDisplay
                    attachments={entry.attachments}
                    theme={config.theme}
                    t={t}
                />
            )}
        </>
    );
}

function BulkActionBar({
    selectedCount, allTags, diaries, isDark,
    onBulkAction, onClearSelection, t
}: Readonly<{
    selectedCount: number;
    allTags: string[];
    diaries: Diary[];
    isDark: boolean;
    onBulkAction: (action: 'delete' | 'visibility' | 'tags' | 'move', options?: { visibility?: 'public' | 'private'; tags?: string[]; diaryId?: number }) => void;
    onClearSelection: () => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}>) {
    const [showTagPicker, setShowTagPicker] = useLocalState(false);
    const [showMovePicker, setShowMovePicker] = useLocalState(false);
    const [bulkTags, setBulkTags] = useLocalState<string[]>([]);

    if (selectedCount === 0) return null;

    return (
        <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 p-3 rounded-lg border shadow-md mb-4 ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('bulkSelected', { count: selectedCount })}
            </span>
            <div className="flex flex-wrap gap-2 ml-auto">
                <button
                    onClick={() => onBulkAction('delete')}
                    className="px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                    {t('bulkDelete')}
                </button>
                <button
                    onClick={() => onBulkAction('visibility', { visibility: 'public' })}
                    className="px-3 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                >
                    {t('bulkMakePublic')}
                </button>
                <button
                    onClick={() => onBulkAction('visibility', { visibility: 'private' })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}
                >
                    {t('bulkMakePrivate')}
                </button>
                <div className="relative">
                    <button
                        onClick={() => { setShowTagPicker(!showTagPicker); setShowMovePicker(false); }}
                        className="px-3 py-1.5 text-xs font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                    >
                        {t('bulkAddTags')}
                    </button>
                    {showTagPicker && (
                        <div className={`absolute top-full mt-1 right-0 p-3 rounded-lg border shadow-lg z-20 min-w-[220px] ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
                            <TagPicker
                                availableTags={allTags}
                                selectedTags={bulkTags}
                                onChange={setBulkTags}
                                placeholder={t('selectTags')}
                                theme={isDark ? 'dark' : 'light'}
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => { onBulkAction('tags', { tags: bulkTags }); setShowTagPicker(false); setBulkTags([]); }}
                                    disabled={bulkTags.length === 0}
                                    className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded transition-colors"
                                >
                                    {t('apply')}
                                </button>
                                <button
                                    onClick={() => { setShowTagPicker(false); setBulkTags([]); }}
                                    className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {diaries.length > 1 && (
                    <div className="relative">
                        <button
                            onClick={() => { setShowMovePicker(!showMovePicker); setShowTagPicker(false); }}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            {t('bulkMove')}
                        </button>
                        {showMovePicker && (
                            <div className={`absolute top-full mt-1 right-0 p-2 rounded-lg border shadow-lg z-20 min-w-[180px] ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
                                {diaries.map((diary) => (
                                    <button
                                        key={diary.id}
                                        onClick={() => { onBulkAction('move', { diaryId: diary.id }); setShowMovePicker(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                                    >
                                        {diary.icon} {diary.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <button
                    onClick={onClearSelection}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                    {t('bulkClearSelection')}
                </button>
            </div>
        </div>
    );
}

function EntriesList({
    loading,
    entries,
    groupedEntries,
    config,
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
    editFormat,
    setEditFormat,
    allTags,
    onSaveEdit,
    onCancelEdit,
    editPendingFiles,
    editExistingAttachments,
    onAddEditFile,
    onRemoveEditPendingFile,
    onRemoveEditAttachment,
    onNavigateToEntry,
    sourceEntry,
    activeTargetId,
    onBackToSource,
    searchTerm,
    bulkMode,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    onClearSelection,
    onBulkAction,
    onToggleBulkMode,
    diaries,
    t
}: Readonly<EntriesListProps>) {
    const { speaking, activeEntryId, speakEntry, speakFromEntry, stop } = useSpeech({
        language: config.language || 'en',
        readDates: config.readDates !== false,
    });

    const sortedDates = useMemo(
        () => Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a)),
        [groupedEntries]
    );
    const flatEntries: SpeechEntry[] = useMemo(
        () => sortedDates.flatMap((date) =>
            (groupedEntries[date] ?? []).map((e) => ({
                id: e.id,
                content: e.content,
                date: extractDate(e.date),
            }))
        ),
        [sortedDates, groupedEntries]
    );

    if (loading) return <p className="text-center text-gray-500">{t('loadingEntries')}</p>;
    if (entries.length === 0) return <p className="text-center text-gray-500">{t('noEntriesFound')}</p>;

    const isEditing = (entry: Entry): boolean => editingEntry !== null && editingEntry.id === entry.id;
    const isDark = config.theme !== 'light';
    const allEntryIds = entries.map((e) => e.id);
    const allSelected = bulkMode && selectedIds && allEntryIds.length > 0 && allEntryIds.every((id) => selectedIds.has(id));

    return (
        <div className="space-y-4">
            {/* Bulk mode toggle and select all */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {bulkMode && onSelectAll && onClearSelection && selectedIds && (
                        <label className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => allSelected ? onClearSelection() : onSelectAll(allEntryIds)}
                                className="w-4 h-4 rounded accent-blue-500"
                            />
                            {t('selectAll')}
                        </label>
                    )}
                </div>
                {onToggleBulkMode && (
                    <button
                        onClick={onToggleBulkMode}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            bulkMode
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : getBulkModeButtonClass(isDark)
                        }`}
                    >
                        {bulkMode ? t('bulkModeExit') : t('bulkModeEnter')}
                    </button>
                )}
            </div>

            {/* Bulk action bar */}
            {bulkMode && onBulkAction && onClearSelection && selectedIds && (
                <BulkActionBar
                    selectedCount={selectedIds.size}
                    allTags={allTags}
                    diaries={diaries || []}
                    isDark={isDark}
                    onBulkAction={onBulkAction}
                    onClearSelection={onClearSelection}
                    t={t}
                />
            )}

            {/* Entries */}
            <div className="space-y-8">
                {sortedDates.map((date) => (
                    <div key={date} className="space-y-4">
                        <h2 className={`text-xl font-bold border-b pb-2 ${isDark ? 'text-gray-300 border-gray-700' : 'text-gray-800 border-gray-300'}`}>
                            {date}
                        </h2>
                        <div className="space-y-4">
                            {(groupedEntries[date] ?? []).map((entry) => (
                                <div
                                    key={entry.id}
                                    id={`entry-${entry.id}`}
                                    className={`rounded-lg p-5 shadow-sm border transition-all flex gap-3 ${
                                        isDark ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
                                    } ${bulkMode && selectedIds?.has(entry.id) ? getSelectedRingClass(isDark) : ''}`}
                                >
                                    {bulkMode && onToggleSelect && selectedIds && (
                                        <div className="flex items-start pt-1">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(entry.id)}
                                                onChange={() => onToggleSelect(entry.id)}
                                                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        {isEditing(entry) ? (
                                            <EditForm
                                                config={config}
                                                editText={editText}
                                                setEditText={setEditText}
                                                editDate={editDate}
                                                setEditDate={setEditDate}
                                                allTags={allTags}
                                                editTags={editTags}
                                                setEditTags={setEditTags}
                                                editVisibility={editVisibility}
                                                setEditVisibility={setEditVisibility}
                                                editFormat={editFormat}
                                                setEditFormat={setEditFormat}
                                                editPendingFiles={editPendingFiles}
                                                editExistingAttachments={editExistingAttachments}
                                                onAddEditFile={onAddEditFile}
                                                onRemoveEditPendingFile={onRemoveEditPendingFile}
                                                onRemoveEditAttachment={onRemoveEditAttachment}
                                                onSaveEdit={onSaveEdit}
                                                onCancelEdit={onCancelEdit}
                                                t={t}
                                            />
                                        ) : (
                                            <EntryViewMode
                                                entry={entry}
                                                config={config}
                                                speaking={speaking}
                                                activeEntryId={activeEntryId}
                                                activeTargetId={activeTargetId}
                                                sourceEntry={sourceEntry}
                                                flatEntries={flatEntries}
                                                speakEntry={speakEntry}
                                                speakFromEntry={speakFromEntry}
                                                stop={stop}
                                                onToggleVisibility={onToggleVisibility}
                                                onEdit={onEdit}
                                                onDelete={onDelete}
                                                onNavigateToEntry={onNavigateToEntry}
                                                onBackToSource={onBackToSource}
                                                searchTerm={searchTerm}
                                                t={t}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default EntriesList;
