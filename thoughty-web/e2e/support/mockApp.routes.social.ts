import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState, MockEntry } from './mockApp.shared';

const authorId = (entry: MockEntry, state: MockAppState) => entry.userId ?? state.user.id;

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

export async function handleSocialRoutes(context: RouteContext): Promise<boolean> {
  return (await handlePublicFeedRoute(context)) || handleFollowRoutes(context);
}
