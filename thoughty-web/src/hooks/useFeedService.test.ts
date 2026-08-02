import { describe, expect, it, vi } from 'vitest';

import { renderHook } from './hookTestUtils';
import { useFeedService } from './useFeedService';

const authFetch = vi.fn();
const getAccessToken = vi.fn(() => 'test-token');
const feedService = { fetchPublicFeed: vi.fn() };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ authFetch, getAccessToken }),
}));

vi.mock('../services/api', () => ({
  createAuthFetch: vi.fn(() => authFetch),
  createFeedService: vi.fn(() => feedService),
}));

describe('useFeedService', () => {
  it('creates and memoizes the authenticated feed service', () => {
    const { result, rerender } = renderHook(() => useFeedService());
    const initialService = result.current;

    rerender();

    expect(initialService).toBe(feedService);
    expect(result.current).toBe(initialService);
  });
});
