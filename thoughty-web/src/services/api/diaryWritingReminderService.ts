import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type DiaryWritingReminders = components['schemas']['DiaryWritingRemindersDto'];
export type DiaryWritingReminderChanges = components['schemas']['UpdateDiaryWritingReminderDto'];

/** The diaries' own writing reminder hours. Errors are translation keys, or the API's coded reason. */
export interface DiaryWritingReminderService {
  list(): Promise<ServiceResult<DiaryWritingReminders>>;
  /** A null hour removes the diary's own reminder; the answer is every diary's. */
  save(diaryId: number, changes: DiaryWritingReminderChanges): Promise<ServiceResult<DiaryWritingReminders>>;
}

export const createDiaryWritingReminderService = (authFetch: AuthFetchFunction): DiaryWritingReminderService => ({
  list() {
    return requestJson(authFetch('/api/writing-reminder-email/diaries'), 'diaryReminderLoadFailed');
  },

  save(diaryId, changes) {
    return requestJson(
      authFetch(`/api/writing-reminder-email/diaries/${diaryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      }),
      'diaryReminderSaveFailed',
    );
  },
});
