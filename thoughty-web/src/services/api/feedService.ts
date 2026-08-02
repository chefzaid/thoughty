import { readApiErrorMessage, safeJsonParse } from './base';
import type { components, paths } from '../../generated/openapi';

export type PublicFeedScope = 'community' | 'mine';
export type PublicFeedEntry = components['schemas']['PublicFeedEntryDto'];
export type PublicFeedResponse = paths['/api/entries/feed']['get']['responses'][200]['content']['application/json'];

export interface PublicFeedResult {
  data: PublicFeedResponse | null;
  error: string | null;
}

export const createFeedService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => ({
  async fetchPublicFeed(scope: PublicFeedScope, page: number, limit = 10): Promise<PublicFeedResult> {
    try {
      const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
      const response = await authFetch(`/api/entries/feed?${params}`);
      if (!response.ok) {
        return {
          data: null,
          error: await readApiErrorMessage(response, 'Failed to load the public feed'),
        };
      }

      const data = await safeJsonParse<PublicFeedResponse>(response);
      return data
        ? { data, error: null }
        : { data: null, error: 'Failed to load the public feed' };
    } catch (error) {
      console.error('Error fetching public feed:', error);
      return { data: null, error: 'Failed to load the public feed' };
    }
  },
});

export type FeedService = ReturnType<typeof createFeedService>;
