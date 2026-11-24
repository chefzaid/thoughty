import { useCallback } from 'react';
import type { AiProblem, createAiService } from '../services/api/aiService';
import type { createEntriesService } from '../services/api/entriesService';
import type { LocalAiService } from '../services/localModel/localAiService';
import { INSPIRATION_ENTRY_WINDOW } from '../services/localModel/localModelWritingPrompts';
import type { Diary } from '../types';
import { composerDiaryId, diaryAiMode } from '../utils/diaryAi';

type EntriesService = Pick<ReturnType<typeof createEntriesService>, 'fetchEntries'>;

/** The most entries `GET /api/entries` gives in one batch. */
const BATCH_SIZE = 100;

/**
 * The tags of a diary's entries, newest first, as many as Get Inspired reads (two batches of the journal list),
 * or null when the list could not be read.
 */
export async function readDiaryEntryTags(entriesService: EntriesService, diaryId: number): Promise<string[][] | null> {
  const query = { search: '', filterTags: [], filterDate: '', filterVisibility: '', favorites: false, archiveStatus: 'all' as const, diaryId };
  const tags: string[][] = [];
  let after: string | null = null;
  do {
    const batch = await entriesService.fetchEntries(query, BATCH_SIZE, after ? { after } : {});
    if (batch === null || batch === 'notFound') return null;
    tags.push(...batch.entries.map((entry) => entry.tags ?? []));
    after = batch.nextCursor;
  } while (after && tags.length < INSPIRATION_ENTRY_WINDOW);
  return tags.slice(0, INSPIRATION_ENTRY_WINDOW);
}

interface GetInspirationOptions {
  readonly aiService: Pick<ReturnType<typeof createAiService>, 'getInspiration'>;
  readonly localAiService: Pick<LocalAiService, 'inspire'>;
  readonly entriesService: EntriesService;
  readonly diaries: readonly Pick<Diary, 'id' | 'aiMode' | 'isDefault'>[];
  readonly currentDiaryId: number | null;
}

/**
 * Get Inspired's question: from Thoughty's server for the diary shown (all of them when none is), or, when the
 * composer writes into a diary on the writer's own model, from that model, grounded in that diary's tags, which
 * this browser reads from the journal list. The reason is given when the writer's model gave no question.
 */
export function useGetInspiration({ aiService, localAiService, entriesService, diaries, currentDiaryId }: GetInspirationOptions) {
  return useCallback(async (): Promise<string | AiProblem | null> => {
    const diaryId = composerDiaryId(diaries, currentDiaryId);
    if (diaryId === undefined || diaryAiMode(diaries, diaryId) !== 'local') {
      return aiService.getInspiration(currentDiaryId ?? undefined);
    }
    const tags = await readDiaryEntryTags(entriesService, diaryId);
    if (tags === null) return null;
    const { data: question, refusal } = await localAiService.inspire(tags);
    return question ?? { problem: refusal ?? 'inspirationError' };
  }, [aiService, currentDiaryId, diaries, entriesService, localAiService]);
}
