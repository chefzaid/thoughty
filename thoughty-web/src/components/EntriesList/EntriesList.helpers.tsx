import { Suspense, lazy, useState as useLocalState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from 'react';
import TagPicker from '../TagPicker/TagPicker';
import AttachmentUpload from '../AttachmentUpload/AttachmentUpload';
import TypedDatePicker from '../TypedDatePicker/TypedDatePicker';
import VisibilityIcon from '../VisibilityIcon/VisibilityIcon';
import type { Attachment, Config, Diary, TranslationFunction as TranslationFn } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import { getEditFormatButtonClass, getVisibilityButtonClass } from './EntriesList.utils';

const LazyMDEditor = lazy(() => import('@uiw/react-md-editor/nohighlight'));

export type BulkAction = 'delete' | 'visibility' | 'tags' | 'move' | 'archive';

export interface BulkActionOptions {
    visibility?: 'public' | 'private';
    tags?: string[];
    diaryId?: number;
    isArchived?: boolean;
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
    readonly onHandlePointerDown: (event: PointerEvent) => void;
    readonly onHandleKeyDown: (event: KeyboardEvent) => void;
    readonly onTargetPointerEnter: () => void;
    readonly onTargetPointerUp: () => void;
}

export function EntryReorderControls({
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

interface EditFormProps {
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
    t: TranslationFn;
}

export function EditForm({
    config,
    editText,
    setEditText,
    editDate,
    setEditDate,
    allTags,
    tagMetadata,
    editTags,
    setEditTags,
    editVisibility,
    setEditVisibility,
    editFormat,
    setEditFormat,
    editPendingFiles,
    editExistingAttachments,
    onAddEditFile,
    onRemoveEditPendingFile,
    onRemoveEditAttachment,
    onSaveEdit,
    onCancelEdit,
    t,
}: Readonly<EditFormProps>) {
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
                    onClick={() => setEditFormat((f) => f === 'plain' ? 'markdown' : 'plain')}
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
                    onClick={() => setEditVisibility((v) => v === 'private' ? 'public' : 'private')}
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

interface BulkActionBarProps {
    selectedCount: number;
    allTags: string[];
    tagMetadata: TagMetadataMap;
    diaries: Diary[];
    isDark: boolean;
    onBulkAction: (action: BulkAction, options?: BulkActionOptions) => void;
    onClearSelection: () => void;
    t: TranslationFn;
}

export function BulkActionBar({
    selectedCount,
    allTags,
    tagMetadata,
    diaries,
    isDark,
    onBulkAction,
    onClearSelection,
    t,
}: Readonly<BulkActionBarProps>) {
    const [showTagPicker, setShowTagPicker] = useLocalState(false);
    const [showMovePicker, setShowMovePicker] = useLocalState(false);
    const [bulkTags, setBulkTags] = useLocalState<string[]>([]);
    const bulkButtons = [
        { action: 'delete' as const, label: t('bulkDelete'), className: 'px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors' },
        { action: 'visibility' as const, options: { visibility: 'public' as const }, label: t('bulkMakePublic'), className: 'px-3 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors' },
        { action: 'visibility' as const, options: { visibility: 'private' as const }, label: t('bulkMakePrivate'), className: `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-gray-400 hover:bg-gray-500 text-white'}` },
        { action: 'archive' as const, options: { isArchived: true }, label: t('bulkArchive'), className: 'px-3 py-1.5 text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors' },
        { action: 'archive' as const, options: { isArchived: false }, label: t('bulkUnarchive'), className: `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-500 hover:bg-slate-600 text-white'}` },
    ];

    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 p-3 rounded-lg border shadow-md mb-4 ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('bulkSelected', { count: selectedCount })}
            </span>
            <div className="flex flex-wrap gap-2 ml-auto">
                {bulkButtons.map(({ action, options, label, className }) => (
                    <button
                        key={`${action}-${label}`}
                        onClick={() => onBulkAction(action, options)}
                        className={className}
                    >
                        {label}
                    </button>
                ))}
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
