import { readApiErrorMessage, safeJsonParse } from './base';
import type { components, paths } from '../../generated/openapi';

export type PublicFeedScope = 'community' | 'following' | 'mine';
export type PublicFeedEntry = components['schemas']['PublicFeedEntryDto'];
export type PublicFeedAuthor = components['schemas']['PublicFeedAuthorDto'];
export type PublicFeedResponse = paths['/api/entries/feed']['get']['responses'][200]['content']['application/json'];
export type FollowedUser = components['schemas']['FollowedUserDto'];
export type FollowsResponse = components['schemas']['FollowsResponseDto'];
export type FollowState = components['schemas']['FollowStateDto'];
export type EntryComment = components['schemas']['EntryCommentDto'];
export type EntryCommentsResponse = components['schemas']['EntryCommentsResponseDto'];
export type EntryCommentDeleted = components['schemas']['EntryCommentDeletedDto'];
export type LikeState = components['schemas']['LikeStateDto'];

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

export type PublicFeedResult = ServiceResult<PublicFeedResponse>;

async function requestJson<T>(request: Promise<Response>, fallbackError: string): Promise<ServiceResult<T>> {
  try {
    const response = await request;
    if (!response.ok) {
      return { data: null, error: await readApiErrorMessage(response, fallbackError) };
    }

    const data = await safeJsonParse<T>(response);
    return data ? { data, error: null } : { data: null, error: fallbackError };
  } catch (error) {
    console.error(`${fallbackError}:`, error);
    return { data: null, error: fallbackError };
  }
}

export const createFeedService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => ({
  fetchPublicFeed(scope: PublicFeedScope, page: number, limit = 10): Promise<PublicFeedResult> {
    const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
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
      'Failed to post the comment',
    );
  },

  deleteComment(entryId: number, commentId: number): Promise<ServiceResult<EntryCommentDeleted>> {
    return requestJson(
      authFetch(`/api/entries/${entryId}/comments/${commentId}`, { method: 'DELETE' }),
      'Failed to delete the comment',
    );
  },

  setEntryLike(entryId: number, like: boolean): Promise<ServiceResult<LikeState>> {
    const request = like
      ? authFetch(`/api/entries/${entryId}/like`, { method: 'PUT' })
      : authFetch(`/api/entries/${entryId}/like`, { method: 'DELETE' });
    return requestJson(request, 'Failed to update the like');
  },

  setCommentLike(entryId: number, commentId: number, like: boolean): Promise<ServiceResult<LikeState>> {
    const request = like
      ? authFetch(`/api/entries/${entryId}/comments/${commentId}/like`, { method: 'PUT' })
      : authFetch(`/api/entries/${entryId}/comments/${commentId}/like`, { method: 'DELETE' });
    return requestJson(request, 'Failed to update the like');
  },
});

export type FeedService = ReturnType<typeof createFeedService>;
