import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import type { CommentPolicy, EntryComment, EntryCommentsResponse, FeedService } from '../../services/api';

/** Who may comment on the open entry, and whether the reader wrote it (so controls its comments). */
export type CommentThreadPolicy = Pick<EntryCommentsResponse, 'commentPolicy' | 'canComment' | 'canModerate'>;

/** The pinned comment first, then the others in the order they were written. */
export function orderComments(comments: readonly EntryComment[]): EntryComment[] {
  return [...comments].sort((left, right) =>
    Number(right.pinned) - Number(left.pinned)
    || left.createdAt.localeCompare(right.createdAt)
    || left.id - right.id);
}

const NO_WRITERS: ReadonlySet<number> = new Set();

/**
 * Loads one entry's comments and keeps them in step with what the reader posts, deletes, hides and pins,
 * and drops those by writers the reader mutes or blocks meanwhile (`hiddenAuthorIds`).
 */
export function useCommentThread(
  entryId: number,
  feedService: FeedService,
  onTotalChange: Dispatch<SetStateAction<number>>,
  hiddenAuthorIds: ReadonlySet<number> = NO_WRITERS,
) {
  const [comments, setComments] = useState<EntryComment[]>([]);
  const [policy, setPolicy] = useState<CommentThreadPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void feedService.fetchComments(entryId).then((result) => {
      if (!active) return;
      if (result.data) {
        const { comments: loaded, total, commentPolicy, canComment, canModerate } = result.data;
        setComments(orderComments(loaded));
        setPolicy({ commentPolicy, canComment, canModerate });
        onTotalChange(total);
      }
      setLoadError(!result.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [entryId, feedService, onTotalChange]);

  useEffect(() => {
    const gone = comments.filter((comment) => hiddenAuthorIds.has(comment.author.id)).length;
    if (gone === 0) return;
    setComments((current) => current.filter((comment) => !hiddenAuthorIds.has(comment.author.id)));
    onTotalChange((total) => Math.max(0, total - gone));
  }, [comments, hiddenAuthorIds, onTotalChange]);

  /** Resolves whether the comment was posted; a refusal says why (comments closed, followers only). */
  const post = async (content: string): Promise<boolean> => {
    setActionError(null);
    const result = await feedService.addComment(entryId, content);
    if (!result.data) {
      setActionError(result.error || 'commentPostError');
      return false;
    }
    setComments((current) => orderComments([...current, result.data!]));
    onTotalChange((total) => total + 1);
    return true;
  };

  const remove = async (comment: EntryComment) => {
    setActionError(null);
    const result = await feedService.deleteComment(entryId, comment.id);
    if (!result.data) {
      setActionError('commentDeleteError');
      return;
    }
    setComments((current) => current.filter((candidate) => candidate.id !== comment.id));
    onTotalChange((total) => Math.max(0, total - 1));
  };

  const changePolicy = async (commentPolicy: CommentPolicy) => {
    setActionError(null);
    const result = await feedService.setCommentPolicy(entryId, commentPolicy);
    if (!result.data) {
      setActionError(result.error || 'commentPolicyUpdateError');
      return;
    }
    const changed = result.data;
    setPolicy((current) => current && { ...current, ...changed });
  };

  /** Hiding takes a comment off the top; pinning one takes any other off it. */
  const update = async (comment: EntryComment, change: 'hidden' | 'pinned', value: boolean) => {
    setActionError(null);
    const result = change === 'hidden'
      ? await feedService.setCommentHidden(entryId, comment.id, value)
      : await feedService.setCommentPinned(entryId, comment.id, value);
    if (!result.data) {
      setActionError(result.error || 'commentUpdateError');
      return;
    }
    const updated = result.data;
    setComments((current) => orderComments(current.map((candidate) => {
      if (candidate.id === updated.id) return updated;
      return updated.pinned && candidate.pinned ? { ...candidate, pinned: false } : candidate;
    })));
  };

  return { comments, policy, loading, loadError, actionError, post, remove, changePolicy, update };
}
