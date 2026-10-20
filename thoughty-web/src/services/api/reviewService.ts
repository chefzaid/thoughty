import { requestJson, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type YearReview = components['schemas']['YearReviewDto'];
export type YearReviewHighlight = components['schemas']['YearReviewHighlightDto'];
export type YearReviewMood = components['schemas']['YearReviewMoodDto'];
export type YearMoodResponse = components['schemas']['YearMoodResponseDto'];

export const createReviewService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => ({
  fetchReview(year: number, diaryId: number | null): Promise<ServiceResult<YearReview>> {
    const params = new URLSearchParams({ year: String(year) });
    if (diaryId) {
      params.set('diaryId', String(diaryId));
    }
    return requestJson(authFetch(`/api/review?${params}`), 'Failed to load the year in review');
  },

  readMood(year: number, diaryId: number | null): Promise<ServiceResult<YearMoodResponse>> {
    return requestJson(
      authFetch('/api/review/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diaryId ? { year, diaryId } : { year }),
      }),
      'Failed to read the mood of the year',
    );
  },
});

export type ReviewService = ReturnType<typeof createReviewService>;
