import { memo, useCallback, useEffect, useMemo, useRef, useState as useLocalState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { useSpeech, type SpeechEntry } from '../../hooks/useSpeech';
import type { Attachment, Config, Diary, Entry, GroupedEntries, SourceEntryInfo, TranslationFunction as TranslationFn } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import EntryViewMode, { type EntryCardActions } from './EntryViewMode';
import EntryDayHeading from './EntryDayHeading';
import { resolveLanguage } from '../../utils/language';
import { isManuallyOrdered } from '../../utils/entryTime';
import type { BulkAction, BulkActionOptions } from './BulkActionBar';
import EntriesListToolbar from './EntriesListToolbar';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import { EditForm, EntryReorderControls } from './EntriesList.helpers';
import {
    extractDate,
    getEntryCardStyle,
    getEntryDragHighlightClass,
    getSelectedRingClass,
    groupRankedEntries,
    spansSeveralDiaries,
    type EntryDisplayGroup,
} from './EntriesList.utils';

/** The card actions are handed to each entry card as they are. */
interface EntriesListProps extends EntryCardActions {
    loading: boolean;
    /** The entries loaded so far, a window of the entries the filters match. */
    entries: Entry[];
    /** How many entries the filters match; the default is the entries loaded. */
    total?: number;
    /** How many entries come before the first one loaded, so each entry's place in the list is known. */
    offset?: number;
    /** Whether more entries are being loaded at either end of the list. */
    loadingMore?: boolean;
    groupedEntries: GroupedEntries;
    /** Show entries in the order they came (best search match first), under their dates, instead of by day. */
    rankedOrder?: boolean;
    config: Config;
    onEdit: (entry: Entry) => void;
    onDelete: (id: number) => void;
    onToggleVisibility: (entry: Entry) => void;
    onToggleFavorite: (entry: Entry) => void;
    onToggleArchived: (entry: Entry) => void;
    onTogglePinned: (entry: Entry) => void;
    editingEntry: Entry | null;
    editText: string;
    setEditText: Dispatch<SetStateAction<string>>;
    editTitle?: string;
    setEditTitle?: Dispatch<SetStateAction<string>>;
    editTimeOfDay?: string;
    setEditTimeOfDay?: Dispatch<SetStateAction<string>>;
    editMood?: number | null;
    setEditMood?: Dispatch<SetStateAction<number | null>>;
    editFeelings?: string[];
    setEditFeelings?: Dispatch<SetStateAction<string[]>>;
    editTags: string[];
    setEditTags: Dispatch<SetStateAction<string[]>>;
    editDate: Date | null;
    setEditDate: Dispatch<SetStateAction<Date | null>>;
    editVisibility: 'public' | 'private';
    setEditVisibility: Dispatch<SetStateAction<'public' | 'private'>>;
    editFormat: 'plain' | 'markdown';
    setEditFormat: Dispatch<SetStateAction<'plain' | 'markdown'>>;
    editDiaryId?: number | null;
    setEditDiaryId?: Dispatch<SetStateAction<number | null>>;
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
    onBulkAction?: (action: BulkAction, options?: BulkActionOptions) => void;
    onToggleBulkMode?: () => void;
    diaries?: Diary[];
    onReorderEntries?: (date: string, orderedIds: number[]) => void;
    t: TranslationFn;
}

function EntriesList({
    loading,
    entries,
    total = entries.length,
    offset = 0,
    loadingMore = false,
    groupedEntries,
    rankedOrder = false,
    config,
    onEdit,
    onDelete,
    onToggleVisibility,
    onToggleFavorite,
    onToggleArchived,
    onTogglePinned,
    editingEntry,
    editText,
    setEditText,
    editTitle,
    setEditTitle,
    editTimeOfDay,
    setEditTimeOfDay,
    editMood,
    setEditMood,
    editFeelings,
    setEditFeelings,
    editTags,
    setEditTags,
    editDate,
    setEditDate,
    editVisibility,
    setEditVisibility,
    editFormat,
    setEditFormat,
    editDiaryId,
    setEditDiaryId,
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
    onReorderEntries,
    t,
    ...cardActions
}: Readonly<EntriesListProps>) {
    const [dragEntryId, setDragEntryId] = useLocalState<number | null>(null);
    const [dragDate, setDragDate] = useLocalState<string | null>(null);
    const [dragOverId, setDragOverId] = useLocalState<number | null>(null);

    const handleDragStart = useCallback((event: PointerEvent, entryId: number, date: string) => {
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

        // Entries with a time follow it, so only the others are reordered among themselves
        const dayEntries = (groupedEntries[date] ?? []).filter(isManuallyOrdered);
        const ids = dayEntries.map((entry) => entry.id);
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

    const handleDropKeyDown = useCallback((event: KeyboardEvent, date: string, targetEntryId: number) => {
        if ((event.key === 'Enter' || event.key === ' ') && dragEntryId != null) {
            event.preventDefault();
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
        voiceUri: config.ttsVoiceUri,
    });

    const pinnedEntries = useMemo(
        () => entries.filter((entry) => entry.is_pinned),
        [entries],
    );
    const unpinnedGroupedEntries = useMemo(() => {
        const grouped: GroupedEntries = {};

        for (const [date, dateEntries] of Object.entries(groupedEntries)) {
            const unpinnedEntries = dateEntries.filter((entry) => !entry.is_pinned);
            if (unpinnedEntries.length > 0) {
                grouped[date] = unpinnedEntries;
            }
        }

        return grouped;
    }, [groupedEntries]);
    const sortedDates = useMemo(
        () => Object.keys(unpinnedGroupedEntries).sort((a, b) => b.localeCompare(a)),
        [unpinnedGroupedEntries],
    );
    const displayGroups = useMemo<EntryDisplayGroup[]>(() => {
        if (rankedOrder) {
            return groupRankedEntries(entries);
        }

        return [
            ...(pinnedEntries.length > 0
                ? [{ key: 'pinned', label: t('pinnedEntries'), date: null, entries: pinnedEntries }]
                : []),
            ...sortedDates.map((date) => ({
                key: date,
                label: date,
                date,
                entries: unpinnedGroupedEntries[date] ?? [],
            })),
        ];
    }, [entries, pinnedEntries, rankedOrder, sortedDates, t, unpinnedGroupedEntries]);
    const speechDates = useMemo(
        () => Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a)),
        [groupedEntries],
    );
    const flatEntries = useMemo<SpeechEntry[]>(
        () => speechDates.flatMap((date) =>
            (groupedEntries[date] ?? []).map((entry) => ({
                id: entry.id,
                content: entry.content,
                date: extractDate(entry.date),
            })),
        ),
        [speechDates, groupedEntries],
    );
    // Read when asked, so a batch loaded later neither draws every card again nor leaves one reading a stale list
    const flatEntriesRef = useRef(flatEntries);
    useEffect(() => {
        flatEntriesRef.current = flatEntries;
    }, [flatEntries]);
    const listEntries = useCallback(() => flatEntriesRef.current, []);
    const showDiaryAccent = useMemo(() => spansSeveralDiaries(entries), [entries]);

    const showInitialLoading = loading && entries.length === 0;
    const isRefreshing = loading && entries.length > 0;

    const isDark = config.theme !== 'light';
    if (showInitialLoading) {
        return <p className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('loadingEntries')}</p>;
    }
    if (entries.length === 0) {
        return <p className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('noEntriesFound')}</p>;
    }

    const isEditing = (entry: Entry) => editingEntry !== null && editingEntry.id === entry.id;
    const dragToReorderLabel = t('dragToReorder') === 'dragToReorder' ? 'Drag to reorder' : t('dragToReorder');
    const dropHereLabel = t('dropToReorder') === 'dropToReorder' ? 'Release to move here' : t('dropToReorder');
    const language = resolveLanguage(config.language);
    let position = offset;

    return (
        <div className="space-y-4">
            {isRefreshing && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-gray-700 bg-gray-900/70 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                    {t('loadingEntries')}
                </div>
            )}

            <EntriesListToolbar
                loadedIds={entries.map((entry) => entry.id)}
                total={total}
                bulkMode={bulkMode}
                selectedIds={selectedIds}
                onSelectAll={onSelectAll}
                onClearSelection={onClearSelection}
                onBulkAction={onBulkAction}
                onToggleBulkMode={onToggleBulkMode}
                allTags={allTags}
                tagMetadata={tagMetadata}
                diaries={diaries}
                isDark={isDark}
                language={language}
                t={t}
            />

            {/* A feed of entry articles; each day's heading opens its first entry's article */}
            <p id="journal-feed-hint" className="sr-only">{t('journalFeedHint')}</p>
            <div role="feed" aria-busy={isRefreshing || loadingMore} aria-label={t('journalFeedLabel')} aria-describedby="journal-feed-hint">
                {/* One flat list of keyed articles, so batches added or let go of at either end leave the others in place */}
                {displayGroups.flatMap((group, groupIndex) => group.entries.map((entry, entryIndex) => {
                    const date = group.date ?? extractDate(entry.date);
                    const isDraggable = group.date !== null && !bulkMode && !isEditing(entry) && !!onReorderEntries
                        && isManuallyOrdered(entry) && group.entries.filter(isManuallyOrdered).length > 1;
                    const isDraggedEntry = dragEntryId === entry.id && dragDate === date;
                    const isDropTarget = dragOverId === entry.id && dragDate === date && dragEntryId !== entry.id;
                    const dragHighlightClass = getEntryDragHighlightClass(isDark, isDraggedEntry, isDropTarget);
                    position += 1;
                    const day = formatEntryDay(extractDate(entry.date), language);

                    return (
                        <article
                            key={entry.id}
                            data-entry-id={entry.id}
                            tabIndex={-1}
                            aria-posinset={position}
                            aria-setsize={total}
                            aria-label={entry.title ? `${entry.title}, ${day}` : day}
                            className={`scroll-mt-4 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${entryIndex > 0 ? 'mt-4' : ''} ${entryIndex === 0 && groupIndex > 0 ? 'mt-8' : ''}`}
                        >
                            {entryIndex === 0 && (
                                <div className="mb-4">
                                    <EntryDayHeading
                                        label={group.label}
                                        dayEntries={!rankedOrder && group.date !== null ? groupedEntries[group.date] : undefined}
                                        config={config}
                                        t={t}
                                    />
                                </div>
                            )}
                            <div
                                id={`entry-${entry.id}`}
                                className={`relative rounded-lg p-5 shadow-sm border transition-all flex gap-3 has-[[aria-expanded=true]]:z-30 ${
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
                                            aria-label={t('bulkSelectEntry')}
                                            className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                                        />
                                    </div>
                                )}
                                <div className="relative z-20 flex-1 min-w-0">
                                    {isEditing(entry) ? (
                                        <EditForm
                                            config={config}
                                            entryId={entry.id}
                                            editText={editText}
                                            setEditText={setEditText}
                                            editTitle={editTitle}
                                            setEditTitle={setEditTitle}
                                            editTimeOfDay={editTimeOfDay}
                                            setEditTimeOfDay={setEditTimeOfDay}
                                            editMood={editMood}
                                            setEditMood={setEditMood}
                                            editFeelings={editFeelings}
                                            setEditFeelings={setEditFeelings}
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
                                            diaries={diaries}
                                            editDiaryId={editDiaryId}
                                            setEditDiaryId={setEditDiaryId}
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
                                            listEntries={listEntries}
                                            speakEntry={speakEntry}
                                            speakFromEntry={speakFromEntry}
                                            stop={stop}
                                            onToggleVisibility={onToggleVisibility}
                                            onToggleFavorite={onToggleFavorite}
                                            onToggleArchived={onToggleArchived}
                                            onTogglePinned={onTogglePinned}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            onNavigateToEntry={onNavigateToEntry}
                                            onBackToSource={onBackToSource}
                                            {...cardActions}
                                            diaries={diaries}
                                            searchTerm={searchTerm}
                                            showDiaryLabel={showDiaryAccent}
                                            tagMetadata={tagMetadata}
                                            t={t}
                                        />
                                    )}
                                </div>
                            </div>
                        </article>
                    );
                }))}
            </div>
        </div>
    );
}

export default memo(EntriesList);
