import { Suspense, lazy, memo, useEffect, useMemo, useState as useLocalState, useCallback, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import "react-datepicker/dist/react-datepicker.css";
import TagPicker from '../TagPicker/TagPicker';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import ListenButton from '../ListenButton/ListenButton';
import { useSpeech, type SpeechEntry } from '../../hooks/useSpeech';
import AttachmentDisplay from '../AttachmentDisplay/AttachmentDisplay';
import AttachmentUpload from '../AttachmentUpload/AttachmentUpload';
import TypedDatePicker from '../TypedDatePicker/TypedDatePicker';
import type { Attachment, EntryRevision } from '../../types';
import { resolveDiaryColor, withAlpha } from '../../utils/diaryColors';
import TagBadge from '../TagBadge/TagBadge';
import type { TagMetadataMap } from '../../utils/tagMetadata';

const LazyMDEditor = lazy(() => import('@uiw/react-md-editor/nohighlight'));

interface Entry {
    id: number;
    content: string;
    tags: string[];
    date: string;
    visibility: 'public' | 'private';
    is_favorite?: boolean;
    is_archived?: boolean;
    format?: 'plain' | 'markdown';
    diary_id?: number | null;
    diary_name?: string;
    diary_icon?: string;
    diary_color?: string | null;
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
    color?: string | null;
}

interface EntriesListProps {
    loading: boolean;
    entries: Entry[];
    groupedEntries: GroupedEntries;
    config: Config;
    onEdit: (entry: Entry) => void;
    onDelete: (id: number) => void;
    onToggleVisibility: (entry: Entry) => void;
    onToggleFavorite: (entry: Entry) => void;
    onToggleArchived: (entry: Entry) => void;
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
    tagMetadata?: TagMetadataMap;
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
    searchTerm?: string;
    bulkMode?: boolean;
    selectedIds?: Set<number>;
    onToggleSelect?: (id: number) => void;
    onSelectAll?: (ids: number[]) => void;
    onClearSelection?: () => void;
    onBulkAction?: (action: 'delete' | 'visibility' | 'tags' | 'move' | 'archive', options?: { visibility?: 'public' | 'private'; tags?: string[]; diaryId?: number; isArchived?: boolean }) => void;
    onToggleBulkMode?: () => void;
    diaries?: Diary[];
    onFetchHistory?: (entryId: number) => Promise<EntryRevision[]>;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onReorderEntries?: (date: string, orderedIds: number[]) => void;
    onDiscuss?: (entry: Entry) => void;
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

function getEditFormatButtonClass(editFormat: 'plain' | 'markdown', theme?: 'light' | 'dark'): string {
    if (editFormat === 'markdown') {
        return 'border-indigo-500 bg-indigo-500/10 text-indigo-500';
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

function getEntryDiaryBadgeStyle(entry: Entry, isDark: boolean): CSSProperties {
    const diaryColor = resolveDiaryColor({
        color: entry.diary_color,
        id: entry.diary_id,
        name: entry.diary_name,
    });

    return {
        color: diaryColor,
        borderColor: withAlpha(diaryColor, isDark ? 0.5 : 0.25),
        backgroundColor: withAlpha(diaryColor, isDark ? 0.18 : 0.12),
    };
}

function getEntryCardStyle(entry: Entry): CSSProperties | undefined {
    if (!entry.diary_name && !entry.diary_id) {
        return undefined;
    }

    const diaryColor = resolveDiaryColor({
        color: entry.diary_color,
        id: entry.diary_id,
        name: entry.diary_name,
    });

    return {
        borderLeftWidth: '5px',
        borderLeftStyle: 'solid',
        borderLeftColor: diaryColor,
    };
}

function getEntryDragHighlightClass(
    isDark: boolean,
    isDraggedEntry: boolean,
    isDropTarget: boolean,
): string {
    if (isDraggedEntry) {
        return isDark
            ? ' border-indigo-400 bg-gray-800/95 ring-2 ring-indigo-400/55 shadow-2xl shadow-indigo-950/35 scale-[1.01]'
            : ' border-blue-500 bg-blue-50 ring-2 ring-blue-400/55 shadow-xl shadow-blue-200/70 scale-[1.01]';
    }

    if (isDropTarget) {
        return isDark
            ? ' border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-400/45 shadow-lg shadow-indigo-950/20'
            : ' border-blue-500 bg-blue-50 ring-2 ring-blue-300/70 shadow-lg shadow-blue-100';
    }

    return '';
}

function getDragBadgeClass(isDark: boolean): string {
    return isDark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-blue-100 text-blue-700';
}

function getDragHandleClass(isDark: boolean, isDraggedEntry: boolean): string {
    if (isDraggedEntry) {
        return isDark
            ? 'bg-indigo-500/20 text-indigo-200 scale-110'
            : 'bg-blue-100 text-blue-700 scale-110';
    }

    return isDark
        ? 'text-gray-600 hover:text-gray-400 hover:bg-gray-700/70'
        : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100';
}

function getDropIndicatorClass(isDark: boolean): string {
    return isDark
    ? 'bg-indigo-400 shadow-[0_0_18px_rgba(129,140,248,0.6)]'
    : 'bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.35)]';
}

interface EntryReorderControlsProps {
    readonly isDraggable: boolean;
    readonly reserveSpace: boolean;
    readonly isDraggedEntry: boolean;
    readonly isDropTarget: boolean;
    readonly isDark: boolean;
    readonly dragDateMatches: boolean;
    readonly dragToReorderLabel: string;
    readonly dropHereLabel: string;
    readonly onHandlePointerDown: (event: React.PointerEvent) => void;
    readonly onHandleKeyDown: (event: React.KeyboardEvent) => void;
    readonly onTargetPointerEnter: () => void;
    readonly onTargetPointerUp: () => void;
}

function EntryReorderControls({
    isDraggable,
    reserveSpace,
    isDraggedEntry,
    isDropTarget,
    isDark,
    dragDateMatches,
    dragToReorderLabel,
    dropHereLabel,
    onHandlePointerDown,
    onHandleKeyDown,
    onTargetPointerEnter,
    onTargetPointerUp,
}: Readonly<EntryReorderControlsProps>) {
    if (!isDraggable) {
        return reserveSpace ? <div aria-hidden="true" className="relative z-40 w-6 shrink-0" /> : null;
    }

    const dragBadgeClass = getDragBadgeClass(isDark);
    const dragHandleClass = getDragHandleClass(isDark, isDraggedEntry);
    const dropIndicatorClass = getDropIndicatorClass(isDark);

    return (
        <>
            {dragDateMatches && (
                <button
                    type="button"
                    onPointerEnter={onTargetPointerEnter}
                    onPointerUp={onTargetPointerUp}
                    className={`absolute inset-0 z-30 rounded-lg ${isDropTarget ? 'cursor-grabbing' : 'cursor-grab'}`}
                    aria-label={dragToReorderLabel}
                />
            )}

            {isDropTarget && (
                <div className="pointer-events-none absolute inset-x-4 top-2 z-40">
                    <div className={`h-1 rounded-full ${dropIndicatorClass}`} />
                    <div className="mt-2 flex justify-end">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${dragBadgeClass}`}>
                            {dropHereLabel}
                        </span>
                    </div>
                </div>
            )}

            <button
                type="button"
                onPointerDown={onHandlePointerDown}
                onKeyDown={onHandleKeyDown}
                className={`relative z-40 flex items-center rounded-md px-1 py-0.5 transition-all cursor-grab active:cursor-grabbing select-none ${dragHandleClass}`}
                title={dragToReorderLabel}
                aria-label={dragToReorderLabel}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                </svg>
            </button>

            {isDraggedEntry && (
                <div className="pointer-events-none absolute left-12 top-3 z-40">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${dragBadgeClass}`}>
                        {dragToReorderLabel}
                    </span>
                </div>
            )}
        </>
    );
}

function EditForm({
    config, editText, setEditText, editDate, setEditDate,
    allTags, tagMetadata, editTags, setEditTags, editVisibility, setEditVisibility,
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
    tagMetadata: TagMetadataMap;
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
    const editFormatButtonClass = getEditFormatButtonClass(editFormat, config.theme);

    return (
        <div className="space-y-4">
            <div>
                {editFormat === 'markdown' ? (
                    <Suspense
                        fallback={(
                            <textarea
                                className={`w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none ${inputClass}`}
                                rows={3}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                            />
                        )}
                    >
                        <div data-color-mode={isDark ? 'dark' : 'light'}>
                            <LazyMDEditor
                                value={editText}
                                onChange={(val) => setEditText(val ?? '')}
                                preview="edit"
                                visibleDragbar={false}
                                height={200}
                            />
                        </div>
                    </Suspense>
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
                    <TypedDatePicker
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
                        tagMetadata={tagMetadata}
                        onChange={setEditTags}
                        placeholder={t('filterTagsPlaceholder').replace('Filter by ', '')}
                        theme={config.theme}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setEditFormat(f => f === 'plain' ? 'markdown' : 'plain')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${editFormatButtonClass}`}
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

function EntryHistorySection({
    isVisible,
    isDark,
    loadingHistory,
    revisions,
    tagMetadata,
    onDeleteRevision,
    onHandleDeleteRevision,
    t,
}: Readonly<{
    isVisible: boolean;
    isDark: boolean;
    loadingHistory: boolean;
    revisions: EntryRevision[];
    tagMetadata: TagMetadataMap;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onHandleDeleteRevision: (revisionId: number) => Promise<void>;
    t: (key: string) => string;
}>) {
    if (!isVisible) {
        return null;
    }

    let content: ReactNode;

    if (loadingHistory) {
        content = <p className="text-sm text-gray-500">...</p>;
    } else if (revisions.length === 0) {
        content = <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('noRevisions')}</p>;
    } else {
        content = (
            <div className="space-y-3">
                {revisions.map((rev, idx) => (
                    <div
                        key={rev.id}
                        className={`p-3 rounded-lg border text-sm ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('revision')} #{revisions.length - idx}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {new Date(rev.createdAt).toLocaleString()}
                                </span>
                                {onDeleteRevision && (
                                    <button
                                        onClick={() => void onHandleDeleteRevision(rev.id)}
                                        className="p-0.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                        title={t('delete')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className={`whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {rev.content}
                        </div>
                        {rev.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                                {rev.tags.map(tag => (
                                    <TagBadge
                                        key={tag}
                                        tag={tag}
                                        metadata={tagMetadata}
                                        theme={isDark ? 'dark' : 'light'}
                                        size="xs"
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('history')}
            </h4>
            {content}
        </div>
    );
}

function ArchiveStatusBadge({
    isArchived,
    isDark,
    t,
}: Readonly<{
    isArchived?: boolean;
    isDark: boolean;
    t: (key: string) => string;
}>) {
    if (!isArchived) {
        return null;
    }

    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${isDark ? 'border-sky-400/35 bg-sky-500/10 text-sky-300' : 'border-sky-300 bg-sky-50 text-sky-700'}`}>
            {t('archived')}
        </span>
    );
}

function ArchiveToggleButton({
    entry,
    onToggleArchived,
    t,
}: Readonly<{
    entry: Entry;
    onToggleArchived: (entry: Entry) => void;
    t: (key: string) => string;
}>) {
    const archiveActionLabel = entry.is_archived ? t('unarchive') : t('archive');
    const archiveIconPath = entry.is_archived ? 'M9 12h6' : 'M9 12h6m-3-3v6';

    return (
        <button
            onClick={() => onToggleArchived(entry)}
            className={`p-1 rounded transition-colors ${entry.is_archived ? 'text-sky-400 hover:bg-sky-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
            title={archiveActionLabel}
            aria-label={archiveActionLabel}
        >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 8h14" />
                <path d="M5 8l1 11h12l1-11" />
                <path d={archiveIconPath} />
            </svg>
        </button>
    );
}

function EntryViewMode({
    entry, config, speaking, activeEntryId, activeTargetId, sourceEntry,
    flatEntries, speakEntry: speak, speakFromEntry: speakFrom, stop,
    onToggleVisibility, onToggleFavorite, onToggleArchived, onEdit, onDelete, onNavigateToEntry, onShareEntry, getEntryPermalink, onBackToSource, onFetchHistory, onDeleteRevision, onDiscuss, searchTerm, showDiaryLabel, tagMetadata, t
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
    onToggleFavorite: (entry: Entry) => void;
    onToggleArchived: (entry: Entry) => void;
    onEdit: (entry: Entry) => void;
    onDelete: (id: number) => void;
    onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    onShareEntry?: (entry: Entry) => Promise<boolean>;
    getEntryPermalink?: (entryId: number) => string;
    onBackToSource: () => void;
    onFetchHistory?: (entryId: number) => Promise<EntryRevision[]>;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onDiscuss?: (entry: Entry) => void;
    searchTerm?: string;
    showDiaryLabel: boolean;
    tagMetadata: TagMetadataMap;
    t: (key: string) => string;
}>) {
    const isDark = config.theme !== 'light';
    const [showHistory, setShowHistory] = useLocalState(false);
    const [revisions, setRevisions] = useLocalState<EntryRevision[]>([]);
    const [loadingHistory, setLoadingHistory] = useLocalState(false);
    const [shareReady, setShareReady] = useLocalState(false);
    const entryPermalink = getEntryPermalink?.(entry.id);

    const handleToggleHistory = useCallback(async () => {
        if (showHistory) {
            setShowHistory(false);
            return;
        }
        if (!onFetchHistory) return;
        setLoadingHistory(true);
        try {
            const data = await onFetchHistory(entry.id);
            setRevisions(data);
        } finally {
            setLoadingHistory(false);
        }
        setShowHistory(true);
    }, [showHistory, onFetchHistory, entry.id, setLoadingHistory, setRevisions, setShowHistory]);

    const handleDeleteRevision = useCallback(async (revisionId: number) => {
        if (!onDeleteRevision) return;
        const success = await onDeleteRevision(entry.id, revisionId);
        if (success) {
            setRevisions(revisions.filter(r => r.id !== revisionId));
        }
    }, [onDeleteRevision, entry.id, revisions, setRevisions]);

    const handleShare = useCallback(async () => {
        if (!onShareEntry) {
            return;
        }

        const success = await onShareEntry(entry);
        setShareReady(success);

        if (success) {
            globalThis.setTimeout(() => setShareReady(false), 2000);
        }
    }, [entry, onShareEntry, setShareReady]);

    return (
        <>
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2 flex-wrap items-center">
                    {showDiaryLabel && entry.diary_name && (
                        <span
                            className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border font-medium"
                            style={getEntryDiaryBadgeStyle(entry, isDark)}
                        >
                            <span>{entry.diary_icon || '📓'}</span>
                            <span>{entry.diary_name}</span>
                        </span>
                    )}
                    {entry.tags.map((tag) => (
                        <TagBadge
                            key={tag}
                            tag={tag}
                            metadata={tagMetadata}
                            theme={config.theme}
                            size="xs"
                        />
                    ))}
                    <ArchiveStatusBadge isArchived={entry.is_archived} isDark={isDark} t={t} />
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
                    {entryPermalink && (
                        <a
                            href={entryPermalink}
                            className="p-1 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title={t('entryPermalink')}
                            aria-label={t('entryPermalink')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14a3 3 0 004.243 0l3.536-3.536a3 3 0 00-4.243-4.243L11 8m3 8l-2.293 2.293a3 3 0 01-4.243-4.243L11 11" />
                            </svg>
                        </a>
                    )}
                    {onShareEntry && (
                        <button
                            onClick={() => void handleShare()}
                            className={`p-1.5 rounded transition-colors ${shareReady ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:text-sky-400 hover:bg-sky-500/10'}`}
                            title={shareReady ? t('entryLinkCopied') : t('shareEntry')}
                            aria-label={shareReady ? t('entryLinkCopied') : t('shareEntry')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.882 13.119 9 12.825 9 12.5a2.5 2.5 0 10-2.5 2.5c.325 0 .619-.118.842-.316l8.632 4.316A2.49 2.49 0 0016 19.5a2.5 2.5 0 102.5-2.5c-.325 0-.619.118-.842.316l-8.632-4.316A2.49 2.49 0 009 12.5c0-.325-.118-.619-.316-.842l8.632-4.316A2.49 2.49 0 0018.5 7a2.5 2.5 0 10-2.5-2.5c0 .325.118.619.316.842l-8.632 4.316z" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={() => onToggleVisibility(entry)}
                        className={`p-1 rounded transition-colors ${entry.visibility === 'public' ? 'text-green-500 hover:bg-green-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                        title={entry.visibility === 'public' ? t('publicTooltip') : t('privateTooltip')}
                    >
                        <VisibilityIcon visibility={entry.visibility} />
                    </button>
                    <button
                        onClick={() => onToggleFavorite(entry)}
                        className={`p-1 rounded transition-colors ${entry.is_favorite ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                        title={entry.is_favorite ? t('unfavorite') : t('favorite')}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill={entry.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                    </button>
                    <ArchiveToggleButton entry={entry} onToggleArchived={onToggleArchived} t={t} />
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
                    {onDiscuss && (
                        <button
                            onClick={() => onDiscuss(entry)}
                            className="p-1.5 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded transition-colors"
                            title={t('discussEntry')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </button>
                    )}
                    {onFetchHistory && (
                        <button
                            onClick={handleToggleHistory}
                            className={`p-1.5 rounded transition-colors ${showHistory ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' : 'text-gray-500 hover:text-gray-400 hover:bg-gray-500/10'}`}
                            title={t('viewHistory')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    )}
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
            <EntryHistorySection
                isVisible={showHistory}
                isDark={isDark}
                loadingHistory={loadingHistory}
                revisions={revisions}
                tagMetadata={tagMetadata}
                onDeleteRevision={onDeleteRevision}
                onHandleDeleteRevision={handleDeleteRevision}
                t={t}
            />
        </>
    );
}

function BulkActionBar({
    selectedCount, allTags, tagMetadata, diaries, isDark,
    onBulkAction, onClearSelection, t
}: Readonly<{
    selectedCount: number;
    allTags: string[];
    tagMetadata: TagMetadataMap;
    diaries: Diary[];
    isDark: boolean;
    onBulkAction: (action: 'delete' | 'visibility' | 'tags' | 'move' | 'archive', options?: { visibility?: 'public' | 'private'; tags?: string[]; diaryId?: number; isArchived?: boolean }) => void;
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
                <button
                    onClick={() => onBulkAction('archive', { isArchived: true })}
                    className="px-3 py-1.5 text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
                >
                    {t('bulkArchive')}
                </button>
                <button
                    onClick={() => onBulkAction('archive', { isArchived: false })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-500 hover:bg-slate-600 text-white'}`}
                >
                    {t('bulkUnarchive')}
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
                                tagMetadata={tagMetadata}
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
    onToggleFavorite,
    onToggleArchived,
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
    tagMetadata = {},
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
    searchTerm,
    bulkMode,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    onClearSelection,
    onBulkAction,
    onToggleBulkMode,
    diaries,
    onFetchHistory,
    onDeleteRevision,
    onReorderEntries,
    onDiscuss,
    t
}: Readonly<EntriesListProps>) {
    // Drag-and-drop state
    const [dragEntryId, setDragEntryId] = useLocalState<number | null>(null);
    const [dragDate, setDragDate] = useLocalState<string | null>(null);
    const [dragOverId, setDragOverId] = useLocalState<number | null>(null);

    const handleDragStart = useCallback((event: React.PointerEvent, entryId: number, date: string) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        event.preventDefault();
        setDragEntryId(entryId);
        setDragDate(date);
        setDragOverId(entryId);
    }, [setDragDate, setDragEntryId, setDragOverId]);

    const handleDragOver = useCallback((entryId: number) => {
        setDragOverId(entryId);
    }, [setDragOverId]);

    const handleDragEnd = useCallback(() => {
        setDragEntryId(null);
        setDragDate(null);
        setDragOverId(null);
    }, [setDragDate, setDragEntryId, setDragOverId]);

    const applyReorder = useCallback((date: string, targetEntryId: number) => {
        const fromId = dragEntryId;
        const toId = targetEntryId;
        if (fromId == null || toId == null || fromId === toId || !onReorderEntries) {
            handleDragEnd();
            return;
        }
        const dayEntries = groupedEntries[date] ?? [];
        const ids = dayEntries.map(en => en.id);
        const fromIdx = ids.indexOf(fromId);
        const toIdx = ids.indexOf(toId);
        if (fromIdx === -1 || toIdx === -1) {
            handleDragEnd();
            return;
        }
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, fromId);
        onReorderEntries(date, ids);
        handleDragEnd();
    }, [dragEntryId, groupedEntries, onReorderEntries, handleDragEnd]);

    const handleDropKeyDown = useCallback((e: React.KeyboardEvent, date: string, targetEntryId: number) => {
        if ((e.key === 'Enter' || e.key === ' ') && dragEntryId != null) {
            e.preventDefault();
            applyReorder(date, targetEntryId);
        }
    }, [applyReorder, dragEntryId]);

    useEffect(() => {
        if (dragEntryId == null) {
            return undefined;
        }

        const handlePointerUp = (): void => {
            handleDragEnd();
        };

        globalThis.addEventListener('pointerup', handlePointerUp);
        return () => globalThis.removeEventListener('pointerup', handlePointerUp);
    }, [dragEntryId, handleDragEnd]);

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
    const showDiaryAccent = useMemo(() => {
        const diaryKeys = new Set<string>();
        for (const entry of entries) {
            if (entry.diary_id !== undefined && entry.diary_id !== null) {
                diaryKeys.add(`id:${entry.diary_id}`);
                continue;
            }

            if (entry.diary_name) {
                diaryKeys.add(`name:${entry.diary_name}`);
            }
        }

        return diaryKeys.size > 1;
    }, [entries]);

    const showInitialLoading = loading && entries.length === 0;
    const isRefreshing = loading && entries.length > 0;

    if (showInitialLoading) return <p className="text-center text-gray-500">{t('loadingEntries')}</p>;
    if (entries.length === 0) return <p className="text-center text-gray-500">{t('noEntriesFound')}</p>;

    const isEditing = (entry: Entry): boolean => editingEntry !== null && editingEntry.id === entry.id;
    const isDark = config.theme !== 'light';
    const dragToReorderLabel = t('dragToReorder') === 'dragToReorder' ? 'Drag to reorder' : t('dragToReorder');
    const dropHereLabel = t('dropToReorder') === 'dropToReorder' ? 'Release to move here' : t('dropToReorder');
    const allEntryIds = entries.map((e) => e.id);
    const allSelected = bulkMode && selectedIds && allEntryIds.length > 0 && allEntryIds.every((id) => selectedIds.has(id));

    return (
        <div className="space-y-4">
            {isRefreshing && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-gray-700 bg-gray-900/70 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    {t('loadingEntries')}
                </div>
            )}

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
                    tagMetadata={tagMetadata}
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
                            {(groupedEntries[date] ?? []).map((entry) => {
                                const isDraggable = !bulkMode && !isEditing(entry) && !!onReorderEntries && (groupedEntries[date] ?? []).length > 1;
                                const isDraggedEntry = dragEntryId === entry.id && dragDate === date;
                                const isDropTarget = dragOverId === entry.id && dragDate === date && dragEntryId !== entry.id;
                                const dragHighlightClass = getEntryDragHighlightClass(isDark, isDraggedEntry, isDropTarget);

                                return (
                                <div
                                    key={entry.id}
                                    id={`entry-${entry.id}`}
                                    className={`relative rounded-lg p-5 shadow-sm border transition-all flex gap-3 ${
                                        isDark ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
                                    } ${targetEntryId === entry.id || activeTargetId === entry.id ? 'highlight-entry' : ''} ${bulkMode && selectedIds?.has(entry.id) ? getSelectedRingClass(isDark) : ''}${dragHighlightClass}`}
                                    data-archived={entry.is_archived ? 'true' : 'false'}
                                    style={getEntryCardStyle(entry)}
                                >
                                    <EntryReorderControls
                                        isDraggable={isDraggable}
                                        reserveSpace={!bulkMode && !!onReorderEntries}
                                        isDraggedEntry={isDraggedEntry}
                                        isDropTarget={isDropTarget}
                                        isDark={isDark}
                                        dragDateMatches={dragDate === date}
                                        dragToReorderLabel={dragToReorderLabel}
                                        dropHereLabel={dropHereLabel}
                                        onHandlePointerDown={(event) => handleDragStart(event, entry.id, date)}
                                        onHandleKeyDown={(event) => handleDropKeyDown(event, date, entry.id)}
                                        onTargetPointerEnter={() => handleDragOver(entry.id)}
                                        onTargetPointerUp={() => applyReorder(date, entry.id)}
                                    />
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
                                    <div className="relative z-20 flex-1 min-w-0">
                                        {isEditing(entry) ? (
                                            <EditForm
                                                config={config}
                                                editText={editText}
                                                setEditText={setEditText}
                                                editDate={editDate}
                                                setEditDate={setEditDate}
                                                allTags={allTags}
                                                tagMetadata={tagMetadata}
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
                                                onToggleFavorite={onToggleFavorite}
                                                onToggleArchived={onToggleArchived}
                                                onEdit={onEdit}
                                                onDelete={onDelete}
                                                onNavigateToEntry={onNavigateToEntry}
                                                onShareEntry={onShareEntry}
                                                getEntryPermalink={getEntryPermalink}
                                                onBackToSource={onBackToSource}
                                                onFetchHistory={onFetchHistory}
                                                onDeleteRevision={onDeleteRevision}
                                                onDiscuss={onDiscuss}
                                                searchTerm={searchTerm}
                                                showDiaryLabel={showDiaryAccent}
                                                tagMetadata={tagMetadata}
                                                t={t}
                                            />
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default memo(EntriesList);
