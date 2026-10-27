import { Suspense, lazy, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from 'react';
import TagPicker from '../TagPicker/TagPicker';
import AttachmentUpload from '../AttachmentUpload/AttachmentUpload';
import TypedDatePicker from '../TypedDatePicker/TypedDatePicker';
import VisibilityIcon from '../VisibilityIcon/VisibilityIcon';
import type { Attachment, Config, TranslationFunction as TranslationFn } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import { getEditFormatButtonClass, getVisibilityButtonClass } from './EntriesList.utils';
import { resolveFontColor } from '../../types/config';
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea';
import EntryTimeField from '../EntryForm/EntryTimeField';
import EntryMoodField from '../EntryForm/EntryMoodField';
import { MAX_ENTRY_TITLE_LENGTH } from '../../utils/entryTime';
import MarkdownHelp from '../MarkdownEditor/MarkdownHelp';
import FocusModeLauncher from '../FocusMode/FocusModeLauncher';
import MentionSuggestions from '../People/MentionSuggestions';
import { useMentionAutocomplete } from '../People/useMentionAutocomplete';
import { resolveLanguage } from '../../utils/language';
import { useInlineImageInsert } from '../InlineImages/useInlineImageInsert';

const LazyMDEditor = lazy(() => import('../MarkdownEditor/MarkdownEditor'));

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
                className={`relative z-40 flex w-6 shrink-0 items-center justify-center rounded-md py-0.5 transition-all cursor-grab active:cursor-grabbing select-none ${dragHandleClass}`}
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
    /** The entry being edited, so its fields get ids of their own. */
    entryId?: number;
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
    entryId,
    editText,
    setEditText,
    editTitle = '',
    setEditTitle,
    editTimeOfDay = '',
    setEditTimeOfDay,
    editMood = null,
    setEditMood,
    editFeelings = [],
    setEditFeelings,
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
    const writingTextColor = resolveFontColor(config.fontColor, config.theme);
    const inputClass = isDark
        ? 'bg-gray-900 border-gray-700 text-gray-100'
        : 'bg-gray-50 border-gray-300 text-gray-900';
    const editFormatButtonClass = getEditFormatButtonClass(editFormat, config.theme);
    const editArea = useAutoGrowTextarea(editText);
    const mentions = useMentionAutocomplete(editText, setEditText);
    const inlineImages = useInlineImageInsert({
        text: editText,
        setText: setEditText,
        pendingFiles: editPendingFiles ?? [],
        attachments: editExistingAttachments ?? [],
        theme: config.theme,
        t,
    });
    const mentionSuggestions = (
        <MentionSuggestions suggestions={mentions.suggestions} theme={config.theme} language={resolveLanguage(config.language)} t={t} />
    );

    const fieldId = `edit-entry-${entryId ?? 'draft'}`;

    return (
        <div className="space-y-4" data-focus-mode-scope="">
            {setEditTitle && (
                <div>
                    <label htmlFor={`${fieldId}-title`} className="sr-only">{t('entryTitleLabel')}</label>
                    <input
                        id={`${fieldId}-title`}
                        type="text"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        maxLength={MAX_ENTRY_TITLE_LENGTH}
                        placeholder={t('entryTitlePlaceholder')}
                        className={`w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none ${inputClass}`}
                        style={{ color: writingTextColor }}
                    />
                </div>
            )}
            <div ref={inlineImages.fieldRef} {...mentions.wrapperProps}>
                {editFormat === 'markdown' ? (
                    <Suspense
                        fallback={(
                            <textarea
                                ref={editArea.ref}
                                onPointerUp={editArea.onPointerUp}
                                className={`w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y ${inputClass}`}
                                style={{ color: writingTextColor }}
                                rows={3}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                {...mentions.fieldProps}
                            />
                        )}
                    >
                        <div className="relative" data-color-mode={isDark ? 'dark' : 'light'}>
                            <LazyMDEditor
                                value={editText}
                                onChange={(val) => setEditText(val ?? '')}
                                preview="edit"
                                height={200}
                                textareaProps={{ 'aria-label': t('entryTextLabel'), style: { color: writingTextColor }, ...mentions.fieldProps }}
                                onInsertImage={inlineImages.open}
                                t={t}
                            />
                            {mentionSuggestions}
                        </div>
                        <MarkdownHelp theme={config.theme} t={t} />
                    </Suspense>
                ) : (
                    <div className="relative">
                        <textarea
                            ref={editArea.ref}
                            onPointerUp={editArea.onPointerUp}
                            className={`w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y ${inputClass}`}
                            style={{ color: writingTextColor }}
                            rows={3}
                            aria-label={t('entryTextLabel')}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            {...mentions.fieldProps}
                        />
                        {mentionSuggestions}
                    </div>
                )}
            </div>
            {setEditMood && setEditFeelings && (
                <EntryMoodField
                    id={`${fieldId}-mood`}
                    mood={editMood}
                    onMoodChange={setEditMood}
                    feelings={editFeelings}
                    onFeelingsChange={setEditFeelings}
                    theme={config.theme}
                    t={t}
                />
            )}
            <div className="flex flex-wrap gap-3">
                <div className="w-40">
                    <label htmlFor={`${fieldId}-date`} className="sr-only">{t('entryDateLabel')}</label>
                    <TypedDatePicker
                        id={`${fieldId}-date`}
                        selected={editDate}
                        onChange={(date: Date | null) => setEditDate(date)}
                        className={`w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${inputClass}`}
                        dateFormat="yyyy-MM-dd"
                    />
                </div>
                {setEditTimeOfDay && (
                    <EntryTimeField
                        id={`${fieldId}-time`}
                        value={editTimeOfDay}
                        onChange={setEditTimeOfDay}
                        inputClass={`border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${inputClass}`}
                        theme={config.theme}
                        t={t}
                    />
                )}
                <div className="flex-1">
                    <TagPicker
                        availableTags={allTags}
                        selectedTags={editTags}
                        tagMetadata={tagMetadata}
                        onChange={setEditTags}
                        placeholder={t('tagPickerPlaceholder')}
                        t={t}
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
                <FocusModeLauncher
                    text={editText}
                    onTextChange={setEditText}
                    theme={config.theme}
                    fontColor={config.fontColor}
                    fontFamily={config.fontFamily}
                    fontSize={config.fontSize}
                    language={config.language}
                    t={t}
                />
                {onAddEditFile && (
                    <AttachmentUpload
                        pendingFiles={editPendingFiles || []}
                        uploadedAttachments={editExistingAttachments || []}
                        onAddFile={onAddEditFile}
                        onRemovePendingFile={onRemoveEditPendingFile || (() => {})}
                        onRemoveUploadedAttachment={onRemoveEditAttachment || (() => {})}
                        onInsertImage={editFormat === 'markdown' ? inlineImages.open : undefined}
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
                <button type="button"
                    onClick={onSaveEdit}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <span className="codicon codicon-save" aria-hidden="true" />
                    {t('save')}
                </button>
                <button type="button"
                    onClick={onCancelEdit}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    {t('cancel')}
                </button>
            </div>
            {inlineImages.dialog}
        </div>
    );
}
