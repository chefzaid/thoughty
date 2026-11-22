import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useFeedService } from '../../hooks/useFeedService';
import type { PublicFeedEntry, PublicFeedFilters, PublicFeedScope } from '../../services/api';
import { resolveLanguage } from '../../utils/language';
import { pluralPhrase } from '../../utils/pluralPhrase';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import PageHeader from '../PageHeader/PageHeader';
import ListenButton from '../ListenButton/ListenButton';
import ShareImageDialog from '../ShareImageCard/ShareImageDialog';
import { formatCardDate } from '../ShareImageCard/shareCardLayout';
import EntryComments from './EntryComments';
import LikeButton from './LikeButton';
import SaveButton from './SaveButton';
import FeedAuthor from './FeedAuthor';
import FollowingPanel from './FollowingPanel';
import FeedTopicBar from './FeedTopicBar';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import WriterMenu from './WriterMenu';
import { useFeedSpeech } from './useFeedSpeech';
import { useFollows } from './useFollows';
import { useWriterControls } from './useWriterControls';
import './FeedPage.css';

const PAGE_SIZE = 10;

const SCOPES: ReadonlyArray<{ scope: PublicFeedScope; icon: string; label: string; empty: string }> = [
  { scope: 'community', icon: 'globe', label: 'feedCommunity', empty: 'feedEmptyCommunity' },
  { scope: 'following', icon: 'organization', label: 'feedFollowing', empty: 'feedEmptyFollowing' },
  { scope: 'mine', icon: 'eye', label: 'feedMine', empty: 'feedEmptyMine' },
  { scope: 'saved', icon: 'bookmark', label: 'feedSaved', empty: 'feedEmptySaved' },
];

interface FeedPageProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  /** Whether reading aloud starts each entry with its date (the Journal's setting). */
  readonly readDates?: boolean;
  /** The voice chosen in the profile for reading aloud. */
  readonly ttsVoiceUri?: string;
  readonly onOpenLeaderboard?: () => void;
  /** **Write about this**: opens the journal's composer on a quote of another writer's entry. */
  readonly onWriteAbout?: (entry: PublicFeedEntry) => void;
  /** The topic (a tag) and the word search narrowing every tab, kept in the address by the route. */
  readonly filters?: PublicFeedFilters;
  /** Opens a topic, runs a search or clears them; without it the feed has no search and its tags are plain text. */
  readonly onFiltersChange?: (filters: PublicFeedFilters) => void;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

const NO_FILTERS: PublicFeedFilters = {};

function FeedPage({
  theme = 'dark',
  language,
  readDates = true,
  ttsVoiceUri,
  onOpenLeaderboard,
  onWriteAbout,
  filters = NO_FILTERS,
  onFiltersChange,
  t,
}: Readonly<FeedPageProps>) {
  const { tag, search, entry: entryId } = filters;
  const uiLanguage = resolveLanguage(language);
  const feedService = useFeedService();
  const currentUserId = useAuth().user?.id;
  const follows = useFollows(feedService);
  const [scope, setScope] = useState<PublicFeedScope>('community');
  const [entries, setEntries] = useState<PublicFeedEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageEntry, setImageEntry] = useState<PublicFeedEntry | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  /** In-flight page requests, so the infinite scroll and reading aloud share one request per page. */
  const pendingRequestsRef = useRef(new Map<string, Promise<PublicFeedEntry[]>>());

  /** Loads a page and resolves to its entries, or to none when it fails or a newer request replaced it. */
  const fetchPage = useCallback((
    requestScope: PublicFeedScope,
    requestedPage: number,
    replace: boolean,
    generation: number,
  ): Promise<PublicFeedEntry[]> => {
    const requestKey = `${generation}:${requestScope}:${requestedPage}`;
    const pending = pendingRequestsRef.current.get(requestKey);
    if (pending) return pending;

    setLoading(true);
    setError(null);
    const request = feedService.fetchPublicFeed(requestScope, requestedPage, PAGE_SIZE, { tag, search, entry: entryId }).then((result) => {
      pendingRequestsRef.current.delete(requestKey);
      if (generation !== generationRef.current) return [];

      if (!result.data) {
        setError(result.error || 'feedLoadError');
        setLoading(false);
        return [];
      }

      const loaded = result.data.entries;
      setEntries((current) => replace ? loaded : [...current, ...loaded]);
      setPage(result.data.page);
      setTotal(result.data.total);
      setHasMore(result.data.hasMore);
      setLoading(false);
      return loaded;
    });
    pendingRequestsRef.current.set(requestKey, request);
    return request;
  }, [feedService, tag, search, entryId]);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setEntries([]);
    setPage(1);
    setTotal(0);
    setHasMore(false);
    void fetchPage(scope, 1, true, generation);
  }, [fetchPage, scope]);

  /** A muted or blocked writer's entries leave the page at once; the next pages come without them. */
  const dropWriter = useCallback((writer: { id: number }, blocked: boolean) => {
    const gone = entries.filter((entry) => entry.author.id === writer.id).length;
    setEntries((current) => current.filter((entry) => entry.author.id !== writer.id));
    setTotal((current) => Math.max(0, current - gone));
    if (blocked) follows.forgetWriter(writer.id);
  }, [entries, follows]);
  const writers = useWriterControls(feedService, dropWriter);

  const loadNextPage = useCallback(() => {
    if (!loading && hasMore) {
      void fetchPage(scope, page + 1, false, generationRef.current);
    }
  }, [fetchPage, hasMore, loading, page, scope]);

  const speech = useFeedSpeech({
    entries,
    hasMore,
    fetchNextPage: () => fetchPage(scope, page + 1, false, generationRef.current),
    language: uiLanguage,
    readDates,
    voiceUri: ttsVoiceUri,
  });

  const changeScope = (nextScope: PublicFeedScope) => {
    speech.stop();
    setScope(nextScope);
  };

  const changeFilters = (next: PublicFeedFilters) => {
    speech.stop();
    onFiltersChange?.(next);
  };

  /** A tag under an entry opens its topic: everyone's public entries carrying it, from the top. */
  const openTopic = (topic: string) => {
    changeScope('community');
    changeFilters({ tag: topic });
    sectionRef.current?.scrollIntoView?.({ block: 'start' });
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) loadNextPage();
    }, { rootMargin: '240px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadNextPage, loading]);

  const retry = () => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    void fetchPage(scope, entries.length === 0 ? 1 : page + 1, entries.length === 0, generation);
  };

  let emptyMessage = t(SCOPES.find((option) => option.scope === scope)!.empty);
  if (entryId) emptyMessage = t('feedEntryGone');
  else if (tag || search) emptyMessage = t('feedEmptyFiltered');

  return (
    <section ref={sectionRef} className={`feed-page ${theme}`} aria-labelledby="feed-heading">
      <PageHeader
        title={t('feed')}
        titleId="feed-heading"
        theme={theme}
        actions={(
          <>
            {onOpenLeaderboard && (
              <button type="button" className="feed-leaderboard-link" onClick={onOpenLeaderboard}>
                <span className="codicon codicon-star-full" aria-hidden="true" />
                {t('leaderboard')}
              </button>
            )}
            {!entryId && <fieldset className="feed-scope" aria-label={t('feedScope')}>
              {SCOPES.map((option) => (
                <button
                  key={option.scope}
                  type="button"
                  className={scope === option.scope ? 'active' : ''}
                  aria-pressed={scope === option.scope}
                  onClick={() => changeScope(option.scope)}
                >
                  <span className={`codicon codicon-${option.icon}`} aria-hidden="true" />
                  {t(option.label)}
                </button>
              ))}
            </fieldset>}
          </>
        )}
      />

      {onFiltersChange && (
        <FeedTopicBar
          filters={filters}
          onChange={changeFilters}
          topicFollow={tag ? {
            followed: follows.isTopicFollowed(tag),
            pending: follows.isTopicPending(tag),
            onToggle: () => void follows.setTopicFollow(tag, !follows.isTopicFollowed(tag)),
          } : undefined}
          t={t}
        />
      )}

      {scope === 'following' && !entryId && (
        <FollowingPanel
          following={follows.following}
          topics={follows.topics}
          isTopicPending={follows.isTopicPending}
          onUnfollowTopic={(topic) => void follows.setTopicFollow(topic, false)}
          followers={follows.followers}
          onRemoveFollower={(user) => void follows.removeFollower(user)}
          followerCount={follows.followerCount}
          loaded={follows.loaded}
          loadError={follows.loadError}
          pendingIds={follows.pendingIds}
          onUnfollow={(user) => void follows.setFollow(user, false)}
          t={t}
        />
      )}
      {follows.updateError && <p className="feed-follow-error" role="alert">{t('followUpdateError')}</p>}
      {writers.error && <p className="feed-follow-error" role="alert">{t(writers.error)}</p>}
      <p className="feed-writer-notice" role="status">
        {writers.notice ? t(writers.notice.key, { username: writers.notice.username }) : ''}
      </p>

      <p className="feed-count" aria-live="polite">
        {entries.length > 0 ? pluralPhrase(t, 'feedCount', entries.length, uiLanguage, { total: total.toLocaleString(uiLanguage) }) : ''}
      </p>

      <div className="feed-list">
        {entries.map((entry) => {
          const isOwn = scope === 'mine' || entry.author.id === currentUserId;
          return (
            <article className={`feed-entry${speech.activeEntryId === entry.id ? ' reading' : ''}`} key={entry.id}>
              <FeedAuthor
                author={entry.author}
                date={entry.date}
                time={entry.timeOfDay}
                t={t}
                follow={isOwn ? undefined : {
                  followed: follows.isFollowed(entry.author),
                  pending: follows.pendingIds.has(entry.author.id),
                  onToggle: () => void follows.setFollow(entry.author, !follows.isFollowed(entry.author)),
                }}
                menu={isOwn ? undefined : (
                  <WriterMenu
                    username={entry.author.username}
                    disabled={writers.pendingIds.has(entry.author.id)}
                    onMute={() => writers.mute(entry.author)}
                    onBlock={() => writers.requestBlock(entry.author)}
                    t={t}
                  />
                )}
              />
              {entry.title && <h2 className="feed-entry-title">{entry.title}</h2>}
              <div className="feed-content privacy-text">
                <EntryContentRenderer content={entry.content} format={entry.format} />
              </div>
              {entry.tags.length > 0 && (
                <ul className="feed-tags" aria-label={t('tags')}>
                  {entry.tags.map((entryTag) => (
                    <li key={entryTag}>
                      {onFiltersChange ? (
                        <button
                          type="button"
                          className="feed-tag"
                          title={t('feedOpenTopic', { tag: entryTag })}
                          onClick={() => openTopic(entryTag)}
                        >
                          #{entryTag}
                        </button>
                      ) : `#${entryTag}`}
                    </li>
                  ))}
                </ul>
              )}
              <EntryComments
                entryId={entry.id}
                authorName={entry.author.username}
                commentCount={entry.commentCount}
                currentUserId={currentUserId}
                feedService={feedService}
                theme={theme}
                hiddenAuthorIds={writers.hiddenIds}
                initiallyOpen={entryId !== undefined}
                t={t}
                actions={(
                  <>
                    <LikeButton
                      liked={entry.liked}
                      likeCount={entry.likeCount}
                      canLike={!isOwn}
                      label={t('likeEntryBy', { username: entry.author.username })}
                      onChange={(like) => feedService.setEntryLike(entry.id, like)}
                      t={t}
                    />
                    {speech.supported && (
                      <ListenButton
                        entryId={entry.id}
                        speaking={speech.speaking}
                        activeEntryId={speech.activeEntryId}
                        onListenOne={() => speech.readEntry(entry)}
                        onListenFrom={() => speech.readFromEntry(entry)}
                        onStop={speech.stop}
                        theme={theme}
                        menuAlign="start"
                        label={t('listenEntryBy', { username: entry.author.username })}
                        t={t}
                      />
                    )}
                    {!isOwn && (
                      <>
                        <SaveButton
                          saved={entry.saved}
                          label={t('saveEntryBy', { username: entry.author.username })}
                          onChange={(save) => feedService.setEntrySaved(entry.id, save)}
                          t={t}
                        />
                        {onWriteAbout && (
                          <button
                            type="button"
                            className="feed-entry-action"
                            aria-label={t('writeAboutEntryBy', { username: entry.author.username })}
                            onClick={() => onWriteAbout(entry)}
                          >
                            <span className="codicon codicon-edit" aria-hidden="true" />
                            {t('writeAboutThis')}
                          </button>
                        )}
                      </>
                    )}
                    {isOwn && (
                      <button
                        type="button"
                        className="feed-share-image"
                        title={t('shareAsImage')}
                        aria-label={t('shareAsImageBy', { date: formatCardDate(entry.date, uiLanguage) })}
                        onClick={() => setImageEntry(entry)}
                      >
                        <span className="codicon codicon-file-media" aria-hidden="true" />
                        {t('shareAsImage')}
                      </button>
                    )}
                  </>
                )}
              />
            </article>
          );
        })}
      </div>

      {loading && <output className="feed-state"><span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" /> {t('loading')}</output>}
      {!loading && error && (
        <div className="feed-state error" role="alert">
          <p>{t('feedLoadError')}</p>
          <button type="button" onClick={retry}><span className="codicon codicon-refresh" aria-hidden="true" /> {t('tryAgain')}</button>
        </div>
      )}
      {!loading && !error && entries.length === 0 && <p className="feed-state">{emptyMessage}</p>}
      {!error && entries.length > 0 && !hasMore && <p className="feed-state end">{t('feedEnd')}</p>}
      <div ref={sentinelRef} className="feed-sentinel" aria-hidden="true" />
      {imageEntry && (
        <ShareImageDialog
          isOpen
          entry={{ ...imageEntry, visibility: 'public' }}
          isDark={theme !== 'light'}
          language={uiLanguage}
          onClose={() => setImageEntry(null)}
          t={t}
        />
      )}
      <ConfirmModal
        isOpen={writers.pendingBlock !== null}
        onClose={writers.cancelBlock}
        onConfirm={writers.confirmBlock}
        title={t('blockWriterTitle', { username: writers.pendingBlock?.username ?? '' })}
        message={t('blockWriterMessage', { username: writers.pendingBlock?.username ?? '' })}
        confirmLabel={t('blockWriterConfirm')}
        theme={theme}
        t={t}
      />
      {!error && hasMore && (
        <button type="button" className="feed-load-more" onClick={loadNextPage} disabled={loading}>
          <span className="codicon codicon-chevron-down" aria-hidden="true" />
          {t('loadMoreEntries')}
        </button>
      )}
    </section>
  );
}

export default FeedPage;
