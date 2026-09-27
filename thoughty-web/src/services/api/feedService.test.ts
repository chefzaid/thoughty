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

  it('returns a fallback error when the request throws', async () => {
    const authFetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await createFeedService(authFetch).fetchPublicFeed('following', 1);

    expect(authFetch).toHaveBeenCalledWith('/api/entries/feed?scope=following&page=1&limit=10');
    expect(result).toEqual({ data: null, error: 'Failed to load the public feed' });
  });

  it('loads the followed users', async () => {
    const payload = { following: [{ id: 2, username: 'maya', avatarUrl: null, followedAt: '2026-09-01T00:00:00.000Z' }], followerCount: 1 };
    const authFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    const result = await createFeedService(authFetch).fetchFollows();

    expect(authFetch).toHaveBeenCalledWith('/api/follows');
    expect(result).toEqual({ data: payload, error: null });
  });

  it('follows with PUT and unfollows with DELETE', async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ userId: 2, following: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'User not found' }), { status: 404 }));
    const service = createFeedService(authFetch);

    await expect(service.setFollowing(2, true)).resolves.toEqual({ data: { userId: 2, following: true }, error: null });
    await expect(service.setFollowing(9, false)).resolves.toEqual({ data: null, error: 'User not found' });
    expect(authFetch).toHaveBeenNthCalledWith(1, '/api/follows/2', { method: 'PUT' });
    expect(authFetch).toHaveBeenNthCalledWith(2, '/api/follows/9', { method: 'DELETE' });
  });
});
