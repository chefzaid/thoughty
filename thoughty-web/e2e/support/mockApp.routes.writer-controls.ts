import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState } from './mockApp.shared';
import { authorId, feedEligibleEntries } from './mockApp.social-shared';

/**
 * Muting and blocking writers, and removing a follower. `state.writers` holds who the reader muted and
 * blocked and who follows them; a blocked writer is out of every social route (`feedEligibleEntries`).
 */

/** A writer's name as the mock knows it: from their entries, their comments or their follow. */
function writerName(state: MockAppState, userId: number): string {
  const entry = state.entries.find((candidate) => authorId(candidate, state) === userId);
  return entry?.authorUsername
    || state.comments.find((comment) => comment.userId === userId)?.username
    || state.writers.followers.find((follower) => follower.id === userId)?.username
    || `user${userId}`;
}

/** The API lets the reader mute or block only a writer they can come across. */
function isReachable(state: MockAppState, userId: number): boolean {
  const eligible = feedEligibleEntries(state);
  return eligible.some((entry) => authorId(entry, state) === userId)
    || state.comments.some((comment) => comment.userId === userId && eligible.some((entry) => entry.id === comment.entryId))
    || state.writers.followers.some((follower) => follower.id === userId)
    || state.writers.blocked.includes(userId);
}

function hiddenWriter(state: MockAppState, id: number) {
  return { id, username: writerName(state, id), avatarUrl: null, since: '2026-09-01T08:00:00.000Z' };
}

function block(state: MockAppState, userId: number) {
  if (!state.writers.blocked.includes(userId)) state.writers.blocked.push(userId);
  state.followedUserIds = state.followedUserIds.filter((id) => id !== userId);
  if (state.writers.followers.some((follower) => follower.id === userId)) {
    state.writers.followers = state.writers.followers.filter((follower) => follower.id !== userId);
    state.followerCount = Math.max(0, state.followerCount - 1);
  }
  const theirs = new Set(state.entries.filter((entry) => authorId(entry, state) === userId).map((entry) => entry.id));
  state.savedEntryIds = state.savedEntryIds.filter((id) => !theirs.has(id));
}

export async function handleWriterControlRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/writers/hidden' && request.method() === 'GET') {
    await fulfillJson(route, {
      muted: state.writers.muted.map((id) => hiddenWriter(state, id)),
      blocked: state.writers.blocked.map((id) => hiddenWriter(state, id)),
    });
    return true;
  }

  const follower = /^\/api\/follows\/followers\/(\d+)$/.exec(pathname);
  if (follower && request.method() === 'DELETE') {
    const userId = Number(follower[1]);
    if (state.writers.followers.some((candidate) => candidate.id === userId)) {
      state.writers.followers = state.writers.followers.filter((candidate) => candidate.id !== userId);
      state.followerCount = Math.max(0, state.followerCount - 1);
    }
    await fulfillJson(route, { userId, following: false });
    return true;
  }

  const match = /^\/api\/writers\/(\d+)\/(mute|block)$/.exec(pathname);
  if (!match || !['PUT', 'DELETE'].includes(request.method())) {
    return false;
  }
  const userId = Number(match[1]);
  const kind = match[2] === 'mute' ? 'muted' : 'blocked';
  const on = request.method() === 'PUT';
  if (on && userId === state.user.id) {
    const code = kind === 'muted' ? 'SOCIAL_CANNOT_MUTE_SELF' : 'SOCIAL_CANNOT_BLOCK_SELF';
    await fulfillJson(route, { message: 'You cannot do this to yourself', statusCode: 400, code }, { status: 400 });
    return true;
  }
  if (on && !isReachable(state, userId)) {
    await fulfillJson(route, { message: 'User not found', statusCode: 404, code: 'USER_NOT_FOUND' }, { status: 404 });
    return true;
  }
  if (on && kind === 'blocked') {
    block(state, userId);
  } else if (on) {
    if (!state.writers.muted.includes(userId)) state.writers.muted.push(userId);
  } else {
    state.writers[kind] = state.writers[kind].filter((id) => id !== userId);
  }
  await fulfillJson(route, kind === 'muted' ? { userId, muted: on } : { userId, blocked: on });
  return true;
}
