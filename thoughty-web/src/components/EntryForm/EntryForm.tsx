import { Suspense, lazy, useRef, useEffect, type ComponentPropsWithoutRef, type Dispatch, type SetStateAction } from 'react';
import TagPicker from '../TagPicker/TagPicker';
import AttachmentUpload from '../AttachmentUpload/AttachmentUpload';
import TypedDatePicker from '../TypedDatePicker/TypedDatePicker';
import type { Attachment } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';

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
    onRemoveUploadedAttachment
}: EntryFormProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const getVisibilityButtonClass = (): string => {
        if (visibility === 'public') {
            return 'border-green-500 bg-green-500/10 text-green-500';
        }
        return theme === 'light'
            ? 'border-gray-300 bg-gray-50 text-gray-500'
            : 'border-gray-600 bg-gray-800 text-gray-400';
    };

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
        : getVisibilityButtonClass();

    return (
        <div className={containerClass}>
            <form onSubmit={onSubmit} className="space-y-4 overflow-visible">
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
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${getVisibilityButtonClass()}`}
                        title={visibility === 'public' ? t('publicTooltip') : t('privateTooltip')}
                    >
                        {visibility === 'public' ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        )}
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
