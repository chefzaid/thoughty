import { useId, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';

import type { EntryComment, FeedService } from '../../services/api';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import CommentItem from './CommentItem';
import CommentPolicySelect from './CommentPolicySelect';
import { useCommentThread, type CommentThreadPolicy } from './useCommentThread';
import { useQuietMode } from '../QuietMode/quietMode';
import './EntryComments.css';

export const COMMENT_MAX_LENGTH = 1000;

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface CommentThreadProps {
  readonly entryId: number;
  /** The entry's writer, named where only their followers may comment. */
  readonly authorName: string;
  readonly currentUserId: number | undefined;
  readonly feedService: FeedService;
  readonly theme: 'light' | 'dark';
  readonly onTotalChange: Dispatch<SetStateAction<number>>;
  readonly hiddenAuthorIds?: ReadonlySet<number>;
  readonly t: Translate;
}

/** Why the reader cannot comment, when they cannot. */
function closedNote(policy: CommentThreadPolicy, authorName: string, t: Translate): string | null {
  if (policy.canComment) return null;
  return policy.commentPolicy === 'closed'
    ? t('commentsClosedNote')
    : t('commentsFollowersOnlyNote', { username: authorName });
}

/** Loads, posts, deletes, hides and pins the comments of one entry; mounted only while the thread is open. */
function CommentThread({ entryId, authorName, currentUserId, feedService, theme, onTotalChange, hiddenAuthorIds, t }: CommentThreadProps) {
  const inputId = useId();
  const thread = useCommentThread(entryId, feedService, onTotalChange, hiddenAuthorIds);
  const { comments, policy, loading, loadError, actionError } = thread;
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EntryComment | null>(null);
  const note = policy && closedNote(policy, authorName, t);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || posting) return;

    setPosting(true);
    const posted = await thread.post(content);
    setPosting(false);
    if (posted) setDraft('');
  };

  const confirmDelete = () => {
    const comment = pendingDelete;
    setPendingDelete(null);
    if (comment) void thread.remove(comment);
  };

  return (
    <div className="feed-comments">
      {policy?.canModerate && (
        <CommentPolicySelect value={policy.commentPolicy} onChange={(next) => void thread.changePolicy(next)} t={t} />
      )}
      {loading && <p className="feed-comments-note">{t('loading')}</p>}
      {loadError && <p className="feed-comments-note error" role="alert">{t('commentsLoadError')}</p>}
      {!loading && !loadError && comments.length === 0 && (
        <p className="feed-comments-note">{t('commentsEmpty')}</p>
      )}
      {comments.length > 0 && (
        <ol className="feed-comment-list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              entryId={entryId}
              comment={comment}
              currentUserId={currentUserId}
              canModerate={policy?.canModerate === true}
              feedService={feedService}
              onDelete={setPendingDelete}
              onChange={(target, change, value) => void thread.update(target, change, value)}
              t={t}
            />
          ))}
        </ol>
      )}
      {actionError && <p className="feed-comments-note error" role="alert">{t(actionError)}</p>}
      {note && <p className="feed-comments-note">{note}</p>}
      {!loadError && !note && (
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
        onConfirm={confirmDelete}
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
  /** The entry's writer, named where only their followers may comment. */
  readonly authorName: string;
  readonly commentCount: number;
  readonly currentUserId: number | undefined;
  /** Rendered before the comments toggle in the entry's action row (the like and listen buttons). */
  readonly actions?: ReactNode;
  readonly feedService: FeedService;
  readonly theme: 'light' | 'dark';
  /** Writers the reader muted or blocked on this page, whose comments leave an open thread. */
  readonly hiddenAuthorIds?: ReadonlySet<number>;
  /** Whether the thread starts open, as on the one entry a notification leads to. */
  readonly initiallyOpen?: boolean;
  readonly t: Translate;
}

function EntryComments({ entryId, authorName, commentCount, currentUserId, actions, feedService, theme, hiddenAuthorIds, initiallyOpen = false, t }: EntryCommentsProps) {
  const threadId = useId();
  const quiet = useQuietMode();
  const [open, setOpen] = useState(initiallyOpen);
  const [total, setTotal] = useState(commentCount);

  return (
    <div className="feed-entry-comments">
      <div className="feed-entry-actions">
        {actions}
        <button
          type="button"
          className="feed-comments-toggle"
          aria-expanded={open}
          aria-controls={threadId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="codicon codicon-comment" aria-hidden="true" />
          {quiet ? t('quietModeComments') : t('commentsCount', { count: total })}
        </button>
      </div>
      <div id={threadId} hidden={!open}>
        {open && (
          <CommentThread
            entryId={entryId}
            authorName={authorName}
            currentUserId={currentUserId}
            feedService={feedService}
            theme={theme}
            onTotalChange={setTotal}
            hiddenAuthorIds={hiddenAuthorIds}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

export default EntryComments;
