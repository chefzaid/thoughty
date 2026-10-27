import type { SelectQueryBuilder } from 'typeorm';
import type { Entry } from '@/database/entities';
import type { EntryFilterQueryDto } from './dto';
import { escapeLikePattern } from './entry-search-query';
import type { PreparedEntrySearch } from './entry-search.service';

/** At most this many entry IDs (a meaning search's matches) narrow a request. */
const MAX_FILTER_ENTRY_IDS = 50;

/** The distinct entry IDs of an `ids` filter, in the order given, at most fifty. */
export function parseEntryIdsFilter(ids: string | undefined): number[] {
  return ids
    ? [...new Set(ids.split(',').map((id) => Number.parseInt(id, 10)))].slice(0, MAX_FILTER_ENTRY_IDS)
    : [];
}

/**
 * Narrows a query on entries aliased `e` to the journal filters: the given IDs, the prepared search,
 * tags, visibility, diary, favorites, archive state, mood, life era and person. The caller scopes it to the
 * writer and orders it; entries in the recycle bin are left out by the entity's soft delete.
 */
export function applyEntryListFilters(
  qb: SelectQueryBuilder<Entry>,
  query: EntryFilterQueryDto,
  prepared: PreparedEntrySearch | null,
): void {
  const { ids, tags, visibility, diaryId, favorites, archiveStatus, mood, eraId, personId } = query;

  const entryIds = parseEntryIdsFilter(ids);
  if (entryIds.length > 0) {
    qb.andWhere('e.id IN (:...entryIds)', { entryIds });
  }

  if (prepared?.kind === 'text') {
    // Titles and tags are part of the search vector; an exact tag name still matches when it holds
    // nothing PostgreSQL reads as a word.
    qb.andWhere('(e.search_vector @@ CAST(:searchQuery AS tsquery) OR e.tags @> :searchTags)', {
      searchQuery: prepared.matchQuery,
      searchTags: [prepared.text],
    });
  } else if (prepared?.kind === 'literal') {
    qb.andWhere('(e.content ILIKE :searchPattern OR e.title ILIKE :searchPattern OR e.tags @> :searchTags)', {
      searchPattern: `%${escapeLikePattern(prepared.text)}%`,
      searchTags: [prepared.text],
    });
  }

  const tagList = (tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tagList.length > 0) {
    qb.andWhere('e.tags @> :tagList', { tagList });
  }

  if (visibility === 'public' || visibility === 'private') {
    qb.andWhere('e.visibility = :visibility', { visibility });
  }

  if (diaryId) {
    qb.andWhere('e.diary_id = :diaryId', { diaryId });
  }

  if (favorites) {
    qb.andWhere('e.is_favorite = true');
  }

  if (archiveStatus === 'active') {
    qb.andWhere('e.is_archived = false');
  } else if (archiveStatus === 'archived') {
    qb.andWhere('e.is_archived = true');
  }

  if (mood === 'any') {
    qb.andWhere('e.mood IS NOT NULL');
  } else if (mood === 'none') {
    qb.andWhere('e.mood IS NULL');
  } else if (mood) {
    qb.andWhere('e.mood IN (:...moods)', { moods: [...new Set(mood.split(',').map(Number))] });
  }

  if (eraId) {
    // Only the entry owner's era counts, so another writer's era ID matches nothing
    qb.andWhere(
      `EXISTS (SELECT 1 FROM life_eras era WHERE era.id = :eraId AND era.user_id = e.user_id
        AND e.date >= era.start_date AND (era.end_date IS NULL OR e.date <= era.end_date))`,
      { eraId },
    );
  }

  if (personId) {
    // Links join only a writer's entries to their own people, so another writer's person matches nothing
    qb.andWhere('EXISTS (SELECT 1 FROM entry_people ep WHERE ep.entry_id = e.id AND ep.person_id = :personId)', { personId });
  }
}
