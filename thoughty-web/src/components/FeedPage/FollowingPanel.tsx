import type { FollowedUser } from '../../services/api';
import { FeedAvatar } from './FeedAuthor';
import './FollowingPanel.css';

interface FollowingPanelProps {
  readonly following: readonly FollowedUser[];
  readonly followerCount: number;
  readonly loaded: boolean;
  readonly loadError: boolean;
  readonly pendingIds: ReadonlySet<number>;
  readonly onUnfollow: (user: FollowedUser) => void;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

function FollowingPanel({ following, followerCount, loaded, loadError, pendingIds, onUnfollow, t }: FollowingPanelProps) {
  return (
    <section className="feed-following" aria-labelledby="feed-following-heading">
      <div className="feed-following-header">
        <h2 id="feed-following-heading">{t('followingListTitle')}</h2>
        <p>
          <span>{t('followingCount', { count: following.length })}</span>
          <span>{t('followersCount', { count: followerCount })}</span>
        </p>
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
    </section>
  );
}

export default FollowingPanel;
