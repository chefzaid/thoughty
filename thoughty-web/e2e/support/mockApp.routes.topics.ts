import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState, MockEntry } from './mockApp.shared';

/** Whether the entry carries the topic: one of its tags, ignoring case, as the API matches it. */
export function carriesTopic(entry: MockEntry, tag: string): boolean {
  return entry.tags.some((entryTag) => entryTag.toLowerCase() === tag.toLowerCase());
}

/** Whether the entry carries a topic the reader follows. */
export function carriesFollowedTopic(entry: MockEntry, state: MockAppState): boolean {
  return state.followedTopics.some((tag) => carriesTopic(entry, tag));
}

/**
 * A rough stand-in for the API's word search: every word of the search appears in the entry's title,
 * text or tags, ignoring case (the API also reads word forms in English and French).
 */
export function matchesFeedSearch(entry: MockEntry, search: string): boolean {
  const text = [entry.title ?? '', entry.content, ...entry.tags].join(' ').toLowerCase();
  return search.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));
}

export function followedTopicsResponse(state: MockAppState) {
  return [...state.followedTopics]
    .sort((left, right) => left.localeCompare(right))
    .map((tag) => ({ tag, followedAt: '2026-07-01T12:00:00.000Z' }));
}

/** `PUT` and `DELETE /api/follows/topics/:tag`. */
export async function handleTopicFollowRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const match = /^\/api\/follows\/topics\/([^/]+)$/.exec(pathname);
  if (!match || !['PUT', 'DELETE'].includes(request.method())) {
    return false;
  }

  const tag = decodeURIComponent(match[1]!).toLowerCase();
  const following = request.method() === 'PUT';
  state.followedTopics = state.followedTopics.filter((followed) => followed !== tag);
  if (following) state.followedTopics.push(tag);
  await fulfillJson(route, { tag, following });
  return true;
}
