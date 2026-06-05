import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Diary } from '../types';
import { useApiServices } from './useApiServices';

const DIARIES_QUERY_KEY = ['app', 'diaries'] as const;
const EMPTY_DIARIES: Diary[] = [];

export const useDiaries = (isAuthenticated: boolean, suppressDefaultDiarySelection = false) => {
  const { diariesService } = useApiServices();
  const queryClient = useQueryClient();
  const [currentDiaryId, setCurrentDiaryId] = useState<number | null>(null);
  const hasInitializedDiarySelection = useRef(false);

  const diariesQuery = useQuery({
    queryKey: DIARIES_QUERY_KEY,
    queryFn: async (): Promise<Diary[]> => {
      const data = await diariesService.fetchDiaries();
      return data ?? [];
    },
    enabled: isAuthenticated,
  });

  const diaries = diariesQuery.data ?? EMPTY_DIARIES;

  const fetchDiaries = useCallback(async () => {
    return diariesQuery.refetch();
  }, [diariesQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    hasInitializedDiarySelection.current = false;
  }, [isAuthenticated]);

  useEffect(() => {
    if (hasInitializedDiarySelection.current) {
      return;
    }

    if (!diariesQuery.isFetched) {
      return;
    }

    if (diaries.length === 0) {
      return;
    }

    hasInitializedDiarySelection.current = true;

    if (!suppressDefaultDiarySelection && currentDiaryId === null && diaries.length > 0) {
      const defaultDiary = diaries.find(d => d.is_default);
      if (defaultDiary) setCurrentDiaryId(defaultDiary.id);
    }
  }, [currentDiaryId, diaries, diariesQuery.isFetched, suppressDefaultDiarySelection]);

  const handleCreateDiary = useCallback(async (diaryData: Partial<Diary>) => {
    const result = await diariesService.createDiary(diaryData);
    if (!result.success) throw new Error(result.error);
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
  }, [diariesService, queryClient]);

  const handleUpdateDiary = useCallback(async (id: number, diaryData: Partial<Diary>) => {
    const result = await diariesService.updateDiary(id, diaryData);
    if (!result.success) throw new Error(result.error);
    queryClient.setQueryData<Diary[]>(DIARIES_QUERY_KEY, (previousDiaries = []) => (
      previousDiaries.map((diary) => (diary.id === id ? { ...diary, ...diaryData } : diary))
    ));
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
  }, [diariesService, queryClient]);

  const handleDeleteDiary = useCallback(async (id: number, refreshEntries: () => void) => {
    const result = await diariesService.deleteDiary(id);
    if (!result.success) throw new Error(result.error);
    if (currentDiaryId === id) {
      const defaultDiary = diaries.find(d => d.is_default);
      setCurrentDiaryId(defaultDiary?.id || null);
    }
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
    refreshEntries();
  }, [diariesService, currentDiaryId, diaries, queryClient]);

  const handleSetDefaultDiary = useCallback(async (id: number) => {
    const result = await diariesService.setDefaultDiary(id);
    if (!result.success) throw new Error(result.error);
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
  }, [diariesService, queryClient]);

  const handleReorderDiaries = useCallback(async (orderedIds: number[]) => {
    const result = await diariesService.reorderDiaries(orderedIds);
    if (!result.success) throw new Error(result.error);
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
  }, [diariesService, queryClient]);

  return {
    diaries,
    currentDiaryId,
    setCurrentDiaryId,
    fetchDiaries,
    handleCreateDiary,
    handleUpdateDiary,
    handleDeleteDiary,
    handleSetDefaultDiary,
    handleReorderDiaries,
  };
};