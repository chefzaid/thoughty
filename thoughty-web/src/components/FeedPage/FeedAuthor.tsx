import type { PublicFeedAuthor } from '../../services/api';

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
  readonly t: Translate;
  /** Omitted for the user's own entries, which cannot be followed. */
  readonly follow?: {
    readonly followed: boolean;
    readonly pending: boolean;
    readonly onToggle: () => void;
  };
}

function FeedAuthor({ author, date, t, follow }: FeedAuthorProps) {
  return (
    <div className="feed-author">
      <FeedAvatar author={author} />
      <div className="feed-author-details">
        <strong>{author.username}</strong>
        <time dateTime={date}>{date}</time>
      </div>
      {follow && (
        <button
          type="button"
          className={`feed-follow ${follow.followed ? 'followed' : ''}`}
          aria-pressed={follow.followed}
          disabled={follow.pending}
          onClick={follow.onToggle}
        >
          <span className={`codicon ${follow.followed ? 'codicon-check' : 'codicon-add'}`} aria-hidden="true" />
          {follow.followed ? t('followingAuthor') : t('followAuthor')}
          <span className="sr-only"> {author.username}</span>
        </button>
      )}
    </div>
  );
}

export default FeedAuthor;
