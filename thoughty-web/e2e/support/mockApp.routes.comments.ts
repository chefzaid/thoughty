import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState, MockComment, MockEntry } from './mockApp.shared';
import { authorId, feedEligibleEntries, likeState } from './mockApp.social-shared';

type CommentPolicy = NonNullable<MockEntry['commentPolicy']>;

/** The entry's own policy, else its writer's default; the mock's other writers keep the default `everyone`. */
function commentPolicy(entry: MockEntry, state: MockAppState): CommentPolicy {
  if (entry.commentPolicy) return entry.commentPolicy;
  return authorId(entry, state) === state.user.id ? state.config.defaultCommentPolicy ?? 'everyone' : 'everyone';
}

function mayComment(entry: MockEntry, state: MockAppState, policy: CommentPolicy): boolean {
  if (policy === 'closed') return false;
  const writer = authorId(entry, state);
  return policy === 'everyone' || writer === state.user.id || state.followedUserIds.includes(writer);
}

/** A hidden comment shows only to the entry's writer and its own writer; the pinned one comes first. */
export function visibleComments(state: MockAppState, entry: MockEntry): MockComment[] {
  const isEntryOwner = authorId(entry, state) === state.user.id;
  return state.comments
    .filter((comment) => comment.entryId === entry.id)
    .filter((comment) => !comment.hidden || isEntryOwner || comment.userId === state.user.id)
    .sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))
      || left.createdAt.localeCompare(right.createdAt) || left.id - right.id);
}

const notFound = (context: RouteContext, message: string) =>
  fulfillJson(context.route, { message, statusCode: 404 }, { status: 404 });

function commentResponse(state: MockAppState, entry: MockEntry, comment: MockComment) {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: { id: comment.userId, username: comment.username, avatarUrl: null },
    canDelete: authorId(entry, state) === state.user.id || comment.userId === state.user.id,
    ...likeState(comment.likeCount, state.likedCommentIds, comment.id),
    hidden: Boolean(comment.hidden),
    pinned: Boolean(comment.pinned),
  };
}

async function handleCommentList(context: RouteContext, entry: MockEntry): Promise<boolean> {
  const { route, request, state } = context;
  const policy = commentPolicy(entry, state);
  if (request.method() === 'GET') {
    const comments = visibleComments(state, entry);
    await fulfillJson(route, {
      comments: comments.map((comment) => commentResponse(state, entry, comment)),
      total: comments.length,
      commentPolicy: policy,
      canComment: mayComment(entry, state, policy),
      canModerate: authorId(entry, state) === state.user.id,
    });
    return true;
  }
  if (request.method() !== 'POST') return false;

  if (!mayComment(entry, state, policy)) {
    const code = policy === 'closed' ? 'COMMENTS_CLOSED' : 'COMMENTS_FOLLOWERS_ONLY';
    await fulfillJson(route, { message: 'Forbidden', statusCode: 403, code }, { status: 403 });
    return true;
  }
  const { content } = request.postDataJSON() as { content: string };
  const comment = {
    id: Math.max(0, ...state.comments.map((candidate) => candidate.id)) + 1,
    entryId: entry.id,
    userId: state.user.id,
    username: state.user.username,
    content: content.trim(),
    createdAt: '2026-07-25T12:00:00.000Z',
  };
  state.comments.push(comment);
  await fulfillJson(route, commentResponse(state, entry, comment), { status: 201 });
  return true;
}

/** Only the entry's writer chooses who comments, and hides or pins its comments. */
async function handleCommentControls(context: RouteContext, entry: MockEntry, match: RegExpExecArray): Promise<boolean> {
  const { route, request, state } = context;
  if (authorId(entry, state) !== state.user.id) {
    await notFound(context, 'Entry not found');
    return true;
  }
  if (match[2] === 'comment-policy') {
    const { policy } = request.postDataJSON() as { policy: CommentPolicy };
    // A spec's fixtures stay as written: the state gets changed copies
    state.entries = state.entries.map((candidate) => (candidate.id === entry.id ? { ...candidate, commentPolicy: policy } : candidate));
    await fulfillJson(route, { commentPolicy: policy, canComment: policy !== 'closed' });
    return true;
  }
  const comment = state.comments.find((candidate) => candidate.id === Number(match[3]) && candidate.entryId === entry.id);
  if (!comment) {
    await notFound(context, 'Comment not found');
    return true;
  }
  const on = request.method() === 'PUT';
  if (match[4] === 'pin' && on && comment.hidden) {
    await fulfillJson(route, { message: 'Bad request', statusCode: 400, code: 'COMMENT_PIN_HIDDEN' }, { status: 400 });
    return true;
  }
  const changed = match[4] === 'hidden'
    ? { ...comment, hidden: on, pinned: on ? false : comment.pinned }
    : { ...comment, pinned: on };
  state.comments = state.comments.map((candidate) => {
    if (candidate.id === changed.id) return changed;
    return changed.pinned && candidate.entryId === entry.id ? { ...candidate, pinned: false } : candidate;
  });
  await fulfillJson(route, commentResponse(state, entry, changed));
  return true;
}

async function handleCommentDelete(context: RouteContext, entry: MockEntry, commentId: number): Promise<boolean> {
  const { route, state } = context;
  const comment = state.comments.find((candidate) => candidate.id === commentId && candidate.entryId === entry.id);
  if (!comment || !commentResponse(state, entry, comment).canDelete) {
    await notFound(context, 'Comment not found');
    return true;
  }
  state.comments = state.comments.filter((candidate) => candidate.id !== commentId);
  await fulfillJson(route, { id: commentId, deleted: true });
  return true;
}

const COMMENT_ROUTE = /^\/api\/entries\/(\d+)\/(?:(comment-policy)|comments(?:\/(\d+)(?:\/(hidden|pin))?)?)$/;

/** Comments on public entries, and the controls their writer has over them. */
export async function handleCommentRoutes(context: RouteContext): Promise<boolean> {
  const { pathname, request, state } = context;
  const match = COMMENT_ROUTE.exec(pathname);
  if (!match) return false;

  const entry = feedEligibleEntries(state).find((candidate) => candidate.id === Number(match[1]));
  if (!entry) {
    await notFound(context, 'Entry not found');
    return true;
  }
  if (match[2] || match[4]) {
    if (match[2] ? request.method() !== 'PUT' : !['PUT', 'DELETE'].includes(request.method())) return false;
    return handleCommentControls(context, entry, match);
  }
  if (match[3]) {
    return request.method() === 'DELETE' ? handleCommentDelete(context, entry, Number(match[3])) : false;
  }
  return handleCommentList(context, entry);
}
