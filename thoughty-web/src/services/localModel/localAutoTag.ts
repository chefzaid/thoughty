import type { createEntriesService } from '../api/entriesService';
import type { LocalAiService } from './localAiService';

interface LocalAutoTagRequest {
  readonly localAi: Pick<LocalAiService, 'suggestTags'>;
  /** Adds the tags to the entry, through the journal's bulk `tags` action, which keeps those it has. */
  readonly entriesService: Pick<ReturnType<typeof createEntriesService>, 'bulkOperation'>;
  readonly entryId: number;
  /** The text saved. */
  readonly text: string;
  /** The tags saved with it. */
  readonly tags: readonly string[];
  /** The writer's auto-tag limit: tags are added until the entry has this many. */
  readonly limit: number;
}

/**
 * Tags an entry of a diary on the writer's own model just saved, as Thoughty's server does on save for the other
 * diaries: the model suggests the tags it lacks up to the writer's limit, and they are added to the saved entry.
 * It runs from this browser after the save, so only while the app is open. `failed` when the model gave no answer
 * or the tags could not be added; the entry is saved either way.
 */
export async function autoTagWithLocalModel({ localAi, entriesService, entryId, text, tags, limit }: LocalAutoTagRequest): Promise<'tagged' | 'none' | 'failed'> {
  const missing = limit - tags.length;
  if (missing <= 0 || !text.trim()) return 'none';
  const { data: suggested } = await localAi.suggestTags(text, [...tags], missing);
  if (suggested === null) return 'failed';
  if (suggested.length === 0) return 'none';
  const added = await entriesService.bulkOperation([entryId], 'tags', { tags: suggested.slice(0, missing) });
  return added?.success ? 'tagged' : 'failed';
}
