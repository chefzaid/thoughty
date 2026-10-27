import { describe, expect, it, vi } from 'vitest';

import { createWritingStreakService } from './writingStreakService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const streak = { currentStreak: 3, writtenToday: true, daysSinceLastEntry: 0, lastEntry: null };

describe('writingStreakService', () => {
  it('asks for the streak up to the writer’s day, in every diary or one', async () => {
    const authFetch = vi.fn().mockImplementation(() => Promise.resolve(ok(streak)));
    const service = createWritingStreakService(authFetch);

    await expect(service.fetchStreak(null, '2026-10-27')).resolves.toEqual({ data: streak, error: null });
    await service.fetchStreak(2, '2026-10-27');

    expect(authFetch).toHaveBeenNthCalledWith(1, '/api/stats/streak?today=2026-10-27');
    expect(authFetch).toHaveBeenNthCalledWith(2, '/api/stats/streak?today=2026-10-27&diaryId=2');
  });

  it('gives a translation key when the streak cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createWritingStreakService(vi.fn().mockRejectedValue(new Error('offline')));

    await expect(service.fetchStreak(null, '2026-10-27')).resolves.toEqual({ data: null, error: 'writingStreakLoadFailed' });
  });
});
