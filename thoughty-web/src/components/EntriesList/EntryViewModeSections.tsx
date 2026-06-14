import type { ReactNode } from 'react';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import AttachmentDisplay from '../AttachmentDisplay/AttachmentDisplay';
import TagBadge from '../TagBadge/TagBadge';
import type {
    Config,
    Entry,
    EntryBacklink,
    EntryRevision,
    SourceEntryInfo,
    TranslationFunction as TranslationFn,
} from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import { getEntryMetrics } from '../../utils/entryMetrics';
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
            {entry.is_pinned && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${isDark ? 'border-rose-400/35 bg-rose-500/10 text-rose-300' : 'border-rose-300 bg-rose-50 text-rose-700'}`}>
                    {t('pinned')} · {extractDate(entry.date)}
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
    loadingBacklinks,
    backlinks,
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
    loadingBacklinks: boolean;
    backlinks: EntryBacklink[];
    showHistory: boolean;
    loadingHistory: boolean;
    revisions: EntryRevision[];
    tagMetadata: TagMetadataMap;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onHandleDeleteRevision: (revisionId: number) => Promise<void>;
    t: TranslationFn;
}>) {
    const readingTextColor = resolveFontColor(fontColor, theme);
    const { wordCount, readingTimeMinutes } = getEntryMetrics(entry.content);
    const readingTimeLabel = readingTimeMinutes > 0
        ? t('entryReadingTimeMinutes', { minutes: readingTimeMinutes })
        : t('entryReadingTimeLessThanMinute');

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
            <div className={`mt-3 flex flex-wrap gap-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <span>{t('entryWordCount', { count: wordCount })}</span>
                <span aria-hidden="true">/</span>
                <span>{readingTimeLabel}</span>
            </div>
            <EntryBacklinksSection
                entry={entry}
                backlinks={backlinks}
                loading={loadingBacklinks}
                isDark={isDark}
                onNavigateToEntry={onNavigateToEntry}
                tagMetadata={tagMetadata}
                t={t}
            />
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

export function EntryBacklinksSection({
    entry,
    backlinks,
    loading,
    isDark,
    onNavigateToEntry,
    tagMetadata,
    t,
}: Readonly<{
    entry: Entry;
    backlinks: EntryBacklink[];
    loading: boolean;
    isDark: boolean;
    onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    tagMetadata: TagMetadataMap;
    t: TranslationFn;
}>) {
    const sourceEntry = {
        id: entry.id,
        date: extractDate(entry.date),
        index: entry.index || 1,
    };

    return (
        <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('backlinks')}
                </h4>
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {loading ? t('loadingBacklinks') : t('backlinksCount', { count: backlinks.length })}
                </span>
            </div>
            {loading && backlinks.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('loadingBacklinks')}</p>
            ) : backlinks.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('noBacklinks')}</p>
            ) : (
                <div className="space-y-2">
                    {backlinks.map((backlink) => {
                        const backlinkDate = extractDate(backlink.date);
                        const backlinkIndex = backlink.index || 1;
                        return (
                            <button
                                key={backlink.id}
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onNavigateToEntry(backlinkDate, backlinkIndex, sourceEntry);
                                }}
                                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${isDark ? 'border-gray-700 bg-gray-950/30 hover:border-blue-500/60 hover:bg-blue-500/10' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'}`}
                            >
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className={`text-xs font-mono font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                        {backlinkDate}{backlinkIndex > 1 ? ` #${backlinkIndex}` : ''}
                                    </span>
                                    {backlink.diary_name && (
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                            {backlink.diary_icon ? `${backlink.diary_icon} ` : ''}{backlink.diary_name}
                                        </span>
                                    )}
                                    {backlink.tags.slice(0, 3).map((tag) => (
                                        <TagBadge
                                            key={tag}
                                            tag={tag}
                                            metadata={tagMetadata}
                                            theme={isDark ? 'dark' : 'light'}
                                            size="xs"
                                        />
                                    ))}
                                </div>
                                <p className={`line-clamp-2 text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {backlink.content.length > 180 ? `${backlink.content.slice(0, 180)}...` : backlink.content}
                                </p>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
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
