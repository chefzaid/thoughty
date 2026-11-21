import type { EntryComment, FeedService } from '../../services/api';
import { FeedAvatar } from './FeedAuthor';
import LikeButton from './LikeButton';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface CommentItemProps {
  readonly entryId: number;
  readonly comment: EntryComment;
  readonly currentUserId: number | undefined;
  /** The reader wrote the entry, so may hide and pin its comments. */
  readonly canModerate: boolean;
  readonly feedService: FeedService;
  readonly onDelete: (comment: EntryComment) => void;
  readonly onChange: (comment: EntryComment, change: 'hidden' | 'pinned', value: boolean) => void;
  readonly t: Translate;
}

/** Who sees a hidden comment, said to the one reading it. */
function hiddenNote(comment: EntryComment, ownComment: boolean, canModerate: boolean, t: Translate): string {
  if (!canModerate) return t('commentHiddenForWriter');
  return ownComment ? t('commentHiddenOwn') : t('commentHiddenForAuthor', { username: comment.author.username });
}

/** One comment, its likes, and what the reader may do with it: delete it, and on their own entry hide or pin it. */
function CommentItem({ entryId, comment, currentUserId, canModerate, feedService, onDelete, onChange, t }: CommentItemProps) {
  const { username } = comment.author;
  const ownComment = comment.author.id === currentUserId;
  const classes = ['feed-comment', comment.pinned ? 'pinned' : '', comment.hidden ? 'hidden-comment' : ''].filter(Boolean).join(' ');

  return (
    <li className={classes}>
      <FeedAvatar author={comment.author} />
      <div className="feed-comment-body">
        <p className="feed-comment-meta">
          <strong>{username}</strong>
          <time dateTime={comment.createdAt}>{comment.createdAt.slice(0, 10)}</time>
          {comment.pinned && (
            <span className="feed-comment-flag">
              <span className="codicon codicon-pinned" aria-hidden="true" />
              {t('commentPinned')}
            </span>
          )}
        </p>
        {comment.hidden && (
          <p className="feed-comment-flag hidden-note">
            <span className="codicon codicon-eye-closed" aria-hidden="true" />
            {hiddenNote(comment, ownComment, canModerate, t)}
          </p>
        )}
        <p className="feed-comment-text">{comment.content}</p>
        <div className="feed-comment-actions">
          <LikeButton
            liked={comment.liked}
            likeCount={comment.likeCount}
            canLike={!ownComment}
            label={t('likeCommentBy', { username })}
            onChange={(like) => feedService.setCommentLike(entryId, comment.id, like)}
            t={t}
          />
          {canModerate && !comment.hidden && (
            <button
              type="button"
              className="feed-comment-control"
              aria-pressed={comment.pinned}
              aria-label={t(comment.pinned ? 'unpinCommentBy' : 'pinCommentBy', { username })}
              onClick={() => onChange(comment, 'pinned', !comment.pinned)}
            >
              <span className={`codicon codicon-${comment.pinned ? 'pinned' : 'pin'}`} aria-hidden="true" />
              {t(comment.pinned ? 'unpinComment' : 'pinComment')}
            </button>
          )}
          {canModerate && (
            <button
              type="button"
              className="feed-comment-control"
              aria-label={t(comment.hidden ? 'showCommentBy' : 'hideCommentBy', { username })}
              onClick={() => onChange(comment, 'hidden', !comment.hidden)}
            >
              <span className={`codicon codicon-${comment.hidden ? 'eye' : 'eye-closed'}`} aria-hidden="true" />
              {t(comment.hidden ? 'showComment' : 'hideComment')}
            </button>
          )}
        </div>
      </div>
      {comment.canDelete && (
        <button
          type="button"
          className="feed-comment-delete"
          aria-label={t('deleteCommentBy', { username })}
          title={t('deleteComment')}
          onClick={() => onDelete(comment)}
        >
          <span className="codicon codicon-trash" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export default CommentItem;
