import type { MockAppState, MockEntry } from './mockApp.shared';

/** What the feed, comment and like routes of the mock API share. */
export const authorId = (entry: MockEntry, state: MockAppState) => entry.userId ?? state.user.id;

export function likeState(baseCount: number | undefined, likedIds: number[], id: number) {
  const liked = likedIds.includes(id);
  return { liked, likeCount: (baseCount ?? 0) + (liked ? 1 : 0) };
}

export function setLiked(likedIds: number[], id: number, like: boolean) {
  return like ? [...new Set([...likedIds, id])] : likedIds.filter((candidate) => candidate !== id);
}

/** Feed-visible entries the reader may reach: never one by a writer they blocked (`state.writers`). */
export function feedEligibleEntries(state: MockAppState) {
  return state.entries
    .filter((entry) => !state.writers.blocked.includes(authorId(entry, state)))
    .filter((entry) => entry.visibility === 'public')
    .filter((entry) => !entry.is_archived)
    .filter((entry) => (entry.moderationStatus || 'visible') === 'visible');
}
