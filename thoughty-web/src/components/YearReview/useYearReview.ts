import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createReviewService, type YearReview } from '../../services/api';

const reviewKey = (year: number, diaryId: number | null) => ['yearReview', year, diaryId ?? 'all'] as const;

/** The review of one year and scope, and reading its mood on request. */
export function useYearReview(year: number, diaryId: number | null) {
  const service = useAuthenticatedService(createReviewService);
  const queryClient = useQueryClient();

  const review = useQuery({
    queryKey: reviewKey(year, diaryId),
    queryFn: async () => {
      const result = await service.fetchReview(year, diaryId);
      if (!result.data) {
        throw new Error(result.error ?? 'Failed to load the year in review');
      }
      return result.data;
    },
  });

  const mood = useMutation({
    mutationFn: async () => {
      const result = await service.readMood(year, diaryId);
      if (!result.data) {
        throw new Error(result.error ?? 'Failed to read the mood of the year');
      }
      return result.data.mood;
    },
    onSuccess: (reading) => {
      queryClient.setQueryData<YearReview>(reviewKey(year, diaryId), (current) => (current ? { ...current, mood: reading } : current));
    },
  });

  return { review, mood };
}
