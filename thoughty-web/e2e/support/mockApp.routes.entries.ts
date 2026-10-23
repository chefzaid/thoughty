import {
  moveToTrash,
  sortEntries,
  unique,
  type MockAppState,
  type MockEntry,
} from './mockApp.shared';
import { fulfillJson, sortStrings, toEntryResponse, type RouteContext } from './mockApp.route-utils';
import { matchMockSearch, type MockSearchResult } from './mockApp.search';

function getAutoTagLimit(state: MockAppState): number {
  return Number.parseInt(String(state.config.autoTagMaxTags ?? '0'), 10);
}

function resolveTags(state: MockAppState, tags: string[]): string[] {
  const autoTagLimit = getAutoTagLimit(state);
  if (tags.length === 0 && autoTagLimit > 0) {
    return ['focus', 'reflection'].slice(0, autoTagLimit);
  }
  return tags;
}

function getFilteredEntries(
  state: MockAppState,
  searchParams: URLSearchParams,
): { filtered: MockEntry[]; pageNumber: number; limit: number; searchResults: Map<number, MockSearchResult> | null } {
  let filtered = sortEntries(state.entries);
  const search = (searchParams.get('search') || '').trim();
  const sort = searchParams.get('sort') || 'relevance';
  const tags = (searchParams.get('tags') || '').split(',').filter(Boolean);
  const date = searchParams.get('date') || '';
  const visibility = searchParams.get('visibility') || '';
  const favorites = searchParams.get('favorites') === 'true';
  const archiveStatus = searchParams.get('archiveStatus') || 'active';
  const diaryId = searchParams.get('diaryId');
  const semanticIds = searchParams.get('ids')
    ?.split(',')
    .map((id) => Number(id)) ?? null;
  const pageNumber = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '10');

  let searchResults: Map<number, MockSearchResult> | null = null;
  if (search) {
    const results = new Map<number, MockSearchResult>();
    for (const entry of filtered) {
      const result = matchMockSearch(entry, search);
      if (result) results.set(entry.id, result);
    }
    searchResults = results;
    filtered = filtered.filter((entry) => results.has(entry.id));
    if (sort === 'relevance') {
      // Array sort is stable, so equal scores keep date order.
      filtered.sort((left, right) => results.get(right.id)!.score - results.get(left.id)!.score);
    }
  }
  if (tags.length > 0) {
    filtered = filtered.filter((entry) => tags.every((tag) => entry.tags.includes(tag)));
  }
  if (date) {
    filtered = filtered.filter((entry) => entry.date === date);
  }
  if (visibility) {
    filtered = filtered.filter((entry) => entry.visibility === visibility);
  }
  if (favorites) {
    filtered = filtered.filter((entry) => entry.is_favorite);
  }
  if (archiveStatus === 'active') {
    filtered = filtered.filter((entry) => !entry.is_archived);
  }
  if (archiveStatus === 'archived') {
    filtered = filtered.filter((entry) => entry.is_archived);
  }
  if (diaryId) {
    filtered = filtered.filter((entry) => String(entry.diaryId ?? 1) === diaryId);
  }
  if (semanticIds) {
    const semanticRank = new Map(semanticIds.map((id, index) => [id, index]));
    filtered = filtered
      .filter((entry) => semanticRank.has(entry.id))
      .sort((left, right) => semanticRank.get(left.id)! - semanticRank.get(right.id)!);
  }

  return { filtered, pageNumber, limit, searchResults };
}

async function handleEntriesCollectionRoute({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/entries' && request.method() === 'GET') {
    const { filtered, pageNumber, limit, searchResults } = getFilteredEntries(state, searchParams);
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const startIndex = (pageNumber - 1) * limit;
    const pagedEntries = filtered.slice(startIndex, startIndex + limit);

    await fulfillJson(route, {
      entries: pagedEntries.map((entry) => ({
        ...toEntryResponse(entry, state),
        ...(searchResults ? { search_matches: searchResults.get(entry.id)?.matches ?? [] } : {}),
      })),
      total: filtered.length,
      page: pageNumber,
      totalPages,
      allTags: sortStrings(unique(state.entries.flatMap((entry) => entry.tags))),
    });
    return true;
  }

  if (pathname !== '/api/entries' || request.method() !== 'POST') {
    return false;
  }

  const payload = request.postDataJSON() as {
    text: string;
    title?: string | null;
    timeOfDay?: string | null;
    tags: string[];
    date: string;
    visibility?: 'public' | 'private' | null;
    format?: 'plain' | 'markdown';
    diaryId?: number | null;
  };
  const sameDayEntries = state.entries.filter((entry) => entry.date === payload.date);
  const newEntry: MockEntry = {
    id: state.nextEntryId++,
    date: payload.date,
    index: sameDayEntries.length + 1,
    title: payload.title?.trim() || null,
    time_of_day: payload.timeOfDay || null,
    content: payload.text,
    tags: resolveTags(state, payload.tags),
    visibility: payload.visibility || 'private',
    format: payload.format || 'plain',
    diaryId: payload.diaryId ?? 1,
  };
  state.entries.push(newEntry);
  state.entries = sortEntries(state.entries);

  await fulfillJson(route, { success: true, entryId: newEntry.id });
  return true;
}

async function handleEntryMutationRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/entries/all' && request.method() === 'DELETE') {
    const diaryId = searchParams.get('diaryId');
    state.lastDeleteAllRequestUrl = new URL(request.url());
    const deletedCount = moveToTrash(state, (entry) => !diaryId || String(entry.diaryId ?? 1) === diaryId);
    await fulfillJson(route, { success: true, deletedCount });
    return true;
  }

  if (pathname === '/api/entries/reorder' && request.method() === 'PATCH') {
    const payload = request.postDataJSON() as { date: string; orderedIds: number[] };
    state.lastReorderPayload = payload;
    // The listed entries trade the indexes they hold, so the rest of the day keeps its numbers.
    const dayEntries = state.entries.filter((entry) => entry.date === payload.date);
    const listed = [...new Set(payload.orderedIds)].filter((id) => dayEntries.some((entry) => entry.id === id));
    const indexes = listed
      .map((id) => dayEntries.find((entry) => entry.id === id)!.index)
      .sort((left, right) => left - right);
    const order = new Map(listed.map((id, position) => [id, indexes[position]!]));
    state.entries = sortEntries(state.entries.map((entry) => (
      entry.date === payload.date && order.has(entry.id)
        ? { ...entry, index: order.get(entry.id) ?? entry.index }
        : entry
    )));
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname === '/api/entries/bulk' && request.method() === 'POST') {
    const payload = request.postDataJSON() as {
      ids: number[];
      action: 'delete' | 'visibility' | 'tags' | 'move' | 'archive' | 'rephrase';
      visibility?: 'public' | 'private';
      tags?: string[];
      diaryId?: number;
      isArchived?: boolean;
    };
    state.lastBulkPayload = payload;
    const selectedIds = new Set(payload.ids);

    if (payload.action === 'delete') {
      moveToTrash(state, (entry) => selectedIds.has(entry.id));
    } else {
      state.entries = state.entries.map((entry) => {
        if (!selectedIds.has(entry.id)) {
          return entry;
        }

        if (payload.action === 'visibility' && payload.visibility) {
          return { ...entry, visibility: payload.visibility };
        }
        if (payload.action === 'tags') {
          return { ...entry, tags: unique([...(entry.tags || []), ...(payload.tags || [])]) };
        }
        if (payload.action === 'move' && payload.diaryId) {
          return { ...entry, diaryId: payload.diaryId };
        }
        if (payload.action === 'archive') {
          return { ...entry, is_archived: payload.isArchived ?? true };
        }

        return entry;
      });
    }

    state.entries = sortEntries(state.entries);
    await fulfillJson(route, { success: true, affected: payload.ids.length });
    return true;
  }

  if (pathname === '/api/entries/tags' && request.method() === 'GET') {
    const counts = new Map<string, number>();
    state.entries.forEach((entry) => {
      unique(entry.tags).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });
    await fulfillJson(route, {
      tags: [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([tag, count]) => ({ tag, count })),
    });
    return true;
  }

  if (pathname === '/api/entries/tags' && request.method() === 'DELETE') {
    const tag = new URL(request.url()).searchParams.get('tag') ?? '';
    let affectedCount = 0;
    state.entries = state.entries.map((entry) => {
      if (!entry.tags.includes(tag)) {
        return entry;
      }
      affectedCount += 1;
      return { ...entry, tags: entry.tags.filter((current) => current !== tag) };
    });
    await fulfillJson(route, { success: true, affectedCount });
    return true;
  }

  if (pathname === '/api/entries/tags/rename' && request.method() === 'PATCH') {
    const payload = request.postDataJSON() as { oldTag: string; newTag: string };
    let affected = 0;
    state.entries = state.entries.map((entry) => {
      if (!entry.tags.includes(payload.oldTag)) {
        return entry;
      }
      affected += 1;
      return {
        ...entry,
        tags: unique(entry.tags.map((tag) => (tag === payload.oldTag ? payload.newTag : tag))),
      };
    });
    await fulfillJson(route, { success: true, affected });
    return true;
  }

  const updateMatch = /^\/api\/entries\/(\d+)$/.exec(pathname);
  if (updateMatch && request.method() === 'PUT') {
    const entryId = Number(updateMatch[1]);
    const payload = request.postDataJSON() as {
      text: string;
      title?: string | null;
      timeOfDay?: string | null;
      tags: string[];
      date: string;
      visibility: 'public' | 'private';
      format?: 'plain' | 'markdown';
    };

    state.entries = state.entries.map((entry) => {
      if (entry.id !== entryId) {
        return entry;
      }

      state.revisions[entryId] = [
        ...(state.revisions[entryId] || []),
        {
          id: Date.now(),
          entryId,
          content: entry.content,
          title: entry.title ?? null,
          timeOfDay: entry.time_of_day ?? null,
          tags: entry.tags,
          date: entry.date,
          visibility: entry.visibility,
          format: entry.format || 'plain',
          createdAt: new Date().toISOString(),
        },
      ];

      return {
        ...entry,
        ...(payload.title === undefined ? {} : { title: payload.title?.trim() || null }),
        ...(payload.timeOfDay === undefined ? {} : { time_of_day: payload.timeOfDay || null }),
        content: payload.text,
        tags: resolveTags(state, payload.tags),
        date: payload.date,
        visibility: payload.visibility,
        format: payload.format || 'plain',
      };
    });
    state.entries = sortEntries(state.entries);

    await fulfillJson(route, { success: true });
    return true;
  }

  if (updateMatch && request.method() === 'DELETE') {
    const entryId = Number(updateMatch[1]);
    moveToTrash(state, (entry) => entry.id === entryId);
    await fulfillJson(route, { success: true });
    return true;
  }

  const toggleFavoriteMatch = /^\/api\/entries\/(\d+)\/favorite$/.exec(pathname);
  if (toggleFavoriteMatch && request.method() === 'PATCH') {
    const entryId = Number(toggleFavoriteMatch[1]);
    const payload = request.postDataJSON() as { isFavorite: boolean };

    state.entries = state.entries.map((entry) =>
      entry.id === entryId ? { ...entry, is_favorite: payload.isFavorite } : entry,
    );
    await fulfillJson(route, { success: true });
    return true;
  }

  const toggleVisibilityMatch = /^\/api\/entries\/(\d+)\/visibility$/.exec(pathname);
  if (toggleVisibilityMatch && request.method() === 'PATCH') {
    const entryId = Number(toggleVisibilityMatch[1]);
    const payload = request.postDataJSON() as { visibility: 'public' | 'private' };

    state.entries = state.entries.map((entry) =>
      entry.id === entryId ? { ...entry, visibility: payload.visibility } : entry,
    );
    await fulfillJson(route, { success: true });
    return true;
  }

  const toggleArchiveMatch = /^\/api\/entries\/(\d+)\/archive$/.exec(pathname);
  if (toggleArchiveMatch && request.method() === 'PATCH') {
    const entryId = Number(toggleArchiveMatch[1]);
    const payload = request.postDataJSON() as { isArchived: boolean };

    state.entries = state.entries.map((entry) =>
      entry.id === entryId ? { ...entry, is_archived: payload.isArchived } : entry,
    );
    await fulfillJson(route, { success: true });
    return true;
  }

  const historyMatch = /^\/api\/entries\/(\d+)\/history$/.exec(pathname);
  if (historyMatch) {
    const entryId = Number(historyMatch[1]);
    await fulfillJson(route, state.revisions[entryId] || []);
    return true;
  }

  const deleteRevisionMatch = /^\/api\/entries\/(\d+)\/history\/(\d+)$/.exec(pathname);
  if (deleteRevisionMatch && request.method() === 'DELETE') {
    const entryId = Number(deleteRevisionMatch[1]);
    const revisionId = Number(deleteRevisionMatch[2]);
    state.revisions[entryId] = (state.revisions[entryId] || []).filter((revision) => revision.id !== revisionId);
    await fulfillJson(route, { success: true });
    return true;
  }

  return false;
}

export async function handleEntriesRoutes(context: RouteContext): Promise<boolean> {
  if (await handleEntriesCollectionRoute(context)) {
    return true;
  }

  if (await handleEntryMutationRoutes(context)) {
    return true;
  }

  return false;
}
