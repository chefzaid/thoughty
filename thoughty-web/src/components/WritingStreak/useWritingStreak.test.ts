import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '../../hooks/hookTestUtils';
import { useWritingStreak } from './useWritingStreak';

const streakService = vi.hoisted(() => ({ fetchStreak: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => streakService,
}));

const streak = { currentStreak: 3, writtenToday: true, daysSinceLastEntry: 0, lastEntry: null };

describe('useWritingStreak', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the streak of the diary up to the writer’s day', async () => {
    streakService.fetchStreak.mockResolvedValue({ data: streak, error: null });
    const { result } = renderHook(() => useWritingStreak(2, '2026-10-27', true));

    await waitFor(() => expect(result.current.data).toEqual(streak));
    expect(streakService.fetchStreak).toHaveBeenCalledWith(2, '2026-10-27');
  });

  it('fails with the service’s reason', async () => {
    streakService.fetchStreak.mockResolvedValue({ data: null, error: 'writingStreakLoadFailed' });
    const { result } = renderHook(() => useWritingStreak(null, '2026-10-27', true));

    await waitFor(() => expect(result.current.error?.message).toBe('writingStreakLoadFailed'));
  });

  it('asks for nothing while the card is off', () => {
    renderHook(() => useWritingStreak(null, '2026-10-27', false));

    expect(streakService.fetchStreak).not.toHaveBeenCalled();
  });
});
