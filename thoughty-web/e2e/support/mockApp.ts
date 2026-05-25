import type { Page } from '@playwright/test';

type AuthPayload = {
  email?: string;
  password?: string;
  username?: string;
  identifier?: string;
};

export interface MockEntry {
  id: number;
  date: string;
  index: number;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  is_favorite?: boolean;
  format?: 'plain' | 'markdown';
  diaryId?: number | null;
}

interface SetupMockAppOptions {
  startAuthenticated?: boolean;
  initialEntries?: MockEntry[];
}

interface MockAppState {
  authenticated: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    fullName?: string;
  };
  config: {
    theme: 'light' | 'dark';
    language: 'en' | 'fr';
    entriesPerPage: number;
    autoTagMaxTags?: string | number;
    name?: string;
  };
  diaries: Array<{ id: number; name: string; icon: string; is_default: boolean }>;
  entries: MockEntry[];
  nextEntryId: number;
  lastLoginPayload: AuthPayload | null;
  lastRegisterPayload: AuthPayload | null;
  lastPreviewPayload: unknown;
  lastImportPayload: unknown;
  lastExportRequestUrl: URL | null;
  lastAiSuggestionPayload: unknown;
}

const DEFAULT_FORMAT_CONFIG = {
  entrySeparator: '--------------------------------------------------------------------------------',
  sameDaySeparator: '********************************************************************************',
  datePrefix: '---',
  dateSuffix: '--',
  dateFormat: 'YYYY-MM-DD',
  tagOpenBracket: '[',
  tagCloseBracket: ']',
  tagSeparator: ',',
};

const DEFAULT_DIARIES = [
  { id: 1, name: 'Work', icon: '💼', is_default: true },
  { id: 2, name: 'Personal', icon: '🏠', is_default: false },
];

function sortEntries(entries: MockEntry[]): MockEntry[] {
  return [...entries].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    return left.index - right.index;
  });
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function parseImportedEntries(content: string): Array<Partial<MockEntry> & { date: string; content: string; tags: string[] }> {
  try {
    const parsed = JSON.parse(content) as { entries?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];
    return entries
      .filter((entry) => typeof entry.date === 'string' && typeof entry.content === 'string')
      .map((entry) => ({
        date: entry.date as string,
        content: entry.content as string,
        tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        visibility: entry.visibility === 'public' ? 'public' : 'private',
        format: entry.format === 'markdown' ? 'markdown' : 'plain',
      }));
  } catch {
    return [];
  }
}

function buildExportBody(entries: MockEntry[], format: string | null): { contentType: string; body: string; extension: string } {
  if (format === 'json') {
    return {
      contentType: 'application/json',
      extension: 'json',
      body: JSON.stringify({
        entries: entries.map((entry) => ({
          date: entry.date,
          index: entry.index,
          tags: entry.tags,
          content: entry.content,
          visibility: entry.visibility,
          format: entry.format || 'plain',
        })),
      }),
    };
  }

  return {
    contentType: 'text/plain; charset=utf-8',
    extension: 'txt',
    body: entries
      .map((entry) => `---${entry.date}--[${entry.tags.join(',')}]\n${entry.content}\n\n--------------------------------------------------------------------------------\n`)
      .join('\n'),
  };
}

function buildStats(entries: MockEntry[]) {
  const thoughtsPerYear: Record<string, number> = {};
  const thoughtsPerMonth: Record<string, number> = {};
  const thoughtsPerTag: Record<string, number> = {};
  const tagsPerYear: Record<string, Record<string, number>> = {};

  for (const entry of entries) {
    const year = entry.date.slice(0, 4);
    const month = entry.date.slice(0, 7);

    thoughtsPerYear[year] = (thoughtsPerYear[year] || 0) + 1;
    thoughtsPerMonth[month] = (thoughtsPerMonth[month] || 0) + 1;
    tagsPerYear[year] ||= {};

    for (const tag of entry.tags) {
      thoughtsPerTag[tag] = (thoughtsPerTag[tag] || 0) + 1;
      tagsPerYear[year][tag] = (tagsPerYear[year][tag] || 0) + 1;
    }
  }

  return {
    totalThoughts: entries.length,
    uniqueTagsCount: Object.keys(thoughtsPerTag).length,
    thoughtsPerYear,
    thoughtsPerMonth,
    thoughtsPerTag,
    tagsPerYear,
  };
}

export async function setupMockApp(page: Page, options: SetupMockAppOptions = {}) {
  const state: MockAppState = {
    authenticated: options.startAuthenticated ?? false,
    user: {
      id: 1,
      username: 'TestUser',
      email: 'test@example.com',
      fullName: 'Test User',
    },
    config: {
      theme: 'dark',
      language: 'en',
      entriesPerPage: 10,
      autoTagMaxTags: '0',
    },
    diaries: DEFAULT_DIARIES,
    entries: sortEntries(options.initialEntries || []),
    nextEntryId: (options.initialEntries?.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) || 0) + 1,
    lastLoginPayload: null,
    lastRegisterPayload: null,
    lastPreviewPayload: null,
    lastImportPayload: null,
    lastExportRequestUrl: null,
    lastAiSuggestionPayload: null,
  };

  await page.addInitScript((authenticated: boolean) => {
    if (authenticated) {
      localStorage.setItem('accessToken', 'test-access-token');
      localStorage.setItem('refreshToken', 'test-refresh-token');
      return;
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, state.authenticated);

  await page.route('http://localhost:5173/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname, searchParams } = url;

    if (pathname === '/api/auth/register') {
      const payload = request.postDataJSON() as AuthPayload;
      state.lastRegisterPayload = payload;
      state.authenticated = true;
      state.user = {
        id: 1,
        username: payload.username || 'NewUser',
        email: payload.email || 'new@example.com',
        fullName: payload.username || 'NewUser',
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          user: state.user,
        }),
      });
      return;
    }

    if (pathname === '/api/auth/login') {
      const payload = request.postDataJSON() as AuthPayload;
      state.lastLoginPayload = payload;
      state.authenticated = true;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          user: state.user,
        }),
      });
      return;
    }

    if (pathname === '/api/auth/me') {
      if (!state.authenticated) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.user),
      });
      return;
    }

    if (pathname === '/api/config') {
      if (request.method() === 'POST') {
        state.config = {
          ...state.config,
          ...(request.postDataJSON() as Record<string, unknown>),
        } as MockAppState['config'];
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.config),
      });
      return;
    }

    if (pathname === '/api/config/profile-stats') {
      const years = state.entries.map((entry) => Number(entry.date.slice(0, 4)));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalEntries: state.entries.length,
          uniqueTags: unique(state.entries.flatMap((entry) => entry.tags)).length,
          firstEntryYear: years.length > 0 ? Math.min(...years) : 2024,
        }),
      });
      return;
    }

    if (pathname === '/api/stats') {
      const diaryId = searchParams.get('diaryId');
      const filteredEntries = diaryId
        ? state.entries.filter((entry) => String(entry.diaryId ?? 1) === diaryId)
        : state.entries;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildStats(filteredEntries)),
      });
      return;
    }

    if (pathname === '/api/ai/suggest-tags') {
      state.lastAiSuggestionPayload = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tags: ['focus', 'reflection', 'writing'] }),
      });
      return;
    }

    if (pathname === '/api/diaries') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.diaries),
      });
      return;
    }

    if (pathname === '/api/entries/dates') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dates: unique(state.entries.map((entry) => entry.date)).sort() }),
      });
      return;
    }

    if (pathname === '/api/entries/first') {
      const years = unique(state.entries.map((entry) => Number(entry.date.slice(0, 4)))).sort((a, b) => a - b);
      const months = unique(state.entries.map((entry) => entry.date.slice(5, 7))).sort();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ years, months }),
      });
      return;
    }

    if (pathname === '/api/entries/by-date') {
      const limit = Number(searchParams.get('limit') || '10');
      const entryId = Number(searchParams.get('id') || '0');
      const date = searchParams.get('date');
      const entryIndex = Number(searchParams.get('index') || '0');
      const sortedEntries = sortEntries(state.entries);
      const matchedEntry = entryId > 0
        ? sortedEntries.find((entry) => entry.id === entryId)
        : sortedEntries.find((entry) => entry.date === date && entry.index === entryIndex);

      if (!matchedEntry) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ found: false }),
        });
        return;
      }

      const entryPosition = sortedEntries.findIndex((entry) => entry.id === matchedEntry.id);
      const page = entryPosition >= 0 ? Math.floor(entryPosition / Math.max(limit, 1)) + 1 : 1;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ found: true, page, entryId: matchedEntry.id }),
      });
      return;
    }

    if (pathname === '/api/highlights') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ random: null, onThisDay: [] }),
      });
      return;
    }

    if (pathname === '/api/io/format') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DEFAULT_FORMAT_CONFIG),
      });
      return;
    }

    if (pathname === '/api/io/preview') {
      const payload = request.postDataJSON() as { content: string };
      state.lastPreviewPayload = payload;
      const importedEntries = parseImportedEntries(payload.content);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalCount: importedEntries.length, duplicateCount: 0 }),
      });
      return;
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

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ importedCount: importedEntries.length, skippedCount: 0, totalProcessed: importedEntries.length }),
      });
      return;
    }

    if (pathname === '/api/io/export') {
      state.lastExportRequestUrl = url;
      const { body, contentType, extension } = buildExportBody(state.entries, searchParams.get('format'));
      await route.fulfill({
        status: 200,
        contentType,
        headers: {
          'Content-Disposition': `attachment; filename="thoughty_export_2026-04-18.${extension}"`,
        },
        body,
      });
      return;
    }

    if (pathname === '/api/entries' && request.method() === 'GET') {
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

      const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
      const startIndex = (pageNumber - 1) * limit;
      const pagedEntries = filtered.slice(startIndex, startIndex + limit);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: pagedEntries,
          total: filtered.length,
          page: pageNumber,
          totalPages,
          allTags: unique(state.entries.flatMap((entry) => entry.tags)).sort(),
        }),
      });
      return;
    }

    if (pathname === '/api/entries' && request.method() === 'POST') {
      const payload = request.postDataJSON() as {
        text: string;
        tags: string[];
        date: string;
        visibility?: 'public' | 'private' | null;
        format?: 'plain' | 'markdown';
        diaryId?: number | null;
      };
      const autoTagLimit = Number.parseInt(String(state.config.autoTagMaxTags ?? '0'), 10);
      const resolvedTags = payload.tags.length === 0 && autoTagLimit > 0
        ? ['focus', 'reflection'].slice(0, autoTagLimit)
        : payload.tags;
      const sameDayEntries = state.entries.filter((entry) => entry.date === payload.date);
      const newEntry: MockEntry = {
        id: state.nextEntryId++,
        date: payload.date,
        index: sameDayEntries.length + 1,
        content: payload.text,
        tags: resolvedTags,
        visibility: payload.visibility || 'private',
        format: payload.format || 'plain',
        diaryId: payload.diaryId ?? 1,
      };
      state.entries.push(newEntry);
      state.entries = sortEntries(state.entries);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, entryId: newEntry.id }),
      });
      return;
    }

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
      const autoTagLimit = Number.parseInt(String(state.config.autoTagMaxTags ?? '0'), 10);
      const resolvedTags = payload.tags.length === 0 && autoTagLimit > 0
        ? ['focus', 'reflection'].slice(0, autoTagLimit)
        : payload.tags;

      state.entries = state.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              content: payload.text,
              tags: resolvedTags,
              date: payload.date,
              visibility: payload.visibility,
              format: payload.format || 'plain',
            }
          : entry,
      );
      state.entries = sortEntries(state.entries);

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }

    if (updateMatch && request.method() === 'DELETE') {
      const entryId = Number(updateMatch[1]);
      state.entries = state.entries.filter((entry) => entry.id !== entryId);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }

    const toggleFavoriteMatch = /^\/api\/entries\/(\d+)\/favorite$/.exec(pathname);
    if (toggleFavoriteMatch && request.method() === 'PATCH') {
      const entryId = Number(toggleFavoriteMatch[1]);
      const payload = request.postDataJSON() as { isFavorite: boolean };
      state.entries = state.entries.map((entry) =>
        entry.id === entryId ? { ...entry, is_favorite: payload.isFavorite } : entry,
      );
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }

    const toggleVisibilityMatch = /^\/api\/entries\/(\d+)\/visibility$/.exec(pathname);
    if (toggleVisibilityMatch && request.method() === 'PATCH') {
      const entryId = Number(toggleVisibilityMatch[1]);
      const payload = request.postDataJSON() as { visibility: 'public' | 'private' };
      state.entries = state.entries.map((entry) =>
        entry.id === entryId ? { ...entry, visibility: payload.visibility } : entry,
      );
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }

    const historyMatch = /^\/api\/entries\/(\d+)\/history$/.exec(pathname);
    if (historyMatch) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  return {
    state,
  };
}