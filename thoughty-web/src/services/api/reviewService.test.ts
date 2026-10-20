import { describe, expect, it, vi } from 'vitest';

import { createReviewService } from './reviewService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('reviewService', () => {
  it('asks for one year, scoped to a diary when given', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ year: 2025 }));
    const service = createReviewService(authFetch);

    await expect(service.fetchReview(2025, null)).resolves.toEqual({ data: { year: 2025 }, error: null });
    await service.fetchReview(2024, 3);

    expect(authFetch.mock.calls.map(([url]) => url)).toEqual(['/api/review?year=2025', '/api/review?year=2024&diaryId=3']);
  });

  it('asks for the mood of the year', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ mood: { summary: 'Calm.' } }));
    const service = createReviewService(authFetch);

    await service.readMood(2025, null);
    await service.readMood(2025, 4);

    expect(authFetch.mock.calls.map(([url, options]) => [url, options.method, options.body])).toEqual([
      ['/api/review/mood', 'POST', '{"year":2025}'],
      ['/api/review/mood', 'POST', '{"year":2025,"diaryId":4}'],
    ]);
  });
});
