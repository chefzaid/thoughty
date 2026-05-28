import { useCallback, useState as useLocalState, type ReactNode } from 'react';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import ListenButton from '../ListenButton/ListenButton';
import AttachmentDisplay from '../AttachmentDisplay/AttachmentDisplay';
import TagBadge from '../TagBadge/TagBadge';
import type { SpeechEntry } from '../../hooks/useSpeech';
import type { Config, Entry, EntryRevision, SourceEntryInfo, TranslationFunction as TranslationFn } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import VisibilityIcon from '../VisibilityIcon/VisibilityIcon';
import {
    extractDate,
    getEntryDiaryBadgeStyle,
} from './EntriesList.utils';

interface IconActionButtonProps {
    title: string;
    className: string;
    onClick: () => void;
    children: ReactNode;
    ariaLabel?: string;
}

function IconActionButton({
    title,
    className,
    onClick,
    children,
    ariaLabel,
}: Readonly<IconActionButtonProps>) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`${className} rounded transition-colors`}
            title={title}
            aria-label={ariaLabel}
        >
            {children}
        </button>
    );
}

function EntryHistorySection({
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

function BackToSourceButton({
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


interface EntryViewModeProps {
    entry: Entry;
    config: Config;
    speaking: boolean;
    activeEntryId: number | null;
    activeTargetId: number | null;
    sourceEntry: SourceEntryInfo | null;
    flatEntries: SpeechEntry[];
    speakEntry: (e: SpeechEntry) => void;
    speakFromEntry: (entries: SpeechEntry[], id: number) => void;
    stop: () => void;
    onToggleVisibility: (entry: Entry) => void;
    onToggleFavorite: (entry: Entry) => void;
    onToggleArchived: (entry: Entry) => void;
    onEdit: (entry: Entry) => void;
    onDelete: (id: number) => void;
    onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    onShareEntry?: (entry: Entry) => Promise<boolean>;
    getEntryPermalink?: (entryId: number) => string;
    onBackToSource: () => void;
    onFetchHistory?: (entryId: number) => Promise<EntryRevision[]>;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onDiscuss?: (entry: Entry) => void;
    searchTerm?: string;
    showDiaryLabel: boolean;
    tagMetadata: TagMetadataMap;
    t: TranslationFn;
}

export default function EntryViewMode({
    entry,
    config,
    speaking,
    activeEntryId,
    activeTargetId,
    sourceEntry,
    flatEntries,
    speakEntry: speak,
    speakFromEntry: speakFrom,
    stop,
    onToggleVisibility,
    onToggleFavorite,
    onToggleArchived,
    onEdit,
    onDelete,
    onNavigateToEntry,
    onShareEntry,
    getEntryPermalink,
    onBackToSource,
    onFetchHistory,
    onDeleteRevision,
    onDiscuss,
    searchTerm,
    showDiaryLabel,
    tagMetadata,
    t,
}: Readonly<EntryViewModeProps>) {
    const isDark = config.theme !== 'light';
    const archiveActionLabel = entry.is_archived ? t('unarchive') : t('archive');
    const [showHistory, setShowHistory] = useLocalState(false);
    const [revisions, setRevisions] = useLocalState<EntryRevision[]>([]);
    const [loadingHistory, setLoadingHistory] = useLocalState(false);
    const [shareReady, setShareReady] = useLocalState(false);
    const entryPermalink = getEntryPermalink?.(entry.id);

    const handleToggleHistory = useCallback(async () => {
        if (showHistory) {
            setShowHistory(false);
            return;
        }
        if (!onFetchHistory) {
            return;
        }
        setLoadingHistory(true);
        try {
            const data = await onFetchHistory(entry.id);
            setRevisions(data);
        } finally {
            setLoadingHistory(false);
        }
        setShowHistory(true);
    }, [showHistory, onFetchHistory, entry.id, setLoadingHistory, setRevisions, setShowHistory]);

    const handleDeleteRevision = useCallback(async (revisionId: number) => {
        if (!onDeleteRevision) {
            return;
        }
        const success = await onDeleteRevision(entry.id, revisionId);
        if (success) {
            setRevisions((current) => current.filter((revision) => revision.id !== revisionId));
        }
    }, [onDeleteRevision, entry.id, setRevisions]);

    const handleShare = useCallback(async () => {
        if (!onShareEntry) {
            return;
        }

        const success = await onShareEntry(entry);
        setShareReady(success);

        if (success) {
            globalThis.setTimeout(() => setShareReady(false), 2000);
        }
    }, [entry, onShareEntry, setShareReady]);

    return (
        <>
            <div className="flex justify-between items-start mb-3">
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
                            theme={config.theme}
                            size="xs"
                        />
                    ))}
                    {entry.is_archived && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${isDark ? 'border-sky-400/35 bg-sky-500/10 text-sky-300' : 'border-sky-300 bg-sky-50 text-sky-700'}`}>
                            {t('archived')}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <BackToSourceButton
                        entryId={entry.id}
                        activeTargetId={activeTargetId}
                        sourceEntry={sourceEntry}
                        onBackToSource={onBackToSource}
                        t={t}
                    />
                    <span className="text-xs text-gray-500 font-mono">#{entry.index}</span>
                    {entryPermalink && (
                        <a
                            href={entryPermalink}
                            className="p-1 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title={t('entryPermalink')}
                            aria-label={t('entryPermalink')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14a3 3 0 004.243 0l3.536-3.536a3 3 0 00-4.243-4.243L11 8m3 8l-2.293 2.293a3 3 0 01-4.243-4.243L11 11" />
                            </svg>
                        </a>
                    )}
                    {onShareEntry && (
                        <IconActionButton
                            onClick={() => void handleShare()}
                            className={`p-1.5 ${shareReady ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:text-sky-400 hover:bg-sky-500/10'}`}
                            title={shareReady ? t('entryLinkCopied') : t('shareEntry')}
                            ariaLabel={shareReady ? t('entryLinkCopied') : t('shareEntry')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.882 13.119 9 12.825 9 12.5a2.5 2.5 0 10-2.5 2.5c.325 0 .619-.118.842-.316l8.632 4.316A2.49 2.49 0 0016 19.5a2.5 2.5 0 102.5-2.5c-.325 0-.619.118-.842.316l-8.632-4.316A2.49 2.49 0 009 12.5c0-.325-.118-.619-.316-.842l8.632-4.316A2.49 2.49 0 0018.5 7a2.5 2.5 0 10-2.5-2.5c0 .325.118.619.316.842l-8.632 4.316z" />
                            </svg>
                        </IconActionButton>
                    )}
                    <IconActionButton
                        onClick={() => onToggleVisibility(entry)}
                        className={`p-1 ${entry.visibility === 'public' ? 'text-green-500 hover:bg-green-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                        title={entry.visibility === 'public' ? t('publicTooltip') : t('privateTooltip')}
                    >
                        <VisibilityIcon visibility={entry.visibility} />
                    </IconActionButton>
                    <IconActionButton
                        onClick={() => onToggleFavorite(entry)}
                        className={`p-1 ${entry.is_favorite ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                        title={entry.is_favorite ? t('unfavorite') : t('favorite')}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill={entry.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                    </IconActionButton>
                    <IconActionButton
                        onClick={() => onToggleArchived(entry)}
                        className={`p-1 ${entry.is_archived ? 'text-sky-400 hover:bg-sky-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                        title={archiveActionLabel}
                        ariaLabel={archiveActionLabel}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M5 8h14" />
                            <path d="M5 8l1 11h12l1-11" />
                            <path d={entry.is_archived ? 'M9 12h6' : 'M9 12h6m-3-3v6'} />
                        </svg>
                    </IconActionButton>
                    <ListenButton
                        entryId={entry.id}
                        speaking={speaking}
                        activeEntryId={activeEntryId}
                        onListenOne={() => speak({
                            id: entry.id,
                            content: entry.content,
                            date: extractDate(entry.date),
                        })}
                        onListenFrom={() => speakFrom(flatEntries, entry.id)}
                        onStop={stop}
                        theme={config.theme}
                        t={t}
                    />
                    {onDiscuss && (
                        <IconActionButton
                            onClick={() => onDiscuss(entry)}
                            className="p-1.5 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                            title={t('discussEntry')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </IconActionButton>
                    )}
                    {onFetchHistory && (
                        <IconActionButton
                            onClick={() => void handleToggleHistory()}
                            className={`p-1.5 ${showHistory ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' : 'text-gray-500 hover:text-gray-400 hover:bg-gray-500/10'}`}
                            title={t('viewHistory')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </IconActionButton>
                    )}
                    <IconActionButton
                        onClick={() => onEdit(entry)}
                        className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        title={t('edit')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </IconActionButton>
                    <IconActionButton
                        onClick={() => onDelete(entry.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title={t('delete')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </IconActionButton>
                </div>
            </div>
            <div className={`leading-relaxed text-sm ${entry.format === 'markdown' ? '' : 'whitespace-pre-wrap'} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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
                    theme={config.theme}
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
                onHandleDeleteRevision={handleDeleteRevision}
                t={t}
            />
        </>
    );
}
