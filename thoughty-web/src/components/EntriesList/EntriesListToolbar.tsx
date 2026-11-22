import type { Diary, TranslationFunction } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import type { Language } from '../../utils/translations';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { type BulkAction, type BulkActionOptions, BulkActionBar } from './BulkActionBar';
import { getBulkModeButtonClass } from './EntriesList.utils';

interface EntriesListToolbarProps {
    /** The entries loaded so far, which **Select all** selects. */
    readonly loadedIds: readonly number[];
    /** How many entries the filters match, loaded or not. */
    readonly total: number;
    readonly bulkMode?: boolean;
    readonly selectedIds?: Set<number>;
    readonly onSelectAll?: (ids: number[]) => void;
    readonly onClearSelection?: () => void;
    readonly onBulkAction?: (action: BulkAction, options?: BulkActionOptions) => void;
    readonly onToggleBulkMode?: () => void;
    readonly allTags: string[];
    readonly tagMetadata: TagMetadataMap;
    readonly diaries?: Diary[];
    readonly isDark: boolean;
    readonly language: Language;
    readonly t: TranslationFunction;
}

/**
 * Above the journal list: the bulk mode switch and, in bulk mode, **Select all** and the bulk actions.
 * **Select all** selects the entries loaded so far; while more match than are loaded it says how many it
 * selects out of how many match, since the actions (rephrasing and books among them) work on loaded entries.
 */
export default function EntriesListToolbar({
    loadedIds, total, bulkMode, selectedIds, onSelectAll, onClearSelection, onBulkAction, onToggleBulkMode,
    allTags, tagMetadata, diaries, isDark, language, t,
}: EntriesListToolbarProps) {
    const allSelected = Boolean(bulkMode && selectedIds && loadedIds.length > 0 && loadedIds.every((id) => selectedIds.has(id)));
    const selectAllLabel = total > loadedIds.length
        ? pluralPhrase(t, 'selectAllLoaded', loadedIds.length, language, { total: total.toLocaleString(language) })
        : t('selectAll');

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {bulkMode && onSelectAll && onClearSelection && selectedIds && (
                        <label className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => allSelected ? onClearSelection() : onSelectAll([...loadedIds])}
                                className="w-4 h-4 rounded accent-blue-500"
                            />
                            {selectAllLabel}
                        </label>
                    )}
                </div>
                {onToggleBulkMode && (
                    <button type="button"
                        onClick={onToggleBulkMode}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            bulkMode
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
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
                    language={language}
                    onBulkAction={onBulkAction}
                    onClearSelection={onClearSelection}
                    t={t}
                />
            )}
        </>
    );
}
