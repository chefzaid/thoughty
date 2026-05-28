import type { Page, Request, Route } from '@playwright/test';

import {
  buildExportBody,
  buildStats,
  DEFAULT_FORMAT_CONFIG,
  parseImportedEntries,
  sortEntries,
  unique,
  type MockAppState,
  type MockEntry,
} from './mockApp.shared';

type RouteContext = {
  route: Route;
  request: Request;
  url: URL;
  pathname: string;
  searchParams: URLSearchParams;
  state: MockAppState;
};

function fulfillJson(
  route: Route,
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {},
) {
  return route.fulfill({
    status: options.status ?? 200,
    contentType: 'application/json',
    headers: options.headers,
    body: JSON.stringify(body),
  });
}

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

function sortStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function getFilteredEntries(
  state: MockAppState,
  searchParams: URLSearchParams,
): { filtered: MockEntry[]; pageNumber: number; limit: number } {
  let filtered = sortEntries(state.entries);
  const search = searchParams.get('search') || '';
  const tags = (searchParams.get('tags') || '').split(',').filter(Boolean);
  const date = searchParams.get('date') || '';
  const visibility = searchParams.get('visibility') || '';
  const favorites = searchParams.get('favorites') === 'true';
  const diaryId = searchParams.get('diaryId');
  const pageNumber = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '10');

  if (search) {
    filtered = filtered.filter((entry) => entry.content.toLowerCase().includes(search.toLowerCase()));
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
  if (diaryId) {
    filtered = filtered.filter((entry) => String(entry.diaryId ?? 1) === diaryId);
  }

  return { filtered, pageNumber, limit };
}

async function handleEntriesCollectionRoute({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/entries' && request.method() === 'GET') {
    const { filtered, pageNumber, limit } = getFilteredEntries(state, searchParams);
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const startIndex = (pageNumber - 1) * limit;
    const pagedEntries = filtered.slice(startIndex, startIndex + limit);

    await fulfillJson(route, {
      entries: pagedEntries,
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

async function handleEntryMutationRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const updateMatch = /^\/api\/entries\/(\d+)$/.exec(pathname);
  if (updateMatch && request.method() === 'PUT') {
    const entryId = Number(updateMatch[1]);
    const payload = request.postDataJSON() as {
      text: string;
      tags: string[];
      date: string;
      visibility: 'public' | 'private';
      format?: 'plain' | 'markdown';
    };

    state.entries = state.entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            content: payload.text,
            tags: resolveTags(state, payload.tags),
            date: payload.date,
            visibility: payload.visibility,
            format: payload.format || 'plain',
          }
        : entry,
    );
    state.entries = sortEntries(state.entries);

    await fulfillJson(route, { success: true });
    return true;
  }

  if (updateMatch && request.method() === 'DELETE') {
    const entryId = Number(updateMatch[1]);
    state.entries = state.entries.filter((entry) => entry.id !== entryId);
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

  const historyMatch = /^\/api\/entries\/(\d+)\/history$/.exec(pathname);
  if (historyMatch) {
    await fulfillJson(route, []);
    return true;
  }

  return false;
}

async function handleAuthRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/auth/register') {
    const payload = request.postDataJSON() as {
      email?: string;
      username?: string;
    };
    state.lastRegisterPayload = payload;
    state.authenticated = true;
    state.user = {
      id: 1,
      username: payload.username || 'NewUser',
      email: payload.email || 'new@example.com',
      fullName: payload.username || 'NewUser',
    };

    await fulfillJson(route, {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: state.user,
    });
    return true;
  }

  if (pathname === '/api/auth/login') {
    state.lastLoginPayload = request.postDataJSON();
    state.authenticated = true;

    await fulfillJson(route, {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: state.user,
    });
    return true;
  }

  if (pathname === '/api/auth/me') {
    if (!state.authenticated) {
      await fulfillJson(route, { error: 'Unauthorized' }, { status: 401 });
      return true;
    }

    await fulfillJson(route, state.user);
    return true;
  }

  return false;
}

async function handleConfigRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/config') {
    if (request.method() === 'POST') {
      state.config = {
        ...state.config,
        ...(request.postDataJSON() as Record<string, unknown>),
      };
    }

    await fulfillJson(route, state.config);
    return true;
  }

  if (pathname === '/api/config/profile-stats') {
    const years = state.entries.map((entry) => Number(entry.date.slice(0, 4)));

    await fulfillJson(route, {
      totalEntries: state.entries.length,
      uniqueTags: unique(state.entries.flatMap((entry) => entry.tags)).length,
      firstEntryYear: years.length > 0 ? Math.min(...years) : 2024,
    });
    return true;
  }

  return false;
}

async function handleReferenceRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/stats') {
    const diaryId = searchParams.get('diaryId');
    const filteredEntries = diaryId
      ? state.entries.filter((entry) => String(entry.diaryId ?? 1) === diaryId)
      : state.entries;

    await fulfillJson(route, buildStats(filteredEntries));
    return true;
  }

  if (pathname === '/api/ai/suggest-tags') {
    state.lastAiSuggestionPayload = request.postDataJSON();
    await fulfillJson(route, { tags: ['focus', 'reflection', 'writing'] });
    return true;
  }

  if (pathname === '/api/diaries') {
    await fulfillJson(route, state.diaries);
    return true;
  }

  if (pathname === '/api/entries/dates') {
    await fulfillJson(route, { dates: sortStrings(unique(state.entries.map((entry) => entry.date))) });
    return true;
  }

  if (pathname === '/api/entries/first') {
    const years = unique(state.entries.map((entry) => Number(entry.date.slice(0, 4)))).sort(
      (left, right) => left - right,
    );
    const months = sortStrings(unique(state.entries.map((entry) => entry.date.slice(5, 7))));

    await fulfillJson(route, { years, months });
    return true;
  }

  if (pathname === '/api/entries/by-date') {
    const limit = Number(searchParams.get('limit') || '10');
    const entryId = Number(searchParams.get('id') || '0');
    const date = searchParams.get('date');
    const entryIndex = Number(searchParams.get('index') || '0');
    const sortedEntries = sortEntries(state.entries);
    const matchedEntry =
      entryId > 0
        ? sortedEntries.find((entry) => entry.id === entryId)
        : sortedEntries.find((entry) => entry.date === date && entry.index === entryIndex);

    if (!matchedEntry) {
      await fulfillJson(route, { found: false });
      return true;
    }

    const entryPosition = sortedEntries.findIndex((entry) => entry.id === matchedEntry.id);
    const page = entryPosition >= 0 ? Math.floor(entryPosition / Math.max(limit, 1)) + 1 : 1;

    await fulfillJson(route, { found: true, page, entryId: matchedEntry.id });
    return true;
  }

  if (pathname === '/api/highlights') {
    await fulfillJson(route, { random: null, onThisDay: [] });
    return true;
  }

  return false;
}

async function handleIoRoutes({ route, request, url, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/io/format') {
    await fulfillJson(route, DEFAULT_FORMAT_CONFIG);
    return true;
  }

  if (pathname === '/api/io/preview') {
    const payload = request.postDataJSON() as { content: string };
    state.lastPreviewPayload = payload;
    const importedEntries = parseImportedEntries(payload.content);

    await fulfillJson(route, {
      totalCount: importedEntries.length,
      duplicateCount: 0,
    });
    return true;
  }

  if (pathname === '/api/io/import') {
    const payload = request.postDataJSON() as { content: string; diaryId?: number | null };
    state.lastImportPayload = payload;
    const importedEntries = parseImportedEntries(payload.content);

    for (const imported of importedEntries) {
      const sameDayEntries = state.entries.filter((entry) => entry.date === imported.date);
      state.entries.push({
        id: state.nextEntryId++,
        date: imported.date,
        index: sameDayEntries.length + 1,
        content: imported.content,
        tags: imported.tags,
        visibility: imported.visibility || 'private',
        format: imported.format || 'plain',
        diaryId: payload.diaryId ?? 1,
      });
    }

    state.entries = sortEntries(state.entries);

    await fulfillJson(route, {
      importedCount: importedEntries.length,
      skippedCount: 0,
      totalProcessed: importedEntries.length,
    });
    return true;
  }

  if (pathname === '/api/io/export') {
    state.lastExportRequestUrl = url;
    const { body, contentType, extension } = buildExportBody(
      state.entries,
      searchParams.get('format'),
    );

    await route.fulfill({
      status: 200,
      contentType,
      headers: {
        'Content-Disposition': `attachment; filename="thoughty_export_2026-04-18.${extension}"`,
      },
      body,
    });
    return true;
  }

  return false;
}

async function handleEntriesRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (await handleEntriesCollectionRoute({ route, request, pathname, searchParams, state })) {
    return true;
  }

  if (await handleEntryMutationRoutes({ route, request, pathname, searchParams, state })) {
    return true;
  }

  return false;
}

export async function registerMockAppRoutes(page: Page, state: MockAppState) {
  await page.route('http://localhost:5173/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const context: RouteContext = {
      route,
      request,
      url,
      pathname: url.pathname,
      searchParams: url.searchParams,
      state,
    };

    if (await handleAuthRoutes(context)) {
      return;
    }
    if (await handleConfigRoutes(context)) {
      return;
    }
    if (await handleReferenceRoutes(context)) {
      return;
    }
    if (await handleIoRoutes(context)) {
      return;
    }
    if (await handleEntriesRoutes(context)) {
      return;
    }

    await fulfillJson(route, { success: true });
  });
}