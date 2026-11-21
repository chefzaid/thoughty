import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { JOURNAL_ENTRY_QUERY_KEYS } from '../../hooks/useEntriesState';
import { createEntriesService } from '../../services/api';
import type { Entry, TranslationFunction } from '../../types';
import { cleanEntryTitle } from '../../utils/entryTime';
import type { SharedText } from '../../utils/peopleCheck';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { extractDate } from '../EntriesList/EntriesList.utils';

/**
 * Saves the new words **Replace** wrote into saved entries, each keeping its visibility, tags, date and format
 * (the server keeps the earlier text as a revision), then reloads the journal. Resolves how many were saved.
 */
export function useRewriteEntries(): (entries: readonly Entry[], rewritten: readonly SharedText[]) => Promise<{ saved: number; failed: number }> {
  const entriesService = useAuthenticatedService(createEntriesService);
  const queryClient = useQueryClient();

  return useCallback(async (entries, rewritten) => {
    let saved = 0;
    for (const change of rewritten) {
      const entry = entries.find((candidate) => candidate.id === change.key);
      const success = entry !== undefined && await entriesService.updateEntry(entry.id, {
        text: change.text,
        title: cleanEntryTitle(change.title),
        tags: entry.tags,
        date: extractDate(entry.date),
        visibility: entry.visibility,
        format: entry.format ?? 'plain',
      });
      if (success) saved += 1;
    }
    await Promise.all(JOURNAL_ENTRY_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    return { saved, failed: rewritten.length - saved };
  }, [entriesService, queryClient]);
}

/** The title and text of saved entries, as the check reads them. */
export function entryTexts(entries: readonly Entry[]): SharedText[] {
  return entries.map((entry) => ({ key: entry.id, title: entry.title ?? '', text: entry.content }));
}

/** What the reader is told once Replace saved the entries: to read them again, or that some could not be saved. */
export function rewriteOutcome({ saved, failed }: { saved: number; failed: number }, t: TranslationFunction, language: Language): string {
  return failed > 0 ? t('peopleCheckReplaceFailed') : pluralPhrase(t, 'peopleCheckReplaced', saved, language);
}
