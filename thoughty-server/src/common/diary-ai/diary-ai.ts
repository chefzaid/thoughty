import { ForbiddenException } from '@nestjs/common';
import { apiError } from '../errors/api-error';

/**
 * A diary's AI privacy mode, as each entry copies it (`entries.diary_ai_off`): no AI feature reads an entry
 * of a diary with AI off, whatever the request, so every query that feeds an AI prompt leaves them out and
 * every AI action on one entry refuses it.
 */

/** The SQL condition "AI may read this entry". */
export function aiReadableEntrySql(alias = 'e'): string {
  return `NOT ${alias}.diary_ai_off`;
}

/** The `where` a `find` that feeds an AI prompt adds. */
export const AI_READABLE_WHERE = { diaryAiOff: false } as const;

/** Refuses an AI action on an entry of a diary with AI off (`403 DIARY_AI_OFF`). */
export function assertEntryAiAllowed(entry: { diaryAiOff?: boolean | null }): void {
  if (entry.diaryAiOff) {
    throw apiError(ForbiddenException, 'DIARY_AI_OFF');
  }
}

/** Refuses an AI action on a diary with AI off (`403 DIARY_AI_OFF`), such as the memoir's. */
export function assertDiaryAiAllowed(diary: { aiMode?: string | null } | null | undefined): void {
  if (diary?.aiMode === 'off') {
    throw apiError(ForbiddenException, 'DIARY_AI_OFF');
  }
}
