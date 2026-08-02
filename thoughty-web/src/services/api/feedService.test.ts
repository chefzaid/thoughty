import { describe, expect, it, vi } from 'vitest';

import { createFeedService } from './feedService';

describe('feedService', () => {
  it('requests a scoped page and returns the feed response', async () => {
    const payload = {
      entries: [],
      total: 0,
      page: 2,
      totalPages: 0,
      hasMore: false,
    };
    const authFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    const result = await createFeedService(authFetch).fetchPublicFeed('mine', 2, 5);

    expect(authFetch).toHaveBeenCalledWith('/api/entries/feed?scope=mine&page=2&limit=5');
    expect(result).toEqual({ data: payload, error: null });
  });

  it('returns an API error without exposing a malformed response', async () => {
    const authFetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'Feed unavailable' }),
      { status: 503 },
    ));

    const result = await createFeedService(authFetch).fetchPublicFeed('community', 1);

    expect(result).toEqual({ data: null, error: 'Feed unavailable' });
  });
});
