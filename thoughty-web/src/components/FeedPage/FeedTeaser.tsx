import type { ReactNode } from 'react';

import type { PublicFeedEntry } from '../../services/api';
import FeedAuthor, { FollowButton, type FollowControl } from './FeedAuthor';

interface FeedTeaserProps {
  readonly entry: PublicFeedEntry;
  readonly follow: FollowControl;
  /** What else the reader can do about this writer (mute, block). */
  readonly menu?: ReactNode;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * An entry by a writer who approves their followers, for a reader they have not approved: only who wrote it, its day
 * and its title (all the API gives), with **Ask to follow** where its text, tags, likes and comments would be.
 */
function FeedTeaser({ entry, follow, menu, t }: FeedTeaserProps) {
  const { username } = entry.author;
  return (
    <article className="feed-entry feed-teaser">
      <FeedAuthor author={entry.author} date={entry.date} t={t} menu={menu} />
      {entry.title && <h2 className="feed-entry-title">{entry.title}</h2>}
      <div className="feed-teaser-body">
        <span className="codicon codicon-lock" aria-hidden="true" />
        <p>{t(follow.status === 'requested' ? 'feedTeaserRequested' : 'feedTeaserNote', { username })}</p>
        <FollowButton author={entry.author} follow={follow} t={t} />
      </div>
    </article>
  );
}

export default FeedTeaser;
