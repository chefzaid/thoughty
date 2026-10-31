import type { Entry } from '../types';
import { inlineImagesToAltText } from './inlineImages';
import { untickTasks } from './taskList';

/** What a new draft takes from the entry it starts from. */
export interface EntryStartingPoint {
  readonly text: string;
  readonly tags: string[];
  readonly format: 'plain' | 'markdown';
}

/**
 * The draft **Use as a starting point** writes: the entry's text with its task list items unticked
 * (a fresh checklist) and its inline pictures turned into their alt text (attachments stay with the
 * entry), its tags and its format. Its title, time, mood, date, visibility and attachments are left
 * behind. A sealed time capsule gives nothing, since its text is not readable yet.
 */
export function entryStartingPoint(entry: Pick<Entry, 'content' | 'tags' | 'format' | 'sealed_until'>): EntryStartingPoint | null {
  if (entry.sealed_until) {
    return null;
  }

  const format = entry.format ?? 'plain';
  return {
    text: untickTasks(inlineImagesToAltText(entry.content, format)),
    tags: [...entry.tags],
    format,
  };
}

/** The parts of the composer that starting from an entry replaces. */
export interface ComposerDraft {
  readonly newEntryText: string;
  readonly title?: string;
  readonly timeOfDay?: string;
  readonly mood?: number | null;
  readonly feelings?: string[];
  readonly tags: string[];
  readonly timeCapsule?: unknown;
}

/** Whether the composer holds anything that starting from an entry would replace. */
export function hasComposerDraft(draft: ComposerDraft): boolean {
  return draft.newEntryText.trim() !== ''
    || (draft.title ?? '').trim() !== ''
    || Boolean(draft.timeOfDay)
    || (draft.mood ?? null) !== null
    || (draft.feelings?.length ?? 0) > 0
    || draft.tags.length > 0
    || Boolean(draft.timeCapsule);
}
