import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useFeedService } from '../../hooks/useFeedService';
import type { PublicFeedEntry, PublicFeedScope } from '../../services/api';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import EntryComments from './EntryComments';
import LikeButton from './LikeButton';
import FeedAuthor from './FeedAuthor';
import FollowingPanel from './FollowingPanel';
import { useFollows } from './useFollows';
import './FeedPage.css';

const PAGE_SIZE = 10;

const SCOPES: ReadonlyArray<{ scope: PublicFeedScope; icon: string; label: string; empty: string }> = [
  { scope: 'community', icon: 'globe', label: 'feedCommunity', empty: 'feedEmptyCommunity' },
  { scope: 'following', icon: 'organization', label: 'feedFollowing', empty: 'feedEmptyFollowing' },
  { scope: 'mine', icon: 'eye', label: 'feedMine', empty: 'feedEmptyMine' },
];

interface FeedPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

function FeedPage({ theme = 'dark', t }: Readonly<FeedPageProps>) {
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  const pendingRequestsRef = useRef(new Set<string>());

  const fetchPage = useCallback(async (
    requestScope: PublicFeedScope,
    requestedPage: number,
    replace: boolean,
    generation: number,
  ) => {
    const requestKey = `${generation}:${requestScope}:${requestedPage}`;
    if (pendingRequestsRef.current.has(requestKey)) return;

    pendingRequestsRef.current.add(requestKey);
    setLoading(true);
    setError(null);
    const result = await feedService.fetchPublicFeed(requestScope, requestedPage, PAGE_SIZE);
    pendingRequestsRef.current.delete(requestKey);

    if (generation !== generationRef.current) return;

    if (!result.data) {
      setError(result.error || 'feedLoadError');
      setLoading(false);
      return;
    }

    setEntries((current) => replace ? result.data!.entries : [...current, ...result.data!.entries]);
    setPage(result.data.page);
    setTotal(result.data.total);
    setHasMore(result.data.hasMore);
    setLoading(false);
  }, [feedService]);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setEntries([]);
    setPage(1);
    setTotal(0);
    setHasMore(false);
    void fetchPage(scope, 1, true, generation);
  }, [fetchPage, scope]);

  const loadNextPage = useCallback(() => {
    if (!loading && hasMore) {
      void fetchPage(scope, page + 1, false, generationRef.current);
    }
  }, [fetchPage, hasMore, loading, page, scope]);

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

  const emptyMessage = t(SCOPES.find((option) => option.scope === scope)!.empty);

  return (
    <section className={`feed-page ${theme}`} aria-labelledby="feed-heading">
      <header className="feed-header">
        <h1 id="feed-heading">{t('feed')}</h1>
        <fieldset className="feed-scope" aria-label={t('feedScope')}>
          {SCOPES.map((option) => (
            <button
              key={option.scope}
              type="button"
              className={scope === option.scope ? 'active' : ''}
              aria-pressed={scope === option.scope}
              onClick={() => setScope(option.scope)}
            >
              <span className={`codicon codicon-${option.icon}`} aria-hidden="true" />
              {t(option.label)}
            </button>
          ))}
        </fieldset>
      </header>

      {scope === 'following' && (
        <FollowingPanel
          following={follows.following}
          followerCount={follows.followerCount}
          loaded={follows.loaded}
          loadError={follows.loadError}
          pendingIds={follows.pendingIds}
          onUnfollow={(user) => void follows.setFollow(user, false)}
          t={t}
        />
      )}
      {follows.updateError && <p className="feed-follow-error" role="alert">{t('followUpdateError')}</p>}

      <p className="feed-count" aria-live="polite">
        {entries.length > 0 ? t('feedCount', { count: entries.length, total }) : ''}
      </p>

      <div className="feed-list">
        {entries.map((entry) => (
          <article className="feed-entry" key={entry.id}>
            <FeedAuthor
              author={entry.author}
              date={entry.date}
              t={t}
              follow={scope === 'mine' ? undefined : {
                followed: follows.isFollowed(entry.author),
                pending: follows.pendingIds.has(entry.author.id),
                onToggle: () => void follows.setFollow(entry.author, !follows.isFollowed(entry.author)),
              }}
            />
            <div className="feed-content">
              <EntryContentRenderer content={entry.content} format={entry.format} />
            </div>
            {entry.tags.length > 0 && (
              <ul className="feed-tags" aria-label={t('tags')}>
                {entry.tags.map((tag) => <li key={tag}>#{tag}</li>)}
              </ul>
            )}
            <EntryComments
              entryId={entry.id}
              commentCount={entry.commentCount}
              currentUserId={currentUserId}
              feedService={feedService}
              theme={theme}
              t={t}
              likeButton={(
                <LikeButton
                  liked={entry.liked}
                  likeCount={entry.likeCount}
                  canLike={scope !== 'mine'}
                  label={t('likeEntryBy', { username: entry.author.username })}
                  onChange={(like) => feedService.setEntryLike(entry.id, like)}
                  t={t}
                />
              )}
            />
          </article>
        ))}
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
