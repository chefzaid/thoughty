import type { FollowedTopic, FollowedUser } from '../../services/api';
import { FeedAvatar } from './FeedAuthor';
import { useQuietMode } from '../QuietMode/quietMode';
import './FollowingPanel.css';

interface FollowingPanelProps {
  readonly following: readonly FollowedUser[];
  readonly topics: readonly FollowedTopic[];
  /** Who follows the reader, listed to them alone, each to remove. */
  readonly followers: readonly FollowedUser[];
  readonly followerCount: number;
  readonly loaded: boolean;
  readonly loadError: boolean;
  readonly pendingIds: ReadonlySet<number>;
  readonly onUnfollow: (user: FollowedUser) => void;
  readonly isTopicPending: (tag: string) => boolean;
  readonly onUnfollowTopic: (tag: string) => void;
  readonly onRemoveFollower: (user: FollowedUser) => void;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * The writers and topics followed and the reader's followers, with how many follow and are followed except
 * in quiet mode.
 */
function FollowingPanel({
  following,
  topics,
  followers,
  followerCount,
  loaded,
  loadError,
  pendingIds,
  onUnfollow,
  isTopicPending,
  onUnfollowTopic,
  onRemoveFollower,
  t,
}: FollowingPanelProps) {
  const quiet = useQuietMode();
  return (
    <section className="feed-following" aria-labelledby="feed-following-heading">
      <div className="feed-following-header">
        <h2 id="feed-following-heading">{t('followingListTitle')}</h2>
        {!quiet && (
          <p>
            <span>{t('followingCount', { count: following.length })}</span>
            <span>{t('followersCount', { count: followerCount })}</span>
          </p>
        )}
      </div>
      {loadError && <p className="feed-following-note" role="alert">{t('followsLoadError')}</p>}
      {loaded && !loadError && following.length === 0 && (
        <p className="feed-following-note">{t('followingListEmpty')}</p>
      )}
      {following.length > 0 && (
        <ul className="feed-following-list">
          {following.map((user) => (
            <li key={user.id}>
              <FeedAvatar author={user} />
              <span className="feed-following-name">{user.username}</span>
              <button
                type="button"
                aria-label={t('unfollowAuthor', { username: user.username })}
                title={t('unfollowAuthor', { username: user.username })}
                disabled={pendingIds.has(user.id)}
                onClick={() => onUnfollow(user)}
              >
                <span className="codicon codicon-close" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {topics.length > 0 && (
        <>
          <h3 className="feed-following-subtitle">{t('followedTopicsTitle')}</h3>
          <ul className="feed-following-list" aria-label={t('followedTopicsTitle')}>
            {topics.map(({ tag }) => (
              <li key={tag} className="feed-following-topic">
                <span className="feed-following-name">#{tag}</span>
                <button
                  type="button"
                  aria-label={t('unfollowTopic', { tag })}
                  title={t('unfollowTopic', { tag })}
                  disabled={isTopicPending(tag)}
                  onClick={() => onUnfollowTopic(tag)}
                >
                  <span className="codicon codicon-close" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {loaded && !loadError && (
        <>
          <h3 className="feed-following-subtitle">{t('followersListTitle')}</h3>
          {followers.length === 0 ? (
            <p className="feed-following-note">{t('followersListEmpty')}</p>
          ) : (
            <ul className="feed-following-list" aria-label={t('followersListTitle')}>
              {followers.map((user) => (
                <li key={user.id}>
                  <FeedAvatar author={user} />
                  <span className="feed-following-name">{user.username}</span>
                  <button
                    type="button"
                    aria-label={t('removeFollower', { username: user.username })}
                    title={t('removeFollower', { username: user.username })}
                    disabled={pendingIds.has(user.id)}
                    onClick={() => onRemoveFollower(user)}
                  >
                    <span className="codicon codicon-close" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default FollowingPanel;
