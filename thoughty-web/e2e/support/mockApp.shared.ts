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

export interface SetupMockAppOptions {
  startAuthenticated?: boolean;
  initialEntries?: MockEntry[];
}

export interface MockAppState {
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

export const DEFAULT_FORMAT_CONFIG = {
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

export function sortEntries(entries: MockEntry[]): MockEntry[] {
  return [...entries].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    return left.index - right.index;
  });
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function parseImportedEntries(
  content: string,
): Array<Partial<MockEntry> & { date: string; content: string; tags: string[] }> {
  try {
    const parsed = JSON.parse(content) as
      | { entries?: Array<Record<string, unknown>> }
      | Array<Record<string, unknown>>;
    const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];

    return entries
      .filter(
        (entry): entry is Record<string, unknown> & { date: string; content: string } =>
          typeof entry.date === 'string' && typeof entry.content === 'string',
      )
      .map((entry) => ({
        date: entry.date,
        content: entry.content,
        tags: Array.isArray(entry.tags)
          ? entry.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        visibility: entry.visibility === 'public' ? 'public' : 'private',
        format: entry.format === 'markdown' ? 'markdown' : 'plain',
      }));
  } catch {
    return [];
  }
}

export function buildExportBody(
  entries: MockEntry[],
  format: string | null,
): { contentType: string; body: string; extension: string } {
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
      .map(
        (entry) =>
          `---${entry.date}--[${entry.tags.join(',')}]\n${entry.content}\n\n--------------------------------------------------------------------------------\n`,
      )
      .join('\n'),
  };
}

export function buildStats(entries: MockEntry[]) {
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

export function createMockAppState(options: SetupMockAppOptions = {}): MockAppState {
  return {
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
    nextEntryId:
      (options.initialEntries?.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) || 0) +
      1,
    lastLoginPayload: null,
    lastRegisterPayload: null,
    lastPreviewPayload: null,
    lastImportPayload: null,
    lastExportRequestUrl: null,
    lastAiSuggestionPayload: null,
  };
}