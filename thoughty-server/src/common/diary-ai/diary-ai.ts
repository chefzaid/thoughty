import { ForbiddenException } from '@nestjs/common';
import { apiError } from '../errors/api-error';

/**
 * A diary's AI privacy mode, as each entry copies it (`entries.diary_ai_off`, `entries.diary_ai_ask`): no AI
 * feature reads an entry of a diary with AI off, whatever the request, and one of a diary that asks each time
 * only for an action on that entry or its text the writer agreed to (`aiConsent`). So every query that feeds a
 * journal-wide AI prompt leaves both out, every AI action on one entry refuses AI off, and asks for consent.
 */

/** The SQL condition "a journal-wide AI feature may read this entry". */
export function aiReadableEntrySql(alias = 'e'): string {
  return `(NOT ${alias}.diary_ai_off AND NOT ${alias}.diary_ai_ask)`;
}

/** The `where` a `find` that feeds a journal-wide AI prompt adds. */
export const AI_READABLE_WHERE = { diaryAiOff: false, diaryAiAsk: false } as const;

/** Refuses an AI action on a diary's text: `403 DIARY_AI_OFF` with AI off, `403 DIARY_AI_CONSENT_REQUIRED` unasked. */
function assertAiAllowed(off: boolean, ask: boolean, consent: boolean | undefined): void {
  if (off) {
    throw apiError(ForbiddenException, 'DIARY_AI_OFF');
  }
  if (ask && consent !== true) {
    throw apiError(ForbiddenException, 'DIARY_AI_CONSENT_REQUIRED');
  }
}

/** Refuses an AI action on an entry of a diary with AI off, or of one that asks each time without consent. */
export function assertEntryAiAllowed(
  entry: { diaryAiOff?: boolean | null; diaryAiAsk?: boolean | null },
  consent?: boolean,
): void {
  assertAiAllowed(entry.diaryAiOff === true, entry.diaryAiAsk === true, consent);
}

/** The same for a diary named by the request, such as the memoir's; a request without one is let through. */
export function assertDiaryAiAllowed(diary: { aiMode?: string | null } | null | undefined, consent?: boolean): void {
  assertAiAllowed(diary?.aiMode === 'off', diary?.aiMode === 'ask', consent);
}
