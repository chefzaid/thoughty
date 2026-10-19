import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useMemoirService } from '../../hooks/useMemoirService';
import type {
  AnswerMemoirRequest,
  MemoirAnswerResult,
  MemoirOverview,
  ServiceResult,
  StartMemoirRequest,
  UpdateMemoirRequest,
} from '../../services/api';

export const MEMOIR_QUERY_KEY = ['memoir'] as const;

/** The memoir overview as server state; every change returns or refetches the fresh overview. */
export function useMemoir() {
  const memoirService = useMemoirService();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: MEMOIR_QUERY_KEY,
    queryFn: async () => {
      const result = await memoirService.fetchOverview();
      if (!result.data) throw new Error(result.error ?? 'Failed to load the memoir');
      return result.data;
    },
  });

  const applyOverview = useCallback(
    async (request: Promise<ServiceResult<MemoirOverview>>) => {
      const result = await request;
      if (result.data) queryClient.setQueryData(MEMOIR_QUERY_KEY, result.data);
      return result;
    },
    [queryClient],
  );

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: MEMOIR_QUERY_KEY }), [queryClient]);

  const start = useCallback((request: StartMemoirRequest) => applyOverview(memoirService.start(request)), [applyOverview, memoirService]);
  const update = useCallback((request: UpdateMemoirRequest) => applyOverview(memoirService.update(request)), [applyOverview, memoirService]);
  const skip = useCallback(() => applyOverview(memoirService.skip()), [applyOverview, memoirService]);

  const answer = useCallback(async (request: AnswerMemoirRequest): Promise<ServiceResult<MemoirAnswerResult>> => {
    const result = await memoirService.answer(request);
    if (result.data) await refresh();
    return result;
  }, [memoirService, refresh]);

  const leave = useCallback(async () => {
    const result = await memoirService.leave();
    if (result.data) await refresh();
    return result;
  }, [memoirService, refresh]);

  return {
    overview: query.data ?? null,
    loading: query.isPending,
    loadError: query.isError,
    retry: () => void query.refetch(),
    start,
    update,
    skip,
    answer,
    leave,
  };
}
