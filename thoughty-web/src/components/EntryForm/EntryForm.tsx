import { Suspense, lazy, useRef, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type Dispatch, type SetStateAction } from 'react';
import TagPicker from '../TagPicker/TagPicker';
import AttachmentUpload from '../AttachmentUpload/AttachmentUpload';
import TypedDatePicker from '../TypedDatePicker/TypedDatePicker';
import VisibilityIcon from '../VisibilityIcon/VisibilityIcon';
import type { Attachment } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import { getVisibilityButtonClass } from '../../utils/entryVisibility';
import { resolveFontColor } from '../../types/config';
import type { EntryTemplate, EntryTemplateDraft } from '../../utils/entryTemplates';

const LazyMDEditor = lazy(() => import('@uiw/react-md-editor/nohighlight'));

interface EntryFormProps {
    readonly newEntryText: string;
    readonly setNewEntryText: Dispatch<SetStateAction<string>>;
    readonly selectedDate: Date;
    readonly setSelectedDate: Dispatch<SetStateAction<Date>>;
    readonly tags: string[];
    readonly setTags: Dispatch<SetStateAction<string[]>>;
    readonly visibility: 'public' | 'private' | null;
    readonly setVisibility: Dispatch<SetStateAction<'public' | 'private' | null>>;
    readonly format: 'plain' | 'markdown';
    readonly setFormat: Dispatch<SetStateAction<'plain' | 'markdown'>>;
    readonly allTags: string[];
    readonly tagMetadata?: TagMetadataMap;
    readonly formError: string;
    readonly suggestingTags?: boolean;
    readonly onSuggestTags?: () => Promise<boolean> | boolean;
    readonly fixingWriting?: boolean;
    readonly onFixWriting?: () => Promise<boolean> | boolean;
    readonly onSubmit: NonNullable<ComponentPropsWithoutRef<'form'>['onSubmit']>;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly pendingFiles?: File[];
    readonly uploadedAttachments?: Attachment[];
    readonly onAddFile?: (file: File) => void;
    readonly onRemovePendingFile?: (index: number) => void;
    readonly onRemoveUploadedAttachment?: (id: number) => void;
    readonly fontColor?: string;
    readonly entryTemplates?: EntryTemplate[];
    readonly onSaveTemplate?: (template: EntryTemplateDraft) => Promise<void> | void;
    readonly onDeleteTemplate?: (templateId: string) => Promise<void> | void;
}

function EntryForm({
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
    suggestingTags = false,
    onSuggestTags,
    fixingWriting = false,
    onFixWriting,
    onSubmit,
    theme,
    t,
    pendingFiles,
    uploadedAttachments,
    onAddFile,
    onRemovePendingFile,
    onRemoveUploadedAttachment,
    fontColor,
    entryTemplates = [],
    onSaveTemplate,
    onDeleteTemplate
}: EntryFormProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const writingTextColor = resolveFontColor(fontColor, theme);
    const selectedTemplate = useMemo(
        () => entryTemplates.find((template) => template.id === selectedTemplateId),
        [entryTemplates, selectedTemplateId],
    );

    // Auto-resize textarea based on content
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.max(textarea.scrollHeight, 76)}px`; // 76px ≈ 3 rows minimum
        }
    }, [newEntryText]);

    const inputClass = `w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none ${theme === 'light'
        ? 'bg-gray-50 border-gray-300 text-gray-900'
        : 'bg-gray-900 border-gray-700 text-gray-100'
        }`;

    const containerClass = `relative z-40 rounded-xl p-6 shadow-lg border mb-8 backdrop-blur-sm bg-opacity-50 overflow-visible ${theme === 'light'
        ? 'bg-white border-gray-200'
        : 'bg-gray-800 border-gray-700'
        }`;

    const markdownToggleClass = format === 'markdown'
        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
        : getVisibilityButtonClass(visibility ?? 'private', theme);

    const applyTemplate = (templateId: string): void => {
        setSelectedTemplateId(templateId);
        const template = entryTemplates.find((candidate) => candidate.id === templateId);
        if (!template) {
            return;
        }

        setNewEntryText(template.content);
        setTags(template.tags);
        setVisibility(template.visibility);
        setFormat(template.format);
    };

    const saveCurrentDraftAsTemplate = async (): Promise<void> => {
        if (!onSaveTemplate) {
            return;
        }

        const name = globalThis.prompt(t('templateNamePrompt'));
        if (!name?.trim()) {
            return;
        }

        await onSaveTemplate({
            name,
            content: newEntryText,
            tags,
            visibility: visibility ?? 'private',
            format,
        });
    };

    const deleteSelectedTemplate = async (): Promise<void> => {
        if (!selectedTemplate || selectedTemplate.builtIn || !onDeleteTemplate) {
            return;
        }

        await onDeleteTemplate(selectedTemplate.id);
        setSelectedTemplateId('');
    };

    return (
        <div className={containerClass}>
            <form onSubmit={onSubmit} className="space-y-4 overflow-visible">
                {(entryTemplates.length > 0 || onSaveTemplate) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {entryTemplates.length > 0 && (
                            <select
                                value={selectedTemplateId}
                                onChange={(event) => applyTemplate(event.target.value)}
                                className={`min-w-0 flex-1 basis-56 border rounded-lg px-3 h-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
                                    ? 'bg-gray-50 border-gray-300 text-gray-900'
                                    : 'bg-gray-900 border-gray-700 text-gray-100'
                                    }`}
                                aria-label={t('entryTemplate')}
                                title={t('entryTemplate')}
                            >
                                <option value="">{t('noEntryTemplate')}</option>
                                {entryTemplates.map((template) => (
                                    <option key={template.id} value={template.id}>
                                        {template.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        {onSaveTemplate && (
                            <button
                                type="button"
                                onClick={() => void saveCurrentDraftAsTemplate()}
                                disabled={newEntryText.trim() === ''}
                                className="h-10 shrink-0 px-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title={t('saveEntryTemplate')}
                            >
                                {t('saveEntryTemplate')}
                            </button>
                        )}
                        {selectedTemplate && !selectedTemplate.builtIn && onDeleteTemplate && (
                            <button
                                type="button"
                                onClick={() => void deleteSelectedTemplate()}
                                className="h-10 shrink-0 px-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                                title={t('deleteEntryTemplate')}
                            >
                                {t('deleteEntryTemplate')}
                            </button>
                        )}
                    </div>
                )}
                <div>
                    {format === 'markdown' ? (
                        <Suspense
                            fallback={(
                                <textarea
                                    ref={textareaRef}
                                    className={`w-full border p-4 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none ${theme === 'light'
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-gray-900 border-gray-700 text-gray-100'
                                        }`}
                                    style={{ color: writingTextColor }}
                                    rows={3}
                                    placeholder={t('whatsOnYourMind')}
                                    title={t('entryReferenceHint')}
                                    value={newEntryText}
                                    onChange={(e) => setNewEntryText(e.target.value)}
                                />
                            )}
                        >
                            <div data-color-mode={theme === 'light' ? 'light' : 'dark'}>
                                <LazyMDEditor
                                    value={newEntryText}
                                    onChange={(val) => setNewEntryText(val ?? '')}
                                    preview="edit"
                                    visibleDragbar={false}
                                    height={200}
                                    textareaProps={{
                                        placeholder: t('whatsOnYourMind'),
                                        title: t('entryReferenceHint'),
                                        style: { color: writingTextColor },
                                    }}
                                />
                            </div>
                        </Suspense>
                    ) : (
                        <textarea
                            ref={textareaRef}
                            className={`w-full border p-4 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none ${theme === 'light'
                                ? 'bg-gray-50 border-gray-300 text-gray-900'
                                : 'bg-gray-900 border-gray-700 text-gray-100'
                                }`}
                            style={{ color: writingTextColor }}
                            rows={3}
                            placeholder={t('whatsOnYourMind')}
                            title={t('entryReferenceHint')}
                            value={newEntryText}
                            onChange={(e) => setNewEntryText(e.target.value)}
                        />
                    )}
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="w-40 z-10">
                        <TypedDatePicker
                            selected={selectedDate}
                            onChange={(date: Date | null) => date && setSelectedDate(date)}
                            className={inputClass}
                            dateFormat="yyyy-MM-dd"
                        />
                    </div>
                    <div className="flex-1 relative z-20">
                        <TagPicker
                            availableTags={allTags}
                            selectedTags={tags}
                            tagMetadata={tagMetadata}
                            onChange={setTags}
                            placeholder={t('filterTagsPlaceholder').replace('Filter by ', '')}
                            theme={theme}
                        />
                    </div>
                    {onSuggestTags && (
                        <button
                            type="button"
                            onClick={() => {
                                onSuggestTags();
                            }}
                            disabled={suggestingTags}
                            className="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {suggestingTags ? t('suggestingTags') : t('suggestTags')}
                        </button>
                    )}
                    {onFixWriting && (
                        <button
                            type="button"
                            onClick={() => {
                                onFixWriting();
                            }}
                            disabled={fixingWriting}
                            className="px-3 py-2 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-500 hover:bg-teal-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {fixingWriting ? t('fixingWriting') : t('fixWriting')}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setFormat(f => f === 'plain' ? 'markdown' : 'plain')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${markdownToggleClass}`}
                        title={format === 'markdown' ? t('markdownEnabled') : t('markdownDisabled')}
                    >
                        <span className="text-sm font-bold" style={{ fontFamily: 'monospace' }}>MD</span>
                    </button>
                    {onAddFile && (
                        <AttachmentUpload
                            pendingFiles={pendingFiles || []}
                            uploadedAttachments={uploadedAttachments || []}
                            onAddFile={onAddFile}
                            onRemovePendingFile={onRemovePendingFile || (() => {})}
                            onRemoveUploadedAttachment={onRemoveUploadedAttachment || (() => {})}
                            theme={theme}
                            t={t}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setVisibility(v => v === 'private' ? 'public' : 'private')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${getVisibilityButtonClass(visibility ?? 'private', theme)}`}
                        title={visibility === 'public' ? t('publicTooltip') : t('privateTooltip')}
                    >
                        <VisibilityIcon visibility={visibility ?? 'private'} className="w-5 h-5" />
                    </button>
                    <button
                        type="submit"
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-md"
                    >
                        {t('save')}
                    </button>
                </div>
            </form>
            {formError && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {formError}
                </div>
            )}
        </div>
    );
}

export default EntryForm;
