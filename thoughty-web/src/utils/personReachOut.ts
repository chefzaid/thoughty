import type { components } from '../generated/openapi';

export type ReachOutDays = components['schemas']['PersonReachOutHighlightDto']['reachOutDays'];

/** The reminders the People page offers, in days, as the API takes them: 2 weeks to a year. */
export const REACH_OUT_DAYS: readonly ReachOutDays[] = [14, 30, 60, 90, 180, 365];

/** The reach-out fields as the writer fills them in: the reminder's days (empty for none) and the last contact day. */
export interface ReachOutDraft {
  readonly after: string;
  readonly lastContactOn: string;
}

export function reachOutDraft(person: { reachOutDays: ReachOutDays | null; lastContactOn: string | null }): ReachOutDraft {
  return { after: person.reachOutDays === null ? '' : String(person.reachOutDays), lastContactOn: person.lastContactOn ?? '' };
}

/**
 * What to send for the draft, or the translation key of why it cannot be: a last contact after the writer's
 * day `today` (the API refuses one after today anywhere on Earth, `PERSON_CONTACT_IN_FUTURE`).
 */
export function readReachOutDraft(
  draft: ReachOutDraft,
  today: string,
): { reachOutDays: ReachOutDays | null; lastContactOn: string | null } | { error: 'apiError_PERSON_CONTACT_IN_FUTURE' } {
  if (draft.lastContactOn > today) return { error: 'apiError_PERSON_CONTACT_IN_FUTURE' };
  const days = REACH_OUT_DAYS.find((value) => String(value) === draft.after) ?? null;
  return { reachOutDays: days, lastContactOn: draft.lastContactOn || null };
}
