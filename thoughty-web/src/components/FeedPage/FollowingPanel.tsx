import type { ReactNode } from 'react';

import type { FollowedTopic, FollowedUser } from '../../services/api';
import { FeedAvatar } from './FeedAuthor';
import { useQuietMode } from '../QuietMode/quietMode';
import './FollowingPanel.css';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface FollowingPanelProps {
  readonly following: readonly FollowedUser[];
  /** Writers the reader asked to follow, whose approval is still waited for; each can be withdrawn. */
  readonly requested: readonly FollowedUser[];
  readonly topics: readonly FollowedTopic[];
  /** Who follows the reader, listed to them alone, each to remove. */
  readonly followers: readonly FollowedUser[];
  readonly followerCount: number;
  /** Who asks to follow the reader (Followers by approval), each to approve or decline. */
  readonly requests: readonly FollowedUser[];
  readonly loaded: boolean;
  readonly loadError: boolean;
  readonly pendingIds: ReadonlySet<number>;
  /** Stops following a writer, or withdraws a request to. */
  readonly onUnfollow: (user: FollowedUser) => void;
  readonly isTopicPending: (tag: string) => boolean;
  readonly onUnfollowTopic: (tag: string) => void;
  readonly onRemoveFollower: (user: FollowedUser) => void;
  readonly onApproveRequest: (user: FollowedUser) => void;
  readonly onDeclineRequest: (user: FollowedUser) => void;
  readonly t: Translate;
}

/** One button beside a writer's name: a codicon whose label names the writer. */
function WriterAction({ icon, label, disabled, onClick }: {
  readonly icon: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <span className={`codicon codicon-${icon}`} aria-hidden="true" />
    </button>
  );
}

/** Writers by name, each with what can be done about them. */
function WriterList({ users, label, actions }: {
  readonly users: readonly FollowedUser[];
  readonly label?: string;
  readonly actions: (user: FollowedUser) => ReactNode;
}) {
  return (
    <ul className="feed-following-list" aria-label={label}>
      {users.map((user) => (
        <li key={user.id}>
          <FeedAvatar author={user} />
          <span className="feed-following-name">{user.username}</span>
          {actions(user)}
        </li>
      ))}
    </ul>
  );
}

/**
 * The writers and topics followed and the reader's followers, with the follow requests both ways, and how many
 * follow, are followed and ask to follow except in quiet mode.
 */
function FollowingPanel({
  following,
  requested,
  topics,
  followers,
  followerCount,
  requests,
  loaded,
  loadError,
  pendingIds,
  onUnfollow,
  isTopicPending,
  onUnfollowTopic,
  onRemoveFollower,
  onApproveRequest,
  onDeclineRequest,
  t,
}: FollowingPanelProps) {
  const quiet = useQuietMode();
  const ready = loaded && !loadError;
  return (
    <section className="feed-following" aria-labelledby="feed-following-heading">
      <div className="feed-following-header">
        <h2 id="feed-following-heading">{t('followingListTitle')}</h2>
        {!quiet && (
          <p>
            <span>{t('followingCount', { count: following.length })}</span>
            <span>{t('followersCount', { count: followerCount })}</span>
            {requests.length > 0 && <span>{t('followRequestsCount', { count: requests.length })}</span>}
          </p>
        )}
      </div>
      {loadError && <p className="feed-following-note" role="alert">{t('followsLoadError')}</p>}
      {ready && following.length === 0 && <p className="feed-following-note">{t('followingListEmpty')}</p>}
      {following.length > 0 && (
        <WriterList
          users={following}
          actions={(user) => (
            <WriterAction
              icon="close"
              label={t('unfollowAuthor', { username: user.username })}
              disabled={pendingIds.has(user.id)}
              onClick={() => onUnfollow(user)}
            />
          )}
        />
      )}
      {requested.length > 0 && (
        <>
          <h3 className="feed-following-subtitle">{t('followRequestsSentTitle')}</h3>
          <WriterList
            users={requested}
            label={t('followRequestsSentTitle')}
            actions={(user) => (
              <WriterAction
                icon="close"
                label={t('cancelFollowRequest', { username: user.username })}
                disabled={pendingIds.has(user.id)}
                onClick={() => onUnfollow(user)}
              />
            )}
          />
        </>
      )}
      {topics.length > 0 && (
        <>
          <h3 className="feed-following-subtitle">{t('followedTopicsTitle')}</h3>
          <ul className="feed-following-list" aria-label={t('followedTopicsTitle')}>
            {topics.map(({ tag }) => (
              <li key={tag} className="feed-following-topic">
                <span className="feed-following-name">#{tag}</span>
                <WriterAction
                  icon="close"
                  label={t('unfollowTopic', { tag })}
                  disabled={isTopicPending(tag)}
                  onClick={() => onUnfollowTopic(tag)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {requests.length > 0 && (
        <>
          <h3 className="feed-following-subtitle">{t('followRequestsTitle')}</h3>
          <WriterList
            users={requests}
            label={t('followRequestsTitle')}
            actions={(user) => (
              <>
                <WriterAction
                  icon="check"
                  label={t('approveFollowRequest', { username: user.username })}
                  disabled={pendingIds.has(user.id)}
                  onClick={() => onApproveRequest(user)}
                />
                <WriterAction
                  icon="close"
                  label={t('declineFollowRequest', { username: user.username })}
                  disabled={pendingIds.has(user.id)}
                  onClick={() => onDeclineRequest(user)}
                />
              </>
            )}
          />
        </>
      )}
      {ready && (
        <>
          <h3 className="feed-following-subtitle">{t('followersListTitle')}</h3>
          {followers.length === 0 ? (
            <p className="feed-following-note">{t('followersListEmpty')}</p>
          ) : (
            <WriterList
              users={followers}
              label={t('followersListTitle')}
              actions={(user) => (
                <WriterAction
                  icon="close"
                  label={t('removeFollower', { username: user.username })}
                  disabled={pendingIds.has(user.id)}
                  onClick={() => onRemoveFollower(user)}
                />
              )}
            />
          )}
        </>
      )}
    </section>
  );
}

export default FollowingPanel;
