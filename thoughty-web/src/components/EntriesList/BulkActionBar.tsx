import { useRef, useState, type KeyboardEvent } from 'react';
import TagPicker from '../TagPicker/TagPicker';
import type { RephraseMode } from '../../services/api/aiService';
import type { Diary, TranslationFunction as TranslationFn } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import type { Language } from '../../utils/translations';
import { useFeatureFlag } from '../FeatureFlags/featureFlags';

export type BulkAction = 'delete' | 'visibility' | 'tags' | 'move' | 'archive' | 'rephrase' | 'book';

export interface BulkActionOptions {
    visibility?: 'public' | 'private';
    tags?: string[];
    diaryId?: number;
    isArchived?: boolean;
    mode?: RephraseMode;
}

interface BulkActionBarProps {
    selectedCount: number;
    allTags: string[];
    tagMetadata: TagMetadataMap;
    diaries: Diary[];
    isDark: boolean;
    language: Language;
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
    language,
    onBulkAction,
    onClearSelection,
    t,
}: Readonly<BulkActionBarProps>) {
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [showMovePicker, setShowMovePicker] = useState(false);
    const [showRephrasePicker, setShowRephrasePicker] = useState(false);
    const [bulkTags, setBulkTags] = useState<string[]>([]);
    const rephraseButtonRef = useRef<HTMLButtonElement>(null);
    const tagsButtonRef = useRef<HTMLButtonElement>(null);
    const moveButtonRef = useRef<HTMLButtonElement>(null);
    const aiOn = useFeatureFlag('ai');
    const publicSharing = useFeatureFlag('publicSharing');
    const bookConverter = useFeatureFlag('bookConverter');
    const allBulkButtons = [
        { action: 'delete' as const, label: t('bulkDelete'), className: 'px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors' },
        { action: 'visibility' as const, options: { visibility: 'public' as const }, label: t('bulkMakePublic'), className: 'px-3 py-1.5 text-xs font-medium bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors' },
        { action: 'visibility' as const, options: { visibility: 'private' as const }, label: t('bulkMakePrivate'), className: `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-500 hover:bg-gray-600 text-white'}` },
        { action: 'archive' as const, options: { isArchived: true }, label: t('bulkArchive'), className: 'px-3 py-1.5 text-xs font-medium bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors' },
        { action: 'archive' as const, options: { isArchived: false }, label: t('bulkUnarchive'), className: `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-500 hover:bg-slate-600 text-white'}` },
        { action: 'book' as const, label: t('bulkMakeBook'), className: 'px-3 py-1.5 text-xs font-medium bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors' },
    ];
    // Making entries public and making a book are left out while their feature is switched off
    const bulkButtons = allBulkButtons.filter(({ action, options }) =>
        (action !== 'book' || bookConverter) && (options?.visibility !== 'public' || publicSharing));

    if (selectedCount === 0) {
        return null;
    }

    // Escape closes the open picker, as Cancel would, and gives focus back to its button
    const closePickerOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape') return;
        const trigger = (showRephrasePicker && rephraseButtonRef) || (showTagPicker && tagsButtonRef) || (showMovePicker && moveButtonRef);
        if (!trigger) return;
        setShowRephrasePicker(false);
        setShowTagPicker(false);
        setShowMovePicker(false);
        setBulkTags([]);
        trigger.current?.focus();
    };

    return (
        <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 p-3 rounded-lg border shadow-md mb-4 ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {pluralPhrase(t, 'bulkSelected', selectedCount, language)}
            </span>
            {/* Keys from the pickers' own buttons and fields bubble here */}
            <div className="flex flex-wrap gap-2 ml-auto" onKeyDown={closePickerOnEscape}>
                {bulkButtons.map(({ action, options, label, className }) => (
                    <button type="button"
                        key={`${action}-${label}`}
                        onClick={() => onBulkAction(action, options)}
                        className={className}
                    >
                        {label}
                    </button>
                ))}
                {aiOn && <div className="relative">
                    <button type="button"
                        ref={rephraseButtonRef}
                        aria-expanded={showRephrasePicker}
                        onClick={() => { setShowRephrasePicker(!showRephrasePicker); setShowTagPicker(false); setShowMovePicker(false); }}
                        className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                        {t('bulkRephrase')}
                    </button>
                    {showRephrasePicker && (
                        <div className={`absolute top-full mt-1 right-0 p-2 rounded-lg border shadow-lg z-20 min-w-[220px] ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
                            {[
                                { mode: 'grammar' as const, label: t('rephraseGrammarOnly') },
                                { mode: 'polish' as const, label: t('rephraseStyleLight') },
                                { mode: 'rewrite' as const, label: t('rephraseCompleteRewrite') },
                            ].map(({ mode, label }) => (
                                <button type="button"
                                    key={mode}
                                    onClick={() => { onBulkAction('rephrase', { mode }); setShowRephrasePicker(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>}
                <div className="relative">
                    <button type="button"
                        ref={tagsButtonRef}
                        aria-expanded={showTagPicker}
                        onClick={() => { setShowTagPicker(!showTagPicker); setShowMovePicker(false); setShowRephrasePicker(false); }}
                        className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
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
                                t={t}
                                theme={isDark ? 'dark' : 'light'}
                            />
                            <div className="flex gap-2 mt-2">
                                <button type="button"
                                    onClick={() => { onBulkAction('tags', { tags: bulkTags }); setShowTagPicker(false); setBulkTags([]); }}
                                    disabled={bulkTags.length === 0}
                                    className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded transition-colors"
                                >
                                    {t('apply')}
                                </button>
                                <button type="button"
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
                        <button type="button"
                            ref={moveButtonRef}
                            aria-expanded={showMovePicker}
                            onClick={() => { setShowMovePicker(!showMovePicker); setShowTagPicker(false); setShowRephrasePicker(false); }}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            {t('bulkMove')}
                        </button>
                        {showMovePicker && (
                            <div className={`absolute top-full mt-1 right-0 p-2 rounded-lg border shadow-lg z-20 min-w-[180px] ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
                                {diaries.map((diary) => (
                                    <button type="button"
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
                <button type="button"
                    onClick={onClearSelection}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                    {t('bulkClearSelection')}
                </button>
            </div>
        </div>
    );
}
