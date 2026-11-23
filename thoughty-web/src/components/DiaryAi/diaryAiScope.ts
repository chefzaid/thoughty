import { createContext, useContext } from 'react';

import type { Diary } from '../../types';
import { diaryAiScope, type DiaryAiScope } from '../../utils/diaryAi';

/** The writer's diaries as far as their AI mode goes, for the pages that do not receive them. None outside the signed-in app. */
export const DiaryAiContext = createContext<readonly Pick<Diary, 'id' | 'aiMode'>[]>([]);

/** Whether a journal-wide AI action on `diaryId` (all diaries when null) is off for it, or leaves AI-off diaries out. */
export function useDiaryAiScope(diaryId: number | null | undefined): DiaryAiScope {
  return diaryAiScope(useContext(DiaryAiContext), diaryId);
}
