import type { SavedSearch } from '@/database/entities';
import type { EntryFilterQueryDto } from '@/modules/entries/dto';

/** A saved search's filters as `GET /api/entries` reads them, plus the day it is limited to. */
export interface SavedSearchEntryFilters {
  filters: EntryFilterQueryDto;
  /** `YYYY-MM-DD`, when the search shows one day. */
  date?: string;
}

/**
 * The entry list filters a saved search stands for: its diary, tags, visibility, favorites,
 * archive state, mood, life era and person. The search text is left to the caller, which prepares it for the database.
 */
export function toSavedSearchEntryFilters(saved: Pick<SavedSearch, 'diaryId' | 'filters'>): SavedSearchEntryFilters {
  const { tags, visibility, favorites, archiveStatus, mood, date, eraId, personId } = saved.filters;
  return {
    filters: {
      tags: tags.join(','),
      visibility: visibility === 'all' ? undefined : visibility,
      favorites,
      archiveStatus,
      mood: mood || undefined,
      diaryId: saved.diaryId ?? undefined,
      eraId: eraId ?? undefined,
      personId: personId ?? undefined,
    },
    date: date ?? undefined,
  };
}
