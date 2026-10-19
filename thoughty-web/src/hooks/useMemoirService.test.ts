import { describe, expect, it, vi } from 'vitest';

import { renderHook } from './hookTestUtils';
import { useMemoirService } from './useMemoirService';

const authFetch = vi.fn();
const getAccessToken = vi.fn(() => 'test-token');
const memoirService = { fetchOverview: vi.fn() };
const createMemoirService = vi.fn(() => memoirService);

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ authFetch, getAccessToken }),
}));

vi.mock('../services/api', () => ({
  createAuthFetch: vi.fn(() => authFetch),
  createMemoirService: (...args: unknown[]) => createMemoirService(...(args as [])),
}));

describe('useMemoirService', () => {
  it('creates the memoir service once for the signed-in session', () => {
    const { result, rerender } = renderHook(() => useMemoirService());
    const initialService = result.current;

    rerender();

    expect(initialService).toBe(memoirService);
    expect(result.current).toBe(initialService);
    expect(createMemoirService).toHaveBeenCalledTimes(1);
    expect(createMemoirService).toHaveBeenCalledWith(authFetch);
  });
});
