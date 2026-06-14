import { memo, useCallback, useEffect, useMemo, useState as useLocalState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { useSpeech, type SpeechEntry } from '../../hooks/useSpeech';
import type { RephraseMode } from '../../services/api/aiService';
import type { Attachment, Config, Diary, Entry, EntryBacklink, EntryRevision, GroupedEntries, SourceEntryInfo, TranslationFunction as TranslationFn } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import EntryViewMode from './EntryViewMode';
import {
    type BulkAction,
    type BulkActionOptions,
    BulkActionBar,
    EditForm,
    EntryReorderControls,
} from './EntriesList.helpers';
import {
    extractDate,
    getBulkModeButtonClass,
    getEntryCardStyle,
    getEntryDragHighlightClass,
    getSelectedRingClass,
} from './EntriesList.utils';

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
    onTogglePinned: (entry: Entry) => void;
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
    onBulkAction?: (action: BulkAction, options?: BulkActionOptions) => void;
    onToggleBulkMode?: () => void;
    diaries?: Diary[];
    onFetchHistory?: (entryId: number) => Promise<EntryRevision[]>;
    onFetchBacklinks?: (entryId: number) => Promise<EntryBacklink[]>;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onReorderEntries?: (date: string, orderedIds: number[]) => void;
    onDiscuss?: (entry: Entry) => void;
    onRephrase?: (entry: Entry, mode: RephraseMode) => Promise<void>;
    t: TranslationFn;
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
    onTogglePinned,
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
    onFetchBacklinks,
    onDeleteRevision,
    onReorderEntries,
    onDiscuss,
    onRephrase,
    t,
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

        const dayEntries = groupedEntries[date] ?? [];
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
    const displayGroups = useMemo(
        () => [
            ...(pinnedEntries.length > 0
                ? [{ key: 'pinned', label: t('pinnedEntries'), date: null, entries: pinnedEntries }]
                : []),
            ...sortedDates.map((date) => ({
                key: date,
                label: date,
                date,
                entries: unpinnedGroupedEntries[date] ?? [],
            })),
        ],
        [pinnedEntries, sortedDates, t, unpinnedGroupedEntries],
    );
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

    if (showInitialLoading) {
        return <p className="text-center text-gray-500">{t('loadingEntries')}</p>;
    }
    if (entries.length === 0) {
        return <p className="text-center text-gray-500">{t('noEntriesFound')}</p>;
    }

    const isEditing = (entry: Entry) => editingEntry !== null && editingEntry.id === entry.id;
    const isDark = config.theme !== 'light';
    const dragToReorderLabel = t('dragToReorder') === 'dragToReorder' ? 'Drag to reorder' : t('dragToReorder');
    const dropHereLabel = t('dropToReorder') === 'dropToReorder' ? 'Release to move here' : t('dropToReorder');
    const allEntryIds = entries.map((entry) => entry.id);
    const allSelected = bulkMode && selectedIds && allEntryIds.length > 0 && allEntryIds.every((id) => selectedIds.has(id));

    return (
        <div className="space-y-4">
            {isRefreshing && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-gray-700 bg-gray-900/70 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    {t('loadingEntries')}
                </div>
            )}

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

            <div className="space-y-8">
                {displayGroups.map((group) => (
                    <div key={group.key} className="space-y-4">
                        <h2 className={`text-xl font-bold border-b pb-2 ${isDark ? 'text-gray-300 border-gray-700' : 'text-gray-800 border-gray-300'}`}>
                            {group.label}
                        </h2>
                        <div className="space-y-4">
                            {group.entries.map((entry) => {
                                const date = group.date ?? extractDate(entry.date);
                                const isDraggable = group.date !== null && !bulkMode && !isEditing(entry) && !!onReorderEntries && group.entries.length > 1;
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
                                                    onTogglePinned={onTogglePinned}
                                                    onEdit={onEdit}
                                                    onDelete={onDelete}
                                                    onNavigateToEntry={onNavigateToEntry}
                                                    onShareEntry={onShareEntry}
                                                    getEntryPermalink={getEntryPermalink}
                                                    onBackToSource={onBackToSource}
                                                    onFetchHistory={onFetchHistory}
                                                    onFetchBacklinks={onFetchBacklinks}
                                                    onDeleteRevision={onDeleteRevision}
                                                    onDiscuss={onDiscuss}
                                                    onRephrase={onRephrase}
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
