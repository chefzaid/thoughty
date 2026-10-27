import { Suspense, lazy, useMemo, useState, type ComponentPropsWithoutRef, type Dispatch, type SetStateAction } from 'react';
import TagPicker from '../TagPicker/TagPicker';
import AttachmentUpload from '../AttachmentUpload/AttachmentUpload';
import TypedDatePicker from '../TypedDatePicker/TypedDatePicker';
import VisibilityIcon from '../VisibilityIcon/VisibilityIcon';
import type { Attachment } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import { getVisibilityButtonClass } from '../../utils/entryVisibility';
import { resolveFontColor } from '../../types/config';
import type { EntryTemplate, EntryTemplateDraft } from '../../utils/entryTemplates';
import AiSparkleIcon from '../AiSparkleIcon/AiSparkleIcon';
import GetInspiredMenu from './GetInspiredMenu';
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea';
import { aiActionButtonClass } from './aiActionButton';
import { tintedTextClass } from '../../utils/tintedText';
import EntryTimeField from './EntryTimeField';
import EntryMoodField from './EntryMoodField';
import { MAX_ENTRY_TITLE_LENGTH } from '../../utils/entryTime';
import MarkdownHelp from '../MarkdownEditor/MarkdownHelp';
import FocusModeLauncher from '../FocusMode/FocusModeLauncher';
import TemplateNameDialog from './TemplateNameDialog';
import type { FontFamilyPreference } from '../../types';
import MentionSuggestions from '../People/MentionSuggestions';
import { useMentionAutocomplete } from '../People/useMentionAutocomplete';
import { resolveLanguage } from '../../utils/language';

const LazyMDEditor = lazy(() => import('../MarkdownEditor/MarkdownEditor'));

interface EntryFormProps {
    readonly newEntryText: string;
    readonly setNewEntryText: Dispatch<SetStateAction<string>>;
    /** Optional title; empty when the entry has none. */
    readonly title?: string;
    readonly setTitle?: Dispatch<SetStateAction<string>>;
    /** Optional time of day (`HH:MM`); empty when the entry has none. */
    readonly timeOfDay?: string;
    readonly setTimeOfDay?: Dispatch<SetStateAction<string>>;
    /** Optional mood from 1 to 5, and feeling words; null and empty when not recorded. */
    readonly mood?: number | null;
    readonly setMood?: Dispatch<SetStateAction<number | null>>;
    readonly feelings?: string[];
    readonly setFeelings?: Dispatch<SetStateAction<string[]>>;
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
    readonly onGetInspiration?: () => Promise<string | null>;
    readonly onSubmit: NonNullable<ComponentPropsWithoutRef<'form'>['onSubmit']>;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly pendingFiles?: File[];
    readonly uploadedAttachments?: Attachment[];
    readonly onAddFile?: (file: File) => void;
    readonly onRemovePendingFile?: (index: number) => void;
    readonly onRemoveUploadedAttachment?: (id: number) => void;
    readonly fontColor?: string;
    /** The writer's font settings and language, used by focus mode. */
    readonly fontFamily?: FontFamilyPreference;
    readonly fontSize?: string | number;
    readonly language?: string;
    readonly entryTemplates?: EntryTemplate[];
    /** Resolves whether the template was saved; the name dialog stays open with a message when it was not. */
    readonly onSaveTemplate?: (template: EntryTemplateDraft) => Promise<boolean>;
    /** Resolves whether the template was deleted; it stays selected when it was not. */
    readonly onDeleteTemplate?: (templateId: string) => Promise<boolean>;
}

function entryFormClasses({ theme, format, visibility }: Pick<EntryFormProps, 'theme' | 'format' | 'visibility'>) {
    const inputClass = `w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none ${theme === 'light'
        ? 'bg-gray-50 border-gray-300 text-gray-900'
        : 'bg-gray-900 border-gray-700 text-gray-100'
        }`;

    const containerClass = `relative z-40 rounded-xl p-6 shadow-lg border mb-8 backdrop-blur-sm bg-opacity-50 overflow-visible ${theme === 'light'
        ? 'bg-white border-gray-200'
        : 'bg-gray-800 border-gray-700'
        }`;

    const markdownToggleClass = format === 'markdown'
        ? `border-indigo-500 bg-indigo-500/10 ${tintedTextClass('indigo', theme)}`
        : getVisibilityButtonClass(visibility ?? 'private', theme);

    return { inputClass, containerClass, markdownToggleClass };
}

function EntryForm({
    newEntryText,
    setNewEntryText,
    title = '',
    setTitle,
    timeOfDay = '',
    setTimeOfDay,
    mood = null,
    setMood,
    feelings = [],
    setFeelings,
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
    onGetInspiration,
    onSubmit,
    theme,
    t,
    pendingFiles,
    uploadedAttachments,
    onAddFile,
    onRemovePendingFile,
    onRemoveUploadedAttachment,
    fontColor,
    fontFamily,
    fontSize,
    language,
    entryTemplates = [],
    onSaveTemplate,
    onDeleteTemplate
}: EntryFormProps) {
    const writingArea = useAutoGrowTextarea(newEntryText);
    const mentions = useMentionAutocomplete(newEntryText, setNewEntryText);
    const mentionSuggestions = (
        <MentionSuggestions suggestions={mentions.suggestions} theme={theme} language={resolveLanguage(language)} t={t} />
    );
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [isNamingTemplate, setIsNamingTemplate] = useState(false);
    const writingTextColor = resolveFontColor(fontColor, theme);
    const selectedTemplate = useMemo(
        () => entryTemplates.find((template) => template.id === selectedTemplateId),
        [entryTemplates, selectedTemplateId],
    );

    const { inputClass, containerClass, markdownToggleClass } = entryFormClasses({ theme, format, visibility });

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

    const saveCurrentDraftAsTemplate = async (name: string): Promise<boolean> => {
        if (!onSaveTemplate) {
            return false;
        }

        const saved = await onSaveTemplate({
            name,
            content: newEntryText,
            tags,
            visibility: visibility ?? 'private',
            format,
        });
        if (saved) {
            setIsNamingTemplate(false);
        }
        return saved;
    };

    const deleteSelectedTemplate = async (): Promise<void> => {
        if (!selectedTemplate || selectedTemplate.builtIn || !onDeleteTemplate) {
            return;
        }

        if (await onDeleteTemplate(selectedTemplate.id)) {
            setSelectedTemplateId('');
        }
    };

    return (
        <div className={containerClass} data-focus-mode-scope="">
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
                                onClick={() => setIsNamingTemplate(true)}
                                disabled={newEntryText.trim() === ''}
                                aria-haspopup="dialog"
                                className={`inline-flex h-10 shrink-0 items-center gap-2 px-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-sm ${tintedTextClass('emerald', theme)} hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={t('saveEntryTemplate')}
                            >
                                <span className="codicon codicon-save" aria-hidden="true" />
                                {t('saveEntryTemplate')}
                            </button>
                        )}
                        {selectedTemplate && !selectedTemplate.builtIn && onDeleteTemplate && (
                            <button
                                type="button"
                                onClick={() => void deleteSelectedTemplate()}
                                className={`h-10 shrink-0 px-3 rounded-lg border border-red-500/40 bg-red-500/10 ${tintedTextClass('red', theme)} hover:bg-red-500/20 transition-all`}
                                title={t('deleteEntryTemplate')}
                            >
                                {t('deleteEntryTemplate')}
                            </button>
                        )}
                        {isNamingTemplate && (
                            <TemplateNameDialog
                                theme={theme}
                                t={t}
                                onCancel={() => setIsNamingTemplate(false)}
                                onSave={saveCurrentDraftAsTemplate}
                            />
                        )}
                    </div>
                )}
                {setTitle && (
                    <div>
                        <label htmlFor="composer-title" className="sr-only">{t('entryTitleLabel')}</label>
                        <input
                            id="composer-title"
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            maxLength={MAX_ENTRY_TITLE_LENGTH}
                            placeholder={t('entryTitlePlaceholder')}
                            className={`${inputClass} font-semibold`}
                            style={{ color: writingTextColor }}
                        />
                    </div>
                )}
                <div {...mentions.wrapperProps}>
                    {format === 'markdown' ? (
                        <Suspense
                            fallback={(
                                <textarea
                                    ref={writingArea.ref}
                                    onPointerUp={writingArea.onPointerUp}
                                    className={`w-full border p-4 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors resize-y ${theme === 'light'
                                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                                        : 'bg-gray-900 border-gray-700 text-gray-100'
                                        }`}
                                    style={{ color: writingTextColor }}
                                    rows={3}
                                    placeholder={t('whatsOnYourMind')}
                                    title={t('entryReferenceHint')}
                                    value={newEntryText}
                                    onChange={(e) => setNewEntryText(e.target.value)}
                                    {...mentions.fieldProps}
                                />
                            )}
                        >
                            <div className="relative" data-color-mode={theme === 'light' ? 'light' : 'dark'}>
                                <LazyMDEditor
                                    value={newEntryText}
                                    onChange={(val) => setNewEntryText(val ?? '')}
                                    preview="edit"
                                    height={200}
                                    textareaProps={{
                                        placeholder: t('whatsOnYourMind'),
                                        title: t('entryReferenceHint'),
                                        style: { color: writingTextColor },
                                        ...mentions.fieldProps,
                                    }}
                                    t={t}
                                />
                                {mentionSuggestions}
                            </div>
                            <MarkdownHelp theme={theme} t={t} />
                        </Suspense>
                    ) : (
                        <div className="relative">
                            <textarea
                                ref={writingArea.ref}
                                onPointerUp={writingArea.onPointerUp}
                                className={`w-full border p-4 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors resize-y ${theme === 'light'
                                    ? 'bg-gray-50 border-gray-300 text-gray-900'
                                    : 'bg-gray-900 border-gray-700 text-gray-100'
                                    }`}
                                style={{ color: writingTextColor }}
                                rows={3}
                                placeholder={t('whatsOnYourMind')}
                                title={t('entryReferenceHint')}
                                value={newEntryText}
                                onChange={(e) => setNewEntryText(e.target.value)}
                                {...mentions.fieldProps}
                            />
                            {mentionSuggestions}
                        </div>
                    )}
                </div>
                {setMood && setFeelings && (
                    <EntryMoodField
                        id="composer-mood"
                        mood={mood}
                        onMoodChange={setMood}
                        feelings={feelings}
                        onFeelingsChange={setFeelings}
                        theme={theme}
                        t={t}
                    />
                )}
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="w-40 z-10">
                        <label htmlFor="composer-date" className="sr-only">{t('entryDateLabel')}</label>
                        <TypedDatePicker
                            id="composer-date"
                            selected={selectedDate}
                            onChange={(date: Date | null) => date && setSelectedDate(date)}
                            className={inputClass}
                            dateFormat="yyyy-MM-dd"
                        />
                    </div>
                    {setTimeOfDay && (
                        <EntryTimeField
                            id="composer-time"
                            value={timeOfDay}
                            onChange={setTimeOfDay}
                            inputClass={inputClass}
                            theme={theme}
                            t={t}
                        />
                    )}
                    <div className="flex-1 relative z-20">
                        <TagPicker
                            availableTags={allTags}
                            selectedTags={tags}
                            tagMetadata={tagMetadata}
                            onChange={setTags}
                            placeholder={t('tagPickerPlaceholder')}
                            t={t}
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
                            className={aiActionButtonClass('amber', theme)}
                            title={t('autoTagDescription')}
                        >
                            <AiSparkleIcon />
                            <span>{suggestingTags ? t('suggestingTags') : t('suggestTags')}</span>
                        </button>
                    )}
                    {onFixWriting && (
                        <button
                            type="button"
                            onClick={() => {
                                onFixWriting();
                            }}
                            disabled={fixingWriting}
                            className={aiActionButtonClass('teal', theme)}
                        >
                            <AiSparkleIcon />
                            <span>{fixingWriting ? t('fixingWriting') : t('fixWriting')}</span>
                        </button>
                    )}
                    {onGetInspiration && (
                        <GetInspiredMenu
                            onGenerate={onGetInspiration}
                            onSelect={(question) => setNewEntryText((current) => (
                                current.trim() ? `${current}\n\n${question}` : question
                            ))}
                            theme={theme}
                            t={t}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setFormat(f => f === 'plain' ? 'markdown' : 'plain')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${markdownToggleClass}`}
                        title={format === 'markdown' ? t('markdownEnabled') : t('markdownDisabled')}
                    >
                        <span className="text-sm font-bold" style={{ fontFamily: 'monospace' }}>MD</span>
                    </button>
                    <FocusModeLauncher
                        text={newEntryText}
                        onTextChange={setNewEntryText}
                        theme={theme}
                        fontColor={fontColor}
                        fontFamily={fontFamily}
                        fontSize={fontSize}
                        language={language}
                        placeholder={t('whatsOnYourMind')}
                        t={t}
                    />
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
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-md"
                    >
                        <span className="codicon codicon-save" aria-hidden="true" />
                        {t('save')}
                    </button>
                </div>
            </form>
            {formError && (
                <div role="alert" className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {t(formError)}
                </div>
            )}
        </div>
    );
}

export default EntryForm;
