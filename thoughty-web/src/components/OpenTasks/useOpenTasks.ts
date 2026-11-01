import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { JOURNAL_ENTRY_QUERY_KEYS } from '../../hooks/useEntriesState';
import { createEntriesService, createOpenTasksService, type OpenTask } from '../../services/api';

export const OPEN_TASKS_QUERY_KEY = ['openTasks'] as const;
export const OPEN_TASKS_PAGE_SIZE = 50;

/** One page of the open tasks of a diary (or all of them), and ticking one in its entry. */
export function useOpenTasks(page: number, diaryId: number | null) {
  const service = useAuthenticatedService(createOpenTasksService);
  const entriesService = useAuthenticatedService(createEntriesService);
  const queryClient = useQueryClient();

  const tasks = useQuery({
    queryKey: [...OPEN_TASKS_QUERY_KEY, diaryId, page],
    queryFn: async () => {
      const result = await service.fetchPage(page, OPEN_TASKS_PAGE_SIZE, diaryId);
      if (!result.data) {
        throw new Error(result.error ?? 'openTasksLoadError');
      }
      return result.data;
    },
    placeholderData: keepPreviousData,
  });

  /**
   * Ticks or unticks a task in its entry, named by its line and text so a changed entry is never ticked
   * on the wrong line. The page keeps showing the task as ticked; the journal reads the entry again when
   * next shown. When the entry changed meanwhile, the list is read again.
   */
  const setTask = useCallback(async (task: OpenTask, checked: boolean) => {
    const result = await entriesService.setEntryTask(task.entryId, task.line, checked, task.text);
    await (result.success
      ? queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRY_QUERY_KEYS[0], refetchType: 'none' })
      : queryClient.invalidateQueries({ queryKey: OPEN_TASKS_QUERY_KEY }));
    return result;
  }, [entriesService, queryClient]);

  return { tasks, setTask };
}
