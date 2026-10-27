import { useQuery } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createWritingStreakService } from '../../services/api';

/** Under the journal's entry queries, so writing, deleting or restoring an entry measures the streak again. */
export const WRITING_STREAK_QUERY_KEY = ['app', 'entries', 'writing-streak'] as const;

/** The streak in the diary shown (null for all of them) up to `today`, the writer's own day; off while `enabled` is false. */
export function useWritingStreak(diaryId: number | null, today: string, enabled: boolean) {
  const service = useAuthenticatedService(createWritingStreakService);
  return useQuery({
    queryKey: [...WRITING_STREAK_QUERY_KEY, diaryId, today],
    queryFn: async () => {
      const response = await service.fetchStreak(diaryId, today);
      if (!response.data) {
        throw new Error(response.error ?? 'writingStreakLoadFailed');
      }
      return response.data;
    },
    enabled,
  });
}
