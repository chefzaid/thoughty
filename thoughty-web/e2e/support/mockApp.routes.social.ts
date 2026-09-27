import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState, MockEntry } from './mockApp.shared';

const authorId = (entry: MockEntry, state: MockAppState) => entry.userId ?? state.user.id;

function likeState(baseCount: number | undefined, likedIds: number[], id: number) {
  const liked = likedIds.includes(id);
  return { liked, likeCount: (baseCount ?? 0) + (liked ? 1 : 0) };
}

function setLiked(likedIds: number[], id: number, like: boolean) {
  return like ? [...new Set([...likedIds, id])] : likedIds.filter((candidate) => candidate !== id);
}

function feedEligibleEntries(state: MockAppState) {
  return state.entries
    .filter((entry) => entry.visibility === 'public')
    .filter((entry) => !entry.is_archived)
    .filter((entry) => (entry.moderationStatus || 'visible') === 'visible');
}

async function handlePublicFeedRoute({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/entries/feed' || request.method() !== 'GET') {
    return false;
  }

  const scope = searchParams.get('scope') || 'community';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') || '10')));
  const inScope = (entry: MockEntry) => {
    const id = authorId(entry, state);
    if (scope === 'mine') return id === state.user.id;
    if (scope === 'following') return state.followedUserIds.includes(id);
    return id !== state.user.id;
  };
  const eligibleEntries = feedEligibleEntries(state)
    .filter(inScope)
    .sort((left, right) => {
      const dateComparison = (right.createdAt || right.date).localeCompare(left.createdAt || left.date);
      return dateComparison || right.id - left.id;
    });
  const startIndex = (page - 1) * limit;
  const entries = eligibleEntries.slice(startIndex, startIndex + limit);
  const totalPages = Math.ceil(eligibleEntries.length / limit);

  await fulfillJson(route, {
    entries: entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      index: entry.index,
      tags: entry.tags,
      content: entry.content,
      format: entry.format || 'plain',
      createdAt: entry.createdAt || `${entry.date}T12:00:00.000Z`,
      commentCount: state.comments.filter((comment) => comment.entryId === entry.id).length,
      ...likeState(entry.likeCount, state.likedEntryIds, entry.id),
      author: {
        id: authorId(entry, state),
        username: entry.authorUsername || state.user.username,
        avatarUrl: entry.authorAvatarUrl ?? null,
        isFollowed: state.followedUserIds.includes(authorId(entry, state)),
      },
    })),
    total: eligibleEntries.length,
    page,
    totalPages,
    hasMore: page < totalPages,
  });
  return true;
}

async function handleFollowRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/follows' && request.method() === 'GET') {
    const authors = new Map(state.entries.map((entry) => [authorId(entry, state), entry]));
    await fulfillJson(route, {
      following: state.followedUserIds
        .map((id) => ({
          id,
          username: authors.get(id)?.authorUsername || `user${id}`,
          avatarUrl: authors.get(id)?.authorAvatarUrl ?? null,
          followedAt: '2026-07-01T12:00:00.000Z',
        }))
        .sort((left, right) => left.username.localeCompare(right.username)),
      followerCount: state.followerCount,
    });
    return true;
  }

  const followMatch = /^\/api\/follows\/(\d+)$/.exec(pathname);
  if (!followMatch) {
    return false;
  }

  const userId = Number(followMatch[1]);
  if (request.method() === 'PUT') {
    const isPublicAuthor = feedEligibleEntries(state).some((entry) => authorId(entry, state) === userId);
    if (userId === state.user.id || !isPublicAuthor) {
      await fulfillJson(route, { message: 'User not found', statusCode: 404 }, { status: 404 });
      return true;
    }
    if (!state.followedUserIds.includes(userId)) state.followedUserIds.push(userId);
    await fulfillJson(route, { userId, following: true });
    return true;
  }
  if (request.method() === 'DELETE') {
    state.followedUserIds = state.followedUserIds.filter((id) => id !== userId);
    await fulfillJson(route, { userId, following: false });
    return true;
  }
  return false;
}

async function handleCommentRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const match = /^\/api\/entries\/(\d+)\/comments(?:\/(\d+))?$/.exec(pathname);
  if (!match) {
    return false;
  }

  const entryId = Number(match[1]);
  const entry = feedEligibleEntries(state).find((candidate) => candidate.id === entryId);
  if (!entry) {
    await fulfillJson(route, { message: 'Entry not found', statusCode: 404 }, { status: 404 });
    return true;
  }
  const isEntryOwner = authorId(entry, state) === state.user.id;
  const toResponse = (comment: MockAppState['comments'][number]) => ({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: { id: comment.userId, username: comment.username, avatarUrl: null },
    canDelete: isEntryOwner || comment.userId === state.user.id,
    ...likeState(comment.likeCount, state.likedCommentIds, comment.id),
  });

  if (!match[2] && request.method() === 'GET') {
    const comments = state.comments.filter((comment) => comment.entryId === entryId);
    await fulfillJson(route, { comments: comments.map(toResponse), total: comments.length });
    return true;
  }
  if (!match[2] && request.method() === 'POST') {
    const { content } = request.postDataJSON() as { content: string };
    const comment = {
      id: Math.max(0, ...state.comments.map((candidate) => candidate.id)) + 1,
      entryId,
      userId: state.user.id,
      username: state.user.username,
      content: content.trim(),
      createdAt: '2026-07-25T12:00:00.000Z',
    };
    state.comments.push(comment);
    await fulfillJson(route, toResponse(comment), { status: 201 });
    return true;
  }
  if (match[2] && request.method() === 'DELETE') {
    const commentId = Number(match[2]);
    const comment = state.comments.find((candidate) => candidate.id === commentId && candidate.entryId === entryId);
    if (!comment || !toResponse(comment).canDelete) {
      await fulfillJson(route, { message: 'Comment not found', statusCode: 404 }, { status: 404 });
      return true;
    }
    state.comments = state.comments.filter((candidate) => candidate.id !== commentId);
    await fulfillJson(route, { id: commentId, deleted: true });
    return true;
  }
  return false;
}

async function handleLikeRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const match = /^\/api\/entries\/(\d+)(?:\/comments\/(\d+))?\/like$/.exec(pathname);
  if (!match || !['PUT', 'DELETE'].includes(request.method())) {
    return false;
  }

  const like = request.method() === 'PUT';
  const entry = feedEligibleEntries(state).find((candidate) => candidate.id === Number(match[1]));
  const comment = match[2] ? state.comments.find((candidate) => candidate.id === Number(match[2])) : undefined;
  if (!entry || (match[2] && comment?.entryId !== entry.id)) {
    await fulfillJson(route, { message: 'Not found', statusCode: 404 }, { status: 404 });
    return true;
  }
  const ownerId = comment ? comment.userId : authorId(entry, state);
  if (like && ownerId === state.user.id) {
    await fulfillJson(route, { message: 'You cannot like your own content', statusCode: 400 }, { status: 400 });
    return true;
  }

  if (comment) {
    state.likedCommentIds = setLiked(state.likedCommentIds, comment.id, like);
    await fulfillJson(route, likeState(comment.likeCount, state.likedCommentIds, comment.id));
  } else {
    state.likedEntryIds = setLiked(state.likedEntryIds, entry.id, like);
    await fulfillJson(route, likeState(entry.likeCount, state.likedEntryIds, entry.id));
  }
  return true;
}

async function handleLeaderboardRoute({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/leaderboard' || request.method() !== 'GET') {
    return false;
  }

  const period = searchParams.get('period') || 'month';
  // The mock ignores the period window: every eligible entry counts, so tests control rankings through fixtures.
  const entries = feedEligibleEntries(state);
  const author = (entry: MockEntry) => ({
    id: authorId(entry, state),
    username: entry.authorUsername || state.user.username,
    avatarUrl: entry.authorAvatarUrl ?? null,
  });
  const rankEntries = (count: (entry: MockEntry) => number) => entries
    .map((entry) => ({ entry, count: count(entry) }))
    .filter(({ count: value }) => value > 0)
    .sort((left, right) => right.count - left.count)
    .map(({ entry, count: value }) => ({ id: entry.id, date: entry.date, excerpt: entry.content, author: author(entry), count: value }));
  const authors = new Map<number, { author: ReturnType<typeof author>; publicEntries: number }>();
  for (const entry of entries) {
    const current = authors.get(authorId(entry, state)) ?? { author: author(entry), publicEntries: 0 };
    authors.set(current.author.id, { ...current, publicEntries: current.publicEntries + 1 });
  }

  await fulfillJson(route, {
    period,
    mostActiveAuthors: [...authors.values()].sort((left, right) => right.publicEntries - left.publicEntries),
    mostLikedEntries: rankEntries((entry) => likeState(entry.likeCount, state.likedEntryIds, entry.id).likeCount),
    mostCommentedEntries: rankEntries((entry) => state.comments
      .filter((comment) => comment.entryId === entry.id && comment.userId !== authorId(entry, state)).length),
  });
  return true;
}

const MOCK_BADGES = [
  { id: 'first-public-entry', metric: 'publicEntries', threshold: 1 },
  { id: 'hundred-entries', metric: 'totalEntries', threshold: 100 },
  { id: 'week-streak', metric: 'longestStreak', threshold: 7 },
  { id: 'well-liked', metric: 'likesReceived', threshold: 10 },
  { id: 'connector', metric: 'followers', threshold: 10 },
] as const;

function longestStreak(dates: string[]) {
  const days = [...new Set(dates)].map((date) => Date.parse(`${date}T00:00:00Z`) / 86_400_000).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((day, index) => {
    run = index > 0 && day - days[index - 1] === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

async function handleAchievementsRoute({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/achievements' || request.method() !== 'GET') {
    return false;
  }

  const own = state.entries.filter((entry) => authorId(entry, state) === state.user.id);
  const ownPublicIds = new Set(feedEligibleEntries(state).filter((entry) => own.includes(entry)).map((entry) => entry.id));
  const stats = {
    publicEntries: ownPublicIds.size,
    totalEntries: own.length,
    longestStreak: longestStreak(own.map((entry) => entry.date)),
    likesReceived: own.reduce((sum, entry) => sum + (entry.likeCount ?? 0), 0)
      + state.comments.filter((comment) => comment.userId === state.user.id).reduce((sum, comment) => sum + (comment.likeCount ?? 0), 0),
    commentsReceived: state.comments.filter((comment) => ownPublicIds.has(comment.entryId) && comment.userId !== state.user.id).length,
    commentsWritten: state.comments.filter((comment) => comment.userId === state.user.id).length,
    followers: state.followerCount,
  };

  await fulfillJson(route, {
    karma: stats.likesReceived + stats.commentsReceived + stats.followers,
    stats,
    badges: MOCK_BADGES.map((badge) => ({
      ...badge,
      progress: Math.min(stats[badge.metric], badge.threshold),
      earned: stats[badge.metric] >= badge.threshold,
    })),
  });
  return true;
}

export async function handleSocialRoutes(context: RouteContext): Promise<boolean> {
  return (await handlePublicFeedRoute(context))
    || (await handleAchievementsRoute(context))
    || (await handleLeaderboardRoute(context))
    || (await handleFollowRoutes(context))
    || (await handleLikeRoutes(context))
    || handleCommentRoutes(context);
}
