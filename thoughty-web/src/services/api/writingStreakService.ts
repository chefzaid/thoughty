import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type WritingStreak = components['schemas']['WritingStreakResponseDto'];

/** The daily writing streak and the last entry, in one diary or all of them, up to the writer's day. */
export const createWritingStreakService = (authFetch: AuthFetchFunction) => ({
  fetchStreak(diaryId: number | null, today: string): Promise<ServiceResult<WritingStreak>> {
    const params = new URLSearchParams({ today });
    if (diaryId !== null) params.set('diaryId', String(diaryId));
    return requestJson(authFetch(`/api/stats/streak?${params}`), 'writingStreakLoadFailed');
  },
});

export type WritingStreakService = ReturnType<typeof createWritingStreakService>;
