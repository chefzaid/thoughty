import type { ReactNode } from 'react';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import AttachmentDisplay from '../AttachmentDisplay/AttachmentDisplay';
import TagBadge from '../TagBadge/TagBadge';
import type {
    Config,
    Entry,
    EntryRevision,
    SourceEntryInfo,
    TranslationFunction as TranslationFn,
} from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import { resolveFontColor } from '../../types/config';
import {
    extractDate,
    getEntryDiaryBadgeStyle,
} from './EntriesList.utils';
import { IconActionButton } from './EntryActionPrimitives';

export function EntryHistorySection({
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
    t: TranslationFn;
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
                                    <IconActionButton
                                        onClick={() => void onHandleDeleteRevision(rev.id)}
                                        className="p-0.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        title={t('delete')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </IconActionButton>
                                )}
                            </div>
                        </div>
                        <div className={`whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {rev.content}
                        </div>
                        {rev.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                                {rev.tags.map((tag) => (
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

export function EntryHeaderBadges({
    entry,
    showDiaryLabel,
    isDark,
    theme,
    tagMetadata,
    t,
}: Readonly<{
    entry: Entry;
    showDiaryLabel: boolean;
    isDark: boolean;
    theme: Config['theme'];
    tagMetadata: TagMetadataMap;
    t: TranslationFn;
}>) {
    return (
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
                    theme={theme}
                    size="xs"
                />
            ))}
            {entry.is_archived && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${isDark ? 'border-sky-400/35 bg-sky-500/10 text-sky-300' : 'border-sky-300 bg-sky-50 text-sky-700'}`}>
                    {t('archived')}
                </span>
            )}
        </div>
    );
}

export function EntryBodySection({
    entry,
    isDark,
    theme,
    fontColor,
    onNavigateToEntry,
    searchTerm,
    showHistory,
    loadingHistory,
    revisions,
    tagMetadata,
    onDeleteRevision,
    onHandleDeleteRevision,
    t,
}: Readonly<{
    entry: Entry;
    isDark: boolean;
    theme: Config['theme'];
    fontColor?: string;
    onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    searchTerm?: string;
    showHistory: boolean;
    loadingHistory: boolean;
    revisions: EntryRevision[];
    tagMetadata: TagMetadataMap;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onHandleDeleteRevision: (revisionId: number) => Promise<void>;
    t: TranslationFn;
}>) {
    const readingTextColor = resolveFontColor(fontColor, theme);

    return (
        <>
            <div
                className={`leading-relaxed text-sm ${entry.format === 'markdown' ? '' : 'whitespace-pre-wrap'} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                style={{ color: readingTextColor }}
            >
                <EntryContentRenderer
                    content={entry.content}
                    format={entry.format}
                    onNavigateToEntry={onNavigateToEntry}
                    sourceEntry={{
                        id: entry.id,
                        date: extractDate(entry.date),
                        index: entry.index || 1,
                    }}
                    searchTerm={searchTerm}
                />
            </div>
            {entry.attachments && entry.attachments.length > 0 && (
                <AttachmentDisplay
                    attachments={entry.attachments}
                    theme={theme}
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
                onHandleDeleteRevision={onHandleDeleteRevision}
                t={t}
            />
        </>
    );
}

export function BackToSourceButton({
    entryId,
    activeTargetId,
    sourceEntry,
    onBackToSource,
    t,
}: Readonly<{
    entryId: number;
    activeTargetId: number | null;
    sourceEntry: SourceEntryInfo | null;
    onBackToSource: () => void;
    t: TranslationFn;
}>) {
    if (activeTargetId !== entryId || !sourceEntry) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
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