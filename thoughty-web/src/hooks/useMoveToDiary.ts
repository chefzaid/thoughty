import { useCallback } from 'react';

import type { Diary } from '../types';
import { useApiServices } from './useApiServices';
import type { Notifier } from './useAppNotice';

interface MoveToDiaryOptions {
  readonly diaries: readonly Diary[];
  /** The diary the journal shows, or `null` for all diaries. */
  readonly currentDiaryId: number | null;
  /** Reads again every view measured from the entries, which a move changes when they follow a diary. */
  readonly onMoved: () => void;
  readonly notifier: Notifier;
  /** Shows the journal of another diary, offered when the entry left the one shown. */
  readonly onShowDiary?: (diaryId: number) => void;
}

/**
 * Moves one entry to another of the writer's diaries through the same request as the journal's bulk **Move to
 * diary**, so both make the same change (only the diary: its visibility, history, links and shares stay). It
 * refreshes the entry views and says where the entry went. When the journal shows another diary the entry leaves
 * it, so the notice says so and offers to open the entry's new diary, which a keyboard user is taken to (the entry
 * they were on is gone). Resolves `false`, without a notice, when the move failed, so each caller says it in its place.
 */
export function useMoveToDiary({ diaries, currentDiaryId, onMoved, notifier, onShowDiary }: MoveToDiaryOptions) {
  const { entriesService } = useApiServices();
  const { notify, t } = notifier;

  /**
   * `closeAsker` runs once the move succeeded, before the notice: the dialog that asked closes in the same render
   * as the notice opens, so its focus return to the entry's menu cannot take focus back from the notice's action.
   */
  return useCallback(async (entryId: number, diaryId: number, closeAsker?: () => void): Promise<boolean> => {
    const result = await entriesService.bulkOperation([entryId], 'move', { diaryId });
    if (!result?.success) {
      return false;
    }

    closeAsker?.();
    onMoved();
    const diary = diaries.find((candidate) => candidate.id === diaryId)?.name ?? '';
    const leftView = currentDiaryId !== null && currentDiaryId !== diaryId;
    if (!leftView) {
      notify(t('entryMovedToDiary', { diary }));
      return true;
    }
    notify(t('entryMovedOutOfDiary', { diary }), onShowDiary && {
      label: t('moveToDiaryShow', { diary }),
      run: () => onShowDiary(diaryId),
    });
    return true;
  }, [currentDiaryId, diaries, entriesService, notify, onMoved, onShowDiary, t]);
}

export type MoveToDiary = ReturnType<typeof useMoveToDiary>;
