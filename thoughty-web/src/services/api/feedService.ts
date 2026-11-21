import { requestJson, type ServiceResult } from './base';
import type { components, paths } from '../../generated/openapi';

type PublicFeedQuery = NonNullable<paths['/api/entries/feed']['get']['parameters']['query']>;
export type PublicFeedScope = NonNullable<PublicFeedQuery['scope']>;
export type PublicFeedEntry = components['schemas']['PublicFeedEntryDto'];
export type PublicFeedAuthor = components['schemas']['PublicFeedAuthorDto'];
export type PublicFeedResponse = paths['/api/entries/feed']['get']['responses'][200]['content']['application/json'];
export type FollowedUser = components['schemas']['FollowedUserDto'];
export type FollowsResponse = components['schemas']['FollowsResponseDto'];
export type FollowState = components['schemas']['FollowStateDto'];
export type FollowedTopic = components['schemas']['FollowedTopicDto'];
export type TopicFollowState = components['schemas']['TopicFollowStateDto'];
/** What narrows any feed tab: a topic (a tag, ignoring case) and a word search. */
export type PublicFeedFilters = Pick<PublicFeedQuery, 'tag' | 'search'>;
export type EntryComment = components['schemas']['EntryCommentDto'];
export type EntryCommentsResponse = components['schemas']['EntryCommentsResponseDto'];
export type EntryCommentDeleted = components['schemas']['EntryCommentDeletedDto'];
export type EntryCommentPolicyState = components['schemas']['EntryCommentPolicyDto'];
/** Who may comment on a public entry: anyone, its writer's followers, or no one. */
export type CommentPolicy = EntryCommentPolicyState['commentPolicy'];
export type LikeState = components['schemas']['LikeStateDto'];
export type SavedState = components['schemas']['SavedStateDto'];
export type Leaderboard = components['schemas']['LeaderboardResponseDto'];
export type LeaderboardPeriod = Leaderboard['period'];
export type Achievements = components['schemas']['AchievementsResponseDto'];

export type PublicFeedResult = ServiceResult<PublicFeedResponse>;

export const createFeedService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => ({
  fetchPublicFeed(
    scope: PublicFeedScope,
    page: number,
    limit = 10,
    filters: PublicFeedFilters = {},
  ): Promise<PublicFeedResult> {
    const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
    if (filters.tag) params.set('tag', filters.tag);
    if (filters.search) params.set('search', filters.search);
    return requestJson(authFetch(`/api/entries/feed?${params}`), 'Failed to load the public feed');
  },

  fetchFollows(): Promise<ServiceResult<FollowsResponse>> {
    return requestJson(authFetch('/api/follows'), 'Failed to load followed users');
  },

  setFollowing(userId: number, follow: boolean): Promise<ServiceResult<FollowState>> {
    const request = follow
      ? authFetch(`/api/follows/${userId}`, { method: 'PUT' })
      : authFetch(`/api/follows/${userId}`, { method: 'DELETE' });
    return requestJson(request, 'Failed to update the follow');
  },

  /** Follows a topic, whose public entries then join the Following tab, or stops following it. */
  setTopicFollowing(tag: string, follow: boolean): Promise<ServiceResult<TopicFollowState>> {
    const topic = encodeURIComponent(tag);
    const request = follow
      ? authFetch(`/api/follows/topics/${topic}`, { method: 'PUT' })
      : authFetch(`/api/follows/topics/${topic}`, { method: 'DELETE' });
    return requestJson(request, 'Failed to update the topic');
  },

  fetchComments(entryId: number): Promise<ServiceResult<EntryCommentsResponse>> {
    return requestJson(authFetch(`/api/entries/${entryId}/comments`), 'Failed to load comments');
  },

  addComment(entryId: number, content: string): Promise<ServiceResult<EntryComment>> {
    return requestJson(
      authFetch(`/api/entries/${entryId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
      'commentPostError',
    );
  },

  deleteComment(entryId: number, commentId: number): Promise<ServiceResult<EntryCommentDeleted>> {
    return requestJson(
      authFetch(`/api/entries/${entryId}/comments/${commentId}`, { method: 'DELETE' }),
      'Failed to delete the comment',
    );
  },

  /** The entry's writer chooses who may comment on it. */
  setCommentPolicy(entryId: number, policy: CommentPolicy): Promise<ServiceResult<EntryCommentPolicyState>> {
    return requestJson(
      authFetch(`/api/entries/${entryId}/comment-policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy }),
      }),
      'commentPolicyUpdateError',
    );
  },

  /** The entry's writer hides a comment from everyone but them and its writer, or shows it again. */
  setCommentHidden(entryId: number, commentId: number, hidden: boolean): Promise<ServiceResult<EntryComment>> {
    const request = hidden
      ? authFetch(`/api/entries/${entryId}/comments/${commentId}/hidden`, { method: 'PUT' })
      : authFetch(`/api/entries/${entryId}/comments/${commentId}/hidden`, { method: 'DELETE' });
    return requestJson(request, 'commentUpdateError');
  },

  /** The entry's writer pins a comment on top, in place of any other, or unpins it. */
  setCommentPinned(entryId: number, commentId: number, pinned: boolean): Promise<ServiceResult<EntryComment>> {
    const request = pinned
      ? authFetch(`/api/entries/${entryId}/comments/${commentId}/pin`, { method: 'PUT' })
      : authFetch(`/api/entries/${entryId}/comments/${commentId}/pin`, { method: 'DELETE' });
    return requestJson(request, 'commentUpdateError');
  },

  fetchLeaderboard(period: LeaderboardPeriod): Promise<ServiceResult<Leaderboard>> {
    return requestJson(authFetch(`/api/leaderboard?period=${period}`), 'Failed to load the leaderboard');
  },

  fetchAchievements(): Promise<ServiceResult<Achievements>> {
    return requestJson(authFetch('/api/achievements'), 'Failed to load achievements');
  },

  setEntryLike(entryId: number, like: boolean): Promise<ServiceResult<LikeState>> {
    const request = like
      ? authFetch(`/api/entries/${entryId}/like`, { method: 'PUT' })
      : authFetch(`/api/entries/${entryId}/like`, { method: 'DELETE' });
    return requestJson(request, 'Failed to update the like');
  },

  /** Adds another writer's public entry to the reader's private Saved list, or takes it out. */
  setEntrySaved(entryId: number, save: boolean): Promise<ServiceResult<SavedState>> {
    const request = save
      ? authFetch(`/api/entries/${entryId}/save`, { method: 'PUT' })
      : authFetch(`/api/entries/${entryId}/save`, { method: 'DELETE' });
    return requestJson(request, 'Failed to update the Saved list');
  },

  setCommentLike(entryId: number, commentId: number, like: boolean): Promise<ServiceResult<LikeState>> {
    const request = like
      ? authFetch(`/api/entries/${entryId}/comments/${commentId}/like`, { method: 'PUT' })
      : authFetch(`/api/entries/${entryId}/comments/${commentId}/like`, { method: 'DELETE' });
    return requestJson(request, 'Failed to update the like');
  },
});

export type FeedService = ReturnType<typeof createFeedService>;
