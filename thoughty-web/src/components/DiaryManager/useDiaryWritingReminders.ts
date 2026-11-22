import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createDiaryWritingReminderService } from '../../services/api';
import { browserTimeZone } from '../../utils/timeZone';
import type { DiaryReminderHours } from './DiaryManager';

const DIARY_WRITING_REMINDERS_QUERY_KEY = ['diaryWritingReminders'] as const;

/**
 * The diaries' own writing reminder hours for Manage Diaries, and saving one. The browser's zone is sent
 * only for a writer who never saved the Profile reminder; the server keeps that reminder's zone otherwise.
 */
export function useDiaryWritingReminders(): {
  reminders: DiaryReminderHours | undefined;
  save: (diaryId: number, hour: number | null) => Promise<void>;
} {
  const service = useAuthenticatedService(createDiaryWritingReminderService);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: DIARY_WRITING_REMINDERS_QUERY_KEY,
    queryFn: async () => {
      const result = await service.list();
      if (!result.data) {
        throw new Error(result.error ?? 'diaryReminderLoadFailed');
      }
      return result.data;
    },
  });

  const reminders = useMemo(
    () =>
      query.data
        ? {
            hours: Object.fromEntries(query.data.reminders.map((reminder) => [reminder.diaryId, reminder.deliveryHour])),
            emailAvailable: query.data.emailAvailable,
          }
        : undefined,
    [query.data],
  );

  const save = useCallback(async (diaryId: number, hour: number | null) => {
    const result = await service.save(diaryId, { deliveryHour: hour, timeZone: browserTimeZone() });
    if (!result.data) {
      throw new Error(result.error ?? 'diaryReminderSaveFailed');
    }
    queryClient.setQueryData(DIARY_WRITING_REMINDERS_QUERY_KEY, result.data);
  }, [queryClient, service]);

  return { reminders, save };
}
