import type { ReactNode } from 'react';

import type { PublicFeedAuthor } from '../../services/api';
import type { FollowStatus } from './useFollows';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface FeedAvatarProps {
  readonly author: Pick<PublicFeedAuthor, 'username' | 'avatarUrl'>;
}

export function FeedAvatar({ author }: FeedAvatarProps) {
  return (
    <div className={`feed-avatar ${author.avatarUrl ? 'has-image' : ''}`} aria-hidden="true">
      {author.avatarUrl
        ? <img src={author.avatarUrl} alt="" />
        : author.username.charAt(0).toUpperCase()}
    </div>
  );
}

interface FeedAuthorProps {
  readonly author: PublicFeedAuthor;
  readonly date: string;
  /** The time of day the author gave the entry (`HH:MM`), if any. */
  readonly time?: string | null;
  readonly t: Translate;
  /** Omitted for the user's own entries, which cannot be followed. */
  readonly follow?: FollowControl;
  /** After the follow button: what else the reader can do about this writer (mute, block). */
  readonly menu?: ReactNode;
}

export interface FollowControl {
  readonly status: FollowStatus;
  readonly pending: boolean;
  /** Follows, or stops following; asks to follow, or withdraws the request. */
  readonly onToggle: () => void;
}

const FOLLOW_LOOKS: Record<FollowStatus, { icon: string; label: string }> = {
  following: { icon: 'check', label: 'followingAuthor' },
  requested: { icon: 'watch', label: 'followRequestedAuthor' },
  none: { icon: 'add', label: 'followAuthor' },
};

/**
 * Follow, or Ask to follow a writer who approves their followers; then Following, or Requested (pressed, and
 * pressing it again withdraws the request).
 */
export function FollowButton({ author, follow, t }: { readonly author: PublicFeedAuthor; readonly follow: FollowControl; readonly t: Translate }) {
  const look = FOLLOW_LOOKS[follow.status];
  const label = follow.status === 'none' && author.approvalRequired ? 'askToFollowAuthor' : look.label;
  let className = 'feed-follow';
  if (follow.status !== 'none') className += follow.status === 'requested' ? ' followed requested' : ' followed';
  return (
    <button
      type="button"
      className={className}
      aria-pressed={follow.status !== 'none'}
      title={follow.status === 'requested' ? t('cancelFollowRequest', { username: author.username }) : undefined}
      disabled={follow.pending}
      onClick={follow.onToggle}
    >
      <span className={`codicon codicon-${look.icon}`} aria-hidden="true" />
      {t(label)}
      <span className="sr-only"> {author.username}</span>
    </button>
  );
}

function FeedAuthor({ author, date, time, t, follow, menu }: FeedAuthorProps) {
  return (
    <div className="feed-author">
      <FeedAvatar author={author} />
      <div className="feed-author-details">
        <strong>{author.username}</strong>
        <time dateTime={time ? `${date}T${time}` : date}>{time ? `${date} · ${time}` : date}</time>
      </div>
      {follow && <FollowButton author={author} follow={follow} t={t} />}
      {menu}
    </div>
  );
}

export default FeedAuthor;
