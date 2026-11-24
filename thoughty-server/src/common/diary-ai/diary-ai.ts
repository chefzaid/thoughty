import { ForbiddenException } from '@nestjs/common';
import { apiError } from '../errors/api-error';

/**
 * A diary's AI privacy mode, as each entry copies it (`entries.diary_ai_off`, `entries.diary_ai_ask`,
 * `entries.diary_ai_local`): no AI feature reads an entry of a diary with AI off, whatever the request, and one of a
 * diary that asks each time only for an action on that entry or its text the writer agreed to (`aiConsent`). A diary
 * on the writer's own model (`local`) is AI off for this server (its entries have `diary_ai_off` set too): the
 * writer's browser sends its text to that model, never to Thoughty's provider. So every query that feeds a
 * journal-wide AI prompt leaves all three out, and every AI action on one entry refuses AI off and the writer's own
 * model, and asks for consent.
 */

/** The SQL condition "a journal-wide AI feature may read this entry". */
export function aiReadableEntrySql(alias = 'e'): string {
  return `(NOT ${alias}.diary_ai_off AND NOT ${alias}.diary_ai_ask)`;
}

/** The `where` a `find` that feeds a journal-wide AI prompt adds. */
export const AI_READABLE_WHERE = { diaryAiOff: false, diaryAiAsk: false } as const;

/** A diary's AI mode, as an AI action on its text or one of its entries reads it. */
interface AiModeFlags {
  readonly off: boolean;
  readonly ask: boolean;
  readonly local: boolean;
}

/**
 * Refuses an AI action on a diary's text: `403 DIARY_AI_LOCAL` for a diary on the writer's own model, `403
 * DIARY_AI_OFF` with AI off, and `403 DIARY_AI_CONSENT_REQUIRED` when a diary that asks each time was not asked.
 */
function assertAiAllowed({ off, ask, local }: AiModeFlags, consent: boolean | undefined): void {
  if (local) {
    throw apiError(ForbiddenException, 'DIARY_AI_LOCAL');
  }
  if (off) {
    throw apiError(ForbiddenException, 'DIARY_AI_OFF');
  }
  if (ask && consent !== true) {
    throw apiError(ForbiddenException, 'DIARY_AI_CONSENT_REQUIRED');
  }
}

/**
 * Refuses an AI action on an entry of a diary with AI off or on the writer's own model, or of one that asks each
 * time without consent.
 */
export function assertEntryAiAllowed(
  entry: { diaryAiOff?: boolean | null; diaryAiAsk?: boolean | null; diaryAiLocal?: boolean | null },
  consent?: boolean,
): void {
  assertAiAllowed(
    { off: entry.diaryAiOff === true, ask: entry.diaryAiAsk === true, local: entry.diaryAiLocal === true },
    consent,
  );
}

/** The same for a diary named by the request, such as the memoir's; a request without one is let through. */
export function assertDiaryAiAllowed(diary: { aiMode?: string | null } | null | undefined, consent?: boolean): void {
  const mode = diary?.aiMode;
  assertAiAllowed({ off: mode === 'off', ask: mode === 'ask', local: mode === 'local' }, consent);
}
