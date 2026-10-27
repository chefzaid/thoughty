import {
  moveToTrash,
  sortEntries,
  unique,
  type MockAppState,
  type MockEntry,
} from './mockApp.shared';
import { fulfillJson, readQueryFlag, sortStrings, toEntryMutationResponse, toEntryResponse, toRevisionResponse, type RouteContext } from './mockApp.route-utils';
import { matchMockSearch, type MockSearchResult } from './mockApp.search';
import { getMockBacklinks } from './mockApp.backlinks';
import { mockEraContains } from './mockApp.routes.life-eras';
import { addMockMentionedPeople, mockMentions } from './mockApp.routes.people';
import { isMockSealed, mockSeal } from './mockApp.routes.time-capsules';
import { placeInlineImages } from './mockApp.routes.attachments';

const TASK_LINE = /^((?:[\t ]*>)*[\t ]*(?:[*+-]|\d{1,9}[.)])[\t ]+\[)([ xX])(\](?:[\t \r]|$)[^\n]*)$/;

const withoutTicks = (content: string): string => content
  .split('\n')
  .map((line) => line.replace(TASK_LINE, '$1 $3'))
  .join('\n');

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

export function getFilteredEntries(
  state: MockAppState,
  searchParams: URLSearchParams,
): { filtered: MockEntry[]; pageNumber: number; limit: number; searchResults: Map<number, MockSearchResult> | null } {
  let filtered = sortEntries(state.entries);
  const search = (searchParams.get('search') || '').trim();
  const sort = searchParams.get('sort') || 'relevance';
  const tags = (searchParams.get('tags') || '').split(',').filter(Boolean);
  const date = searchParams.get('date') || '';
  const visibility = searchParams.get('visibility') || '';
  const favorites = readQueryFlag(searchParams, 'favorites', false);
  const archiveStatus = searchParams.get('archiveStatus') || 'active';
  const diaryId = searchParams.get('diaryId');
  const mood = searchParams.get('mood') || '';
  const eraId = searchParams.get('eraId');
  const personId = searchParams.get('personId');
  const semanticIds = searchParams.get('ids')
    ?.split(',')
    .map((id) => Number(id)) ?? null;
  const pageNumber = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '10');

  // Like the API, a sealed time capsule matches nothing about its words, tags, mood or people
  if (search || tags.length > 0 || mood || personId) {
    filtered = filtered.filter((entry) => !isMockSealed(entry));
  }
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
  if (mood === 'any') {
    filtered = filtered.filter((entry) => entry.mood != null);
  } else if (mood === 'none') {
    filtered = filtered.filter((entry) => entry.mood == null);
  } else if (mood) {
    const levels = mood.split(',').map(Number);
    filtered = filtered.filter((entry) => entry.mood != null && levels.includes(entry.mood));
  }
  if (eraId) {
    const era = state.lifeEras.find((candidate) => String(candidate.id) === eraId);
    filtered = era ? filtered.filter((entry) => mockEraContains(era, entry.date)) : [];
  }
  if (personId) {
    const person = state.people.find((candidate) => String(candidate.id) === personId);
    filtered = person ? filtered.filter((entry) => mockMentions(entry, person)) : [];
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
    mood?: number | null;
    feelings?: string[];
    tags: string[];
    date: string;
    visibility?: 'public' | 'private' | null;
    format?: 'plain' | 'markdown';
    diaryId?: number | null;
    seal?: { opensOn: string; openHour?: number };
  };
  const sameDayEntries = state.entries.filter((entry) => entry.date === payload.date);
  const newEntry: MockEntry = {
    id: state.nextEntryId++,
    date: payload.date,
    index: sameDayEntries.length + 1,
    title: payload.title?.trim() || null,
    time_of_day: payload.timeOfDay || null,
    mood: payload.mood ?? null,
    feelings: payload.feelings ?? [],
    content: payload.text,
    tags: resolveTags(state, payload.tags),
    visibility: payload.visibility || 'private',
    format: payload.format || 'plain',
    diaryId: payload.diaryId ?? 1,
    ...mockSeal(payload.seal),
  };
  placeInlineImages(state, newEntry);
  state.entries.push(newEntry);
  state.entries = sortEntries(state.entries);
  addMockMentionedPeople(state.people, newEntry.content);

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
    await fulfillJson(route, { success: true, affectedCount: payload.ids.length });
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
    let affectedCount = 0;
    state.entries = state.entries.map((entry) => {
      if (!entry.tags.includes(payload.oldTag)) {
        return entry;
      }
      affectedCount += 1;
      return {
        ...entry,
        tags: unique(entry.tags.map((tag) => (tag === payload.oldTag ? payload.newTag : tag))),
      };
    });
    await fulfillJson(route, { success: true, affectedCount });
    return true;
  }

  const updateMatch = /^\/api\/entries\/(\d+)$/.exec(pathname);
  if (updateMatch && request.method() === 'PUT') {
    const entryId = Number(updateMatch[1]);
    const payload = request.postDataJSON() as {
      text: string;
      title?: string | null;
      timeOfDay?: string | null;
      mood?: number | null;
      feelings?: string[];
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
          mood: entry.mood ?? null,
          feelings: entry.feelings ?? [],
          tags: entry.tags,
          date: entry.date,
          visibility: entry.visibility,
          format: entry.format || 'plain',
          createdAt: new Date().toISOString(),
        },
      ];

      const updated: MockEntry = {
        ...entry,
        ...(payload.title === undefined ? {} : { title: payload.title?.trim() || null }),
        ...(payload.timeOfDay === undefined ? {} : { time_of_day: payload.timeOfDay || null }),
        ...(payload.mood === undefined ? {} : { mood: payload.mood }),
        ...(payload.feelings === undefined ? {} : { feelings: payload.feelings }),
        content: payload.text,
        tags: resolveTags(state, payload.tags),
        date: payload.date,
        visibility: payload.visibility,
        format: payload.format || 'plain',
      };
      placeInlineImages(state, updated, entry.content);
      return updated;
    });
    state.entries = sortEntries(state.entries);
    addMockMentionedPeople(state.people, payload.text);

    await fulfillJson(route, toEntryMutationResponse(state, entryId));
    return true;
  }

  if (updateMatch && request.method() === 'DELETE') {
    const entryId = Number(updateMatch[1]);
    moveToTrash(state, (entry) => entry.id === entryId);
    await fulfillJson(route, { success: true });
    return true;
  }

  const taskMatch = /^\/api\/entries\/(\d+)\/tasks$/.exec(pathname);
  if (taskMatch && request.method() === 'PATCH') {
    const entryId = Number(taskMatch[1]);
    const payload = request.postDataJSON() as { line: number; checked: boolean };
    state.taskRequests.push({ entryId, ...payload });
    const entry = state.entries.find((candidate) => candidate.id === entryId);
    const lines = entry?.content.split('\n') ?? [];
    const match = TASK_LINE.exec(lines[payload.line] ?? '');
    if (!entry || !match) {
      await fulfillJson(route, { message: 'That line is no longer a task. Reload the entry and try again.' }, { status: 409 });
      return true;
    }

    lines[payload.line] = `${match[1]}${payload.checked ? 'x' : ' '}${match[3]}`;
    const content = lines.join('\n');
    // Like the server, a run of ticks keeps one revision: the version from before the first tick
    const latest = state.revisions[entryId]?.at(-1);
    if (content !== entry.content && (!latest || withoutTicks(latest.content) !== withoutTicks(entry.content))) {
      state.revisions[entryId] = [...(state.revisions[entryId] || []), {
        id: Date.now(),
        entryId,
        content: entry.content,
        title: entry.title ?? null,
        timeOfDay: entry.time_of_day ?? null,
        mood: entry.mood ?? null,
        feelings: entry.feelings ?? [],
        tags: entry.tags,
        date: entry.date,
        visibility: entry.visibility,
        format: entry.format || 'plain',
        createdAt: new Date().toISOString(),
      }];
    }
    state.entries = state.entries.map((candidate) => (candidate.id === entryId ? { ...candidate, content } : candidate));
    await fulfillJson(route, toEntryMutationResponse(state, entryId));
    return true;
  }

  const toggleFavoriteMatch = /^\/api\/entries\/(\d+)\/favorite$/.exec(pathname);
  if (toggleFavoriteMatch && request.method() === 'PATCH') {
    const entryId = Number(toggleFavoriteMatch[1]);
    const payload = request.postDataJSON() as { isFavorite: boolean };

    state.entries = state.entries.map((entry) =>
      entry.id === entryId ? { ...entry, is_favorite: payload.isFavorite } : entry,
    );
    await fulfillJson(route, toEntryMutationResponse(state, entryId));
    return true;
  }

  const toggleVisibilityMatch = /^\/api\/entries\/(\d+)\/visibility$/.exec(pathname);
  if (toggleVisibilityMatch && request.method() === 'PATCH') {
    const entryId = Number(toggleVisibilityMatch[1]);
    const payload = request.postDataJSON() as { visibility: 'public' | 'private' };

    state.entries = state.entries.map((entry) =>
      entry.id === entryId ? { ...entry, visibility: payload.visibility } : entry,
    );
    await fulfillJson(route, toEntryMutationResponse(state, entryId));
    return true;
  }

  const toggleArchiveMatch = /^\/api\/entries\/(\d+)\/archive$/.exec(pathname);
  if (toggleArchiveMatch && request.method() === 'PATCH') {
    const entryId = Number(toggleArchiveMatch[1]);
    const payload = request.postDataJSON() as { isArchived: boolean };

    state.entries = state.entries.map((entry) =>
      entry.id === entryId ? { ...entry, is_archived: payload.isArchived } : entry,
    );
    await fulfillJson(route, toEntryMutationResponse(state, entryId));
    return true;
  }

  const backlinksMatch = /^\/api\/entries\/(\d+)\/backlinks$/.exec(pathname);
  if (backlinksMatch && request.method() === 'GET') {
    const backlinks = getMockBacklinks(state, Number(backlinksMatch[1]));
    await fulfillJson(
      route,
      backlinks ?? { message: 'Entry not found', statusCode: 404 },
      { status: backlinks ? 200 : 404 },
    );
    return true;
  }

  const historyMatch = /^\/api\/entries\/(\d+)\/history$/.exec(pathname);
  if (historyMatch) {
    const entryId = Number(historyMatch[1]);
    await fulfillJson(route, (state.revisions[entryId] || []).map(toRevisionResponse));
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
