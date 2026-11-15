import type { Diary } from '../../types';

/** The diary an entry is in: its own, or the default diary for an entry saved before it had one. */
export function entryDiaryId(entry: { readonly diary_id?: number | null }, diaries: readonly Diary[]): number | null {
    return entry.diary_id ?? diaries.find((diary) => diary.isDefault)?.id ?? null;
}
