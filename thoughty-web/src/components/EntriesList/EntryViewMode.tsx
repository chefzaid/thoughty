import ListenButton from '../ListenButton/ListenButton';
import type { SpeechEntry } from '../../hooks/useSpeech';
import type { RephraseMode } from '../../services/api/aiService';
import type { Config, Entry, EntryBacklink, EntryRevision, SourceEntryInfo, TranslationFunction as TranslationFn } from '../../types';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import VisibilityIcon from '../VisibilityIcon/VisibilityIcon';
import { extractDate } from './EntriesList.utils';
import { IconActionButton } from './EntryActionPrimitives';
import EntryRephraseButton from './EntryRephraseButton';
import EntrySecondaryActionsMenu from './EntrySecondaryActionsMenu';
import {
    BackToSourceButton,
    EntryBodySection,
    EntryHeaderBadges,
} from './EntryViewModeSections';
import useEntryViewModeState from './useEntryViewModeState';


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
    onTogglePinned: (entry: Entry) => void;
    onEdit: (entry: Entry) => void;
    onDelete: (id: number) => void;
    onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    onShareEntry?: (entry: Entry) => Promise<boolean>;
    getEntryPermalink?: (entryId: number) => string;
    onBackToSource: () => void;
    onFetchHistory?: (entryId: number) => Promise<EntryRevision[]>;
    onFetchBacklinks?: (entryId: number) => Promise<EntryBacklink[]>;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onDiscuss?: (entry: Entry) => void;
    onRephrase?: (entry: Entry, mode: RephraseMode) => Promise<void>;
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
    onTogglePinned,
    onEdit,
    onDelete,
    onNavigateToEntry,
    onShareEntry,
    getEntryPermalink,
    onBackToSource,
    onFetchHistory,
    onFetchBacklinks,
    onDeleteRevision,
    onDiscuss,
    onRephrase,
    searchTerm,
    showDiaryLabel,
    tagMetadata,
    t,
}: Readonly<EntryViewModeProps>) {
    const isDark = config.theme !== 'light';
    const archiveActionLabel = entry.is_archived ? t('unarchive') : t('archive');
    const entryPermalink = getEntryPermalink?.(entry.id);
    const {
        backlinks,
        handleDeleteRevision,
        handleRephrase,
        handleToggleHistory,
        loadingBacklinks,
        loadingHistory,
        rephrasing,
        revisions,
        showHistory,
    } = useEntryViewModeState({
        entry,
        onFetchHistory,
        onFetchBacklinks,
        onDeleteRevision,
        onRephrase,
    });

    return (
        <>
            <div className="flex justify-between items-start mb-3">
                <EntryHeaderBadges
                    entry={entry}
                    showDiaryLabel={showDiaryLabel}
                    isDark={isDark}
                    theme={config.theme}
                    tagMetadata={tagMetadata}
                    t={t}
                />
                <div className="flex items-center gap-2">
                    <BackToSourceButton
                        entryId={entry.id}
                        activeTargetId={activeTargetId}
                        sourceEntry={sourceEntry}
                        onBackToSource={onBackToSource}
                        t={t}
                    />
                    <span className="text-xs text-gray-500 font-mono">#{entry.index}</span>
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
                        onClick={() => onTogglePinned(entry)}
                        className={`p-1 ${entry.is_pinned ? 'text-rose-500 hover:bg-rose-500/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                        title={entry.is_pinned ? t('unpinEntry') : t('pinEntry')}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill={entry.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 4.5l5 5-3.25 3.25.75 5.25-1 1-4.75-4.75L7 18.5 5.5 17l4.25-4.25L5 8l1-1 5.25.75L14.5 4.5z" />
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
                            className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                            title={t('discussEntry')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </IconActionButton>
                    )}
                    <EntryRephraseButton
                        isDark={isDark}
                        disabled={rephrasing}
                        loading={rephrasing}
                        onRephrase={onRephrase ? handleRephrase : undefined}
                        t={t}
                    />
                    <IconActionButton
                        onClick={() => onEdit(entry)}
                        className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        title={t('edit')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </IconActionButton>
                    <EntrySecondaryActionsMenu
                        isDark={isDark}
                        entryPermalink={entryPermalink}
                        archiveActionLabel={archiveActionLabel}
                        isArchived={entry.is_archived ?? false}
                        showHistory={showHistory}
                        onShareEntry={onShareEntry ? async () => {
                            await onShareEntry(entry);
                        } : undefined}
                        onToggleHistory={onFetchHistory ? handleToggleHistory : undefined}
                        onToggleArchived={() => onToggleArchived(entry)}
                        onDelete={() => onDelete(entry.id)}
                        t={t}
                    />
                </div>
            </div>
            <EntryBodySection
                entry={entry}
                isDark={isDark}
                theme={config.theme}
                fontColor={config.fontColor}
                onNavigateToEntry={onNavigateToEntry}
                searchTerm={searchTerm}
                showHistory={showHistory}
                loadingBacklinks={loadingBacklinks}
                backlinks={backlinks}
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
