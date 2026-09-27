import { useEffect, useId, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';

import type { EntryComment, FeedService } from '../../services/api';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { FeedAvatar } from './FeedAuthor';
import './EntryComments.css';

export const COMMENT_MAX_LENGTH = 1000;

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface CommentThreadProps {
  readonly entryId: number;
  readonly feedService: FeedService;
  readonly theme: 'light' | 'dark';
  readonly onTotalChange: Dispatch<SetStateAction<number>>;
  readonly t: Translate;
}

/** Loads, posts, and deletes the comments of one entry; mounted only while the thread is open. */
function CommentThread({ entryId, feedService, theme, onTotalChange, t }: CommentThreadProps) {
  const inputId = useId();
  const [comments, setComments] = useState<EntryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EntryComment | null>(null);

  useEffect(() => {
    let active = true;
    void feedService.fetchComments(entryId).then((result) => {
      if (!active) return;
      if (result.data) {
        setComments(result.data.comments);
        onTotalChange(result.data.total);
      }
      setLoadError(!result.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [entryId, feedService, onTotalChange]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || posting) return;

    setPosting(true);
    setActionError(null);
    const result = await feedService.addComment(entryId, content);
    setPosting(false);
    if (!result.data) {
      setActionError('commentPostError');
      return;
    }
    setComments((current) => [...current, result.data!]);
    onTotalChange((total) => total + 1);
    setDraft('');
  };

  const confirmDelete = async () => {
    const comment = pendingDelete;
    setPendingDelete(null);
    if (!comment) return;

    setActionError(null);
    const result = await feedService.deleteComment(entryId, comment.id);
    if (!result.data) {
      setActionError('commentDeleteError');
      return;
    }
    setComments((current) => current.filter((candidate) => candidate.id !== comment.id));
    onTotalChange((total) => Math.max(0, total - 1));
  };

  return (
    <div className="feed-comments">
      {loading && <p className="feed-comments-note">{t('loading')}</p>}
      {loadError && <p className="feed-comments-note error" role="alert">{t('commentsLoadError')}</p>}
      {!loading && !loadError && comments.length === 0 && (
        <p className="feed-comments-note">{t('commentsEmpty')}</p>
      )}
      {comments.length > 0 && (
        <ol className="feed-comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className="feed-comment">
              <FeedAvatar author={comment.author} />
              <div className="feed-comment-body">
                <p className="feed-comment-meta">
                  <strong>{comment.author.username}</strong>
                  <time dateTime={comment.createdAt}>{comment.createdAt.slice(0, 10)}</time>
                </p>
                <p className="feed-comment-text">{comment.content}</p>
              </div>
              {comment.canDelete && (
                <button
                  type="button"
                  className="feed-comment-delete"
                  aria-label={t('deleteCommentBy', { username: comment.author.username })}
                  title={t('deleteComment')}
                  onClick={() => setPendingDelete(comment)}
                >
                  <span className="codicon codicon-trash" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {actionError && <p className="feed-comments-note error" role="alert">{t(actionError)}</p>}
      {!loadError && (
        <form className="feed-comment-form" onSubmit={submit}>
          <label htmlFor={inputId} className="sr-only">{t('writeComment')}</label>
          <textarea
            id={inputId}
            value={draft}
            maxLength={COMMENT_MAX_LENGTH}
            rows={2}
            placeholder={t('writeComment')}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" disabled={posting || draft.trim().length === 0}>
            <span className="codicon codicon-send" aria-hidden="true" />
            {t('postComment')}
          </button>
        </form>
      )}
      <ConfirmModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={t('deleteComment')}
        message={t('deleteCommentConfirm')}
        theme={theme}
        t={t}
      />
    </div>
  );
}

interface EntryCommentsProps {
  readonly entryId: number;
  readonly commentCount: number;
  readonly feedService: FeedService;
  readonly theme: 'light' | 'dark';
  readonly t: Translate;
}

function EntryComments({ entryId, commentCount, feedService, theme, t }: EntryCommentsProps) {
  const threadId = useId();
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(commentCount);


  return (
    <div className="feed-entry-comments">
      <button
        type="button"
        className="feed-comments-toggle"
        aria-expanded={open}
        aria-controls={threadId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="codicon codicon-comment" aria-hidden="true" />
        {t('commentsCount', { count: total })}
      </button>
      <div id={threadId} hidden={!open}>
        {open && (
          <CommentThread entryId={entryId} feedService={feedService} theme={theme} onTotalChange={setTotal} t={t} />
        )}
      </div>
    </div>
  );
}

export default EntryComments;
