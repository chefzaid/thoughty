import { memo, useState as useLocalState } from 'react';
import ListenButton from '../ListenButton/ListenButton';
import type { SpeechEntry } from '../../hooks/useSpeech';
import type { RephraseMode, SummaryGuidance } from '../../services/api/aiService';
import type { Config, Diary, Entry, EntryBacklink, EntryRevision, SourceEntryInfo, TranslationFunction as TranslationFn } from '../../types';
import { resolveLanguage } from '../../utils/language';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import { mutedTextClass } from '../../utils/tintedText';
import VisibilityIcon from '../VisibilityIcon/VisibilityIcon';
import { extractDate } from './EntriesList.utils';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import { IconActionButton } from './EntryActionPrimitives';
import { useFeatureFlag } from '../FeatureFlags/featureFlags';
import { diaryAiMode, diaryOffersAi } from '../../utils/diaryAi';
import DiscussEntryButton from './DiscussEntryButton';
import EntryRephraseButton from './EntryRephraseButton';
import EntrySecondaryActionsMenu from './EntrySecondaryActionsMenu';
import EntrySummaryDialog from './EntrySummaryDialog';
import ShareImageDialog from '../ShareImageCard/ShareImageDialog';
import { selectedExcerpt, toCardText } from '../ShareImageCard/shareCardLayout';
import {
    BackToSourceButton,
    EntryBodySection,
    EntryHeaderBadges,
} from './EntryViewModeSections';
import useEntryViewModeState from './useEntryViewModeState';
import SealedEntryCard from './SealedEntryCard';
import LockedEntryCard from '../ContentLock/LockedEntryCard';
import { useEntryLockAction } from '../ContentLock/useEntryLockAction';
import AuthenticatedShareLinkDialog from '../ShareLinks/AuthenticatedShareLinkDialog';
import PrintEntriesDialog from '../PrintSheet/PrintEntriesDialog';
import RereadReminderDialog from '../RereadReminder/RereadReminderDialog';
import RereadReminderBadge from '../RereadReminder/RereadReminderBadge';
import { canReplyToEntry, replyLabel } from './entryReply';
import MoveToDiaryDialog from './MoveToDiaryDialog';


interface EntryViewModeProps {
    entry: Entry;
    config: Config;
    speaking: boolean;
    activeEntryId: number | null;
    activeTargetId: number | null;
    sourceEntry: SourceEntryInfo | null;
    /** The entries shown, in reading order, read when listening from this one. */
    listEntries: () => SpeechEntry[];
    speakEntry: (e: SpeechEntry) => void;
    speakFromEntry: (entries: SpeechEntry[], id: number) => void;
    stop: () => void;
    onToggleVisibility: (entry: Entry) => void;
    onToggleFavorite: (entry: Entry) => void;
    onToggleArchived: (entry: Entry) => void;
    onTogglePinned: (entry: Entry) => void;
    /** Ticks a task list item of a Markdown entry, by its line in the text. */
    onToggleTask?: (entry: Entry, line: number, checked: boolean) => void;
    /** Opens a sealed time capsule early. */
    onUnseal?: (entry: Entry) => void;
    onEdit: (entry: Entry) => void;
    onDelete: (id: number) => void;
    onNavigateToEntry: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    onShareEntry?: (entry: Entry) => Promise<boolean>;
    getEntryPermalink?: (entryId: number) => string;
    onBackToSource: () => void;
    onFetchHistory?: (entryId: number) => Promise<EntryRevision[]>;
    onFetchBacklinks?: (entryId: number) => Promise<EntryBacklink[]>;
    /** Changes whenever an entry was written or removed, so the backlinks are read again. */
    backlinksVersion?: number;
    onDeleteRevision?: (entryId: number, revisionId: number) => Promise<boolean>;
    onDiscuss?: (entry: Entry) => void;
    onRephrase?: (entry: Entry, mode: RephraseMode) => Promise<void>;
    /** Resolves with the summary, null when it failed, or undefined when the writer did not send the request. */
    onSummarize?: (entry: Entry, guidance: SummaryGuidance) => Promise<string | null | undefined>;
    /** Copies an entry's text, tags and format into the new entry form. */
    onUseAsStartingPoint?: (entry: Entry) => void;
    /** Opens the new entry form on a reply: a short quote of the entry and a link to it. */
    onReply?: (entry: Entry) => void;
    /** Moves an entry to another diary, closing the dialog that asked once it moved; resolves `false` when it could not. */
    onMoveToDiary?: (entry: Entry, diaryId: number, closeAsker?: () => void) => Promise<boolean>;
    /** The writer's diaries; with two or more, the entry can move between them. */
    diaries?: readonly Diary[];
    searchTerm?: string;
    showDiaryLabel: boolean;
    tagMetadata: TagMetadataMap;
    t: TranslationFn;
}

/** The actions an entry list hands to each of its cards as they are. */
export type EntryCardActions = Pick<EntryViewModeProps,
    'onToggleTask' | 'onUnseal' | 'onShareEntry' | 'getEntryPermalink' | 'onFetchHistory' | 'onFetchBacklinks'
    | 'backlinksVersion' | 'onDeleteRevision' | 'onDiscuss' | 'onRephrase' | 'onSummarize' | 'onUseAsStartingPoint' | 'onReply'
    | 'onMoveToDiary'>;

/**
 * An entry card's content: a sealed time capsule or a locked entry the API withheld shows only its placeholder,
 * any other entry all of itself. A card draws again only when its own props change, so loading another batch of
 * the list leaves it alone.
 */
function EntryViewMode(props: Readonly<EntryViewModeProps>) {
    const { entry, config, showDiaryLabel, onUnseal, onDelete, t } = props;
    if (entry.withheld && !entry.sealed_until) {
        return <LockedEntryCard entry={entry} theme={config.theme} showDiaryLabel={showDiaryLabel} t={t} />;
    }
    return entry.sealed_until ? (
        <SealedEntryCard
            entry={{ ...entry, sealed_until: entry.sealed_until }}
            theme={config.theme}
            language={resolveLanguage(config.language)}
            showDiaryLabel={showDiaryLabel}
            onUnseal={onUnseal}
            onDelete={onDelete}
            t={t}
        />
    ) : <OpenEntryViewMode {...props} />;
}

/** What the visibility button says: the entry's visibility, or why a private entry cannot be made public now. */
/**
 * The favorite star's color. A favorite keeps its bright yellow fill (set on the icon); its outline
 * follows this text color, yellow-700 in the light theme (4.9:1 on the white card, where yellow-500
 * is 1.9:1, below the 3:1 icons need) and yellow-500 in the dark one.
 */
function favoriteStarClass(isFavorite: boolean | undefined, isDark: boolean): string {
    if (!isFavorite) return 'text-gray-500 hover:bg-gray-500/10';
    return `${isDark ? 'text-yellow-500' : 'text-yellow-700'} hover:bg-yellow-500/10`;
}

function entryVisibilityTitle(visibility: Entry['visibility'], publicSharing: boolean, t: TranslationFn): string {
    if (visibility === 'public') return t('publicTooltip');
    return publicSharing ? t('privateTooltip') : t('featureOffPublicVisibility');
}

function OpenEntryViewMode({
    entry,
    config,
    speaking,
    activeEntryId,
    activeTargetId,
    sourceEntry,
    listEntries,
    speakEntry: speak,
    speakFromEntry: speakFrom,
    stop,
    onToggleVisibility,
    onToggleFavorite,
    onToggleArchived,
    onTogglePinned,
    onToggleTask,
    onEdit,
    onDelete,
    onNavigateToEntry,
    onShareEntry,
    getEntryPermalink,
    onBackToSource,
    onFetchHistory,
    onFetchBacklinks,
    backlinksVersion,
    onDeleteRevision,
    onDiscuss: discuss,
    onRephrase: rephrase,
    onSummarize: summarize,
    onUseAsStartingPoint,
    onReply,
    onMoveToDiary,
    diaries = [],
    searchTerm,
    showDiaryLabel,
    tagMetadata,
    t,
}: Readonly<EntryViewModeProps>) {
    // The AI actions are left out while AI is switched off, and in a diary with AI off. In one that asks each
    // time, each of them (chat messages and transcriptions too) shows what it would send first; one on the writer's
    // own model offers only those that model takes
    const aiMode = diaryAiMode(diaries, entry.diary_id);
    const aiOn = useFeatureFlag('ai');
    const onDiscuss = aiOn && diaryOffersAi(aiMode, 'chat') ? discuss : undefined;
    const onRephrase = aiOn && diaryOffersAi(aiMode, 'writing') ? rephrase : undefined;
    const onSummarize = aiOn && diaryOffersAi(aiMode, 'summary') ? summarize : undefined;
    const publicSharing = useFeatureFlag('publicSharing');
    const [summaryOpen, setSummaryOpen] = useLocalState(false);
    const [shareImage, setShareImage] = useLocalState<{ excerpt?: string } | null>(null);
    const [sharePrivatelyOpen, setSharePrivatelyOpen] = useLocalState(false);
    const [printOpen, setPrintOpen] = useLocalState(false);
    const [rereadOpen, setRereadOpen] = useLocalState(false);
    const [moveOpen, setMoveOpen] = useLocalState(false);
    const isDark = config.theme !== 'light';
    const lockAction = useEntryLockAction(entry, config.theme, t);
    const archiveActionLabel = entry.is_archived ? t('unarchive') : t('archive');
    const entryPermalink = getEntryPermalink?.(entry.id);
    const {
        backlinks,
        handleDeleteRevision,
        handleRephrase,
        handleToggleHistory,
        loadingHistory,
        rephrasing,
        revisions,
        showHistory,
    } = useEntryViewModeState({
        entry,
        onFetchHistory,
        onFetchBacklinks,
        backlinksVersion,
        onDeleteRevision,
        onRephrase,
    });

    return (
        <>
            <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                <EntryHeaderBadges
                    entry={entry}
                    showDiaryLabel={showDiaryLabel}
                    isDark={isDark}
                    theme={config.theme}
                    language={config.language}
                    tagMetadata={tagMetadata}
                    t={t}
                />
                <div className="flex flex-wrap items-center gap-2">
                    <BackToSourceButton
                        entryId={entry.id}
                        activeTargetId={activeTargetId}
                        sourceEntry={sourceEntry}
                        onBackToSource={onBackToSource}
                        t={t}
                    />
                    <span
                        className={`text-xs font-mono ${mutedTextClass(isDark)}`}
                        title={t('entryLinkNumberHint', { reference: `[[${extractDate(entry.date)}#${entry.index ?? 1}]]` })}
                    >
                        #{entry.index}
                    </span>
                    <IconActionButton
                        onClick={() => onToggleVisibility(entry)}
                        className={`p-1 ${entry.visibility === 'public' ? `${isDark ? 'text-green-500' : 'text-green-600'} hover:bg-green-500/10` : 'text-gray-500 hover:bg-gray-500/10'}`}
                        // While public sharing is off a private entry cannot be made public; a public one can be made private
                        disabled={!publicSharing && entry.visibility !== 'public'}
                        title={entryVisibilityTitle(entry.visibility, publicSharing, t)}
                    >
                        <VisibilityIcon visibility={entry.visibility} />
                    </IconActionButton>
                    <IconActionButton
                        onClick={() => onToggleFavorite(entry)}
                        className={`p-1 ${favoriteStarClass(entry.is_favorite, isDark)}`}
                        title={entry.is_favorite ? t('unfavorite') : t('favorite')}
                    >
                        {/* The fill stays bright yellow; in the light theme the outline (currentColor) is yellow-700, so the shape reaches 3:1 on the card. */}
                        <svg className={`w-4 h-4 ${entry.is_favorite ? 'fill-yellow-500' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                        onListenFrom={() => speakFrom(listEntries(), entry.id)}
                        onStop={stop}
                        theme={config.theme}
                        t={t}
                    />
                    <DiscussEntryButton
                        entry={entry}
                        isDark={isDark}
                        language={resolveLanguage(config.language)}
                        onDiscussWithAi={onDiscuss ? () => onDiscuss(entry) : undefined}
                        withSomeone={publicSharing}
                        t={t}
                    />
                    <EntryRephraseButton
                        isDark={isDark}
                        disabled={rephrasing}
                        loading={rephrasing}
                        onRephrase={onRephrase ? handleRephrase : undefined}
                        t={t}
                    />
                    <IconActionButton
                        onClick={() => onEdit(entry)}
                        className={`p-1.5 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} hover:bg-blue-500/10`}
                        title={t('edit')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </IconActionButton>
                    {onReply && canReplyToEntry(entry) && (
                        <IconActionButton
                            onClick={() => onReply(entry)}
                            className={`p-1.5 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'} hover:bg-violet-500/10`}
                            title={t('writeReply')}
                            ariaLabel={replyLabel(entry, resolveLanguage(config.language), t)}
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />
                            </svg>
                        </IconActionButton>
                    )}
                    <EntrySecondaryActionsMenu
                        isDark={isDark}
                        entryPermalink={entryPermalink}
                        archiveActionLabel={archiveActionLabel}
                        isArchived={entry.is_archived ?? false}
                        showHistory={showHistory}
                        onShareEntry={onShareEntry ? async () => {
                            await onShareEntry(entry);
                        } : undefined}
                        onShareImage={() => setShareImage({ excerpt: selectedExcerpt(globalThis.getSelection?.()?.toString(), toCardText(entry.content, entry.format)) })}
                        onSharePrivately={() => setSharePrivatelyOpen(true)}
                        onPrint={() => setPrintOpen(true)}
                        onRemindToReread={() => setRereadOpen(true)}
                        onToggleHistory={onFetchHistory ? handleToggleHistory : undefined}
                        onSummarize={onSummarize ? () => setSummaryOpen(true) : undefined}
                        onUseAsStartingPoint={onUseAsStartingPoint ? () => onUseAsStartingPoint(entry) : undefined}
                        onMoveToDiary={onMoveToDiary && diaries.length > 1 ? () => setMoveOpen(true) : undefined}
                        onToggleArchived={() => onToggleArchived(entry)}
                        lockAction={lockAction.action}
                        onDelete={() => onDelete(entry.id)}
                        t={t}
                    />
                </div>
            </div>
            {lockAction.dialog}
            {entry.reread_on && (
                <RereadReminderBadge
                    entryId={entry.id}
                    rereadOn={entry.reread_on}
                    isDark={isDark}
                    language={resolveLanguage(config.language)}
                    t={t}
                />
            )}
            <EntryBodySection
                entry={entry}
                isDark={isDark}
                theme={config.theme}
                fontColor={config.fontColor}
                spacing={config}
                language={resolveLanguage(config.language)}
                onNavigateToEntry={onNavigateToEntry}
                onToggleTask={onToggleTask ? (line, checked) => onToggleTask(entry, line, checked) : undefined}
                searchTerm={searchTerm}
                showHistory={showHistory}
                backlinks={backlinks}
                loadingHistory={loadingHistory}
                revisions={revisions}
                tagMetadata={tagMetadata}
                onDeleteRevision={onDeleteRevision}
                onHandleDeleteRevision={handleDeleteRevision}
                aiMode={aiMode}
                t={t}
            />
            <ShareImageDialog
                isOpen={shareImage !== null}
                entry={entry}
                initialExcerpt={shareImage?.excerpt}
                checkPeople
                isDark={isDark}
                language={resolveLanguage(config.language)}
                onClose={() => setShareImage(null)}
                t={t}
            />
            {sharePrivatelyOpen && (
                <AuthenticatedShareLinkDialog
                    target={{ kind: 'entry', id: entry.id }}
                    entry={entry}
                    subject={entry.title?.trim() || formatEntryDay(entry.date, resolveLanguage(config.language))}
                    isDark={isDark}
                    language={resolveLanguage(config.language)}
                    onClose={() => setSharePrivatelyOpen(false)}
                    t={t}
                />
            )}
            {rereadOpen && (
                <RereadReminderDialog
                    entry={entry}
                    isDark={isDark}
                    language={resolveLanguage(config.language)}
                    onClose={() => setRereadOpen(false)}
                    t={t}
                />
            )}
            {moveOpen && onMoveToDiary && (
                <MoveToDiaryDialog
                    entry={entry}
                    diaries={diaries}
                    isDark={isDark}
                    language={resolveLanguage(config.language)}
                    onMove={(diaryId) => onMoveToDiary(entry, diaryId, () => setMoveOpen(false))}
                    onClose={() => setMoveOpen(false)}
                    t={t}
                />
            )}
            {printOpen && (
                <PrintEntriesDialog what="entry" entries={[entry]} config={config} onClose={() => setPrintOpen(false)} t={t} />
            )}
            {onSummarize && (
                <EntrySummaryDialog
                    entryId={entry.id}
                    isOpen={summaryOpen}
                    isDark={isDark}
                    onClose={() => setSummaryOpen(false)}
                    onSummarize={(_entryId, guidance) => onSummarize(entry, guidance)}
                    t={t}
                />
            )}
        </>
    );
}

export default memo(EntryViewMode);
