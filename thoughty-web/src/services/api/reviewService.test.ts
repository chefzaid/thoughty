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

  it('asks for the week ending on the writer’s day, and reflects on it', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ entries: 2 }));
    const service = createReviewService(authFetch);

    await expect(service.fetchWeek('2026-11-21', null)).resolves.toEqual({ data: { entries: 2 }, error: null });
    await service.fetchWeek('2026-11-21', 3);
    await service.reflectOnWeek('2026-11-21', null);
    await service.reflectOnWeek('2026-11-21', 3);

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/review/week?today=2026-11-21', undefined, undefined],
      ['/api/review/week?today=2026-11-21&diaryId=3', undefined, undefined],
      ['/api/review/week', 'POST', '{"today":"2026-11-21"}'],
      ['/api/review/week', 'POST', '{"today":"2026-11-21","diaryId":3}'],
    ]);
  });

  it('names the failure for the writer to read', async () => {
    const authFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'REVIEW_REFLECTION_UNAVAILABLE' }), { status: 503 }));
    const service = createReviewService(authFetch);

    await expect(service.reflectOnWeek('2026-11-21', null)).resolves.toEqual({ data: null, error: 'apiError_REVIEW_REFLECTION_UNAVAILABLE' });
  });
});
