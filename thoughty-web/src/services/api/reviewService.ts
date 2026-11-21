import { requestJson, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type YearReview = components['schemas']['YearReviewDto'];
export type YearReviewHighlight = components['schemas']['YearReviewHighlightDto'];
export type YearReviewMood = components['schemas']['YearReviewMoodDto'];
export type YearMoodResponse = components['schemas']['YearMoodResponseDto'];
export type WeeklyReflectionState = components['schemas']['WeeklyReflectionStateDto'];
export type WeeklyReflection = components['schemas']['WeeklyReflectionDto'];
export type WeeklyReflectionResponse = components['schemas']['WeeklyReflectionResponseDto'];

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

  /** The seven days ending on the writer's day `today`, and the reflection saved for them, if any. */
  fetchWeek(today: string, diaryId: number | null): Promise<ServiceResult<WeeklyReflectionState>> {
    const params = new URLSearchParams({ today });
    if (diaryId) {
      params.set('diaryId', String(diaryId));
    }
    return requestJson(authFetch(`/api/review/week?${params}`), 'weeklyReflectionLoadError');
  },

  /** Reflects on those seven days with AI; the answer replaces the saved reflection. */
  reflectOnWeek(today: string, diaryId: number | null): Promise<ServiceResult<WeeklyReflectionResponse>> {
    return requestJson(
      authFetch('/api/review/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diaryId ? { today, diaryId } : { today }),
      }),
      'weeklyReflectionError',
    );
  },
});

export type ReviewService = ReturnType<typeof createReviewService>;
