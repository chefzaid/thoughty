type AuthPayload = {
  email?: string;
  password?: string;
  username?: string;
  identifier?: string;
};

export type MockCloudProvider = 'google_drive' | 'onedrive' | 'dropbox';

export interface MockCloudProviderStatus {
  connected: boolean;
  connectedAt?: string;
}

export interface MockCloudSchedule {
  enabled: boolean;
  frequency?: 'every_6h' | 'every_12h' | 'daily' | 'weekly';
  format?: 'txt' | 'json' | 'md';
  diaryId?: number;
  includeVisibility?: boolean;
  lastSyncAt?: string;
  lastSyncHash?: string;
  nextSyncAt?: string;
}

export interface MockCloudFile {
  id: string;
  provider: MockCloudProvider;
  name: string;
  size: number;
  modifiedAt: string;
  content?: string;
}

export interface MockEntry {
  id: number;
  date: string;
  index: number;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  is_favorite?: boolean;
  is_archived?: boolean;
  format?: 'plain' | 'markdown';
  diaryId?: number | null;
}

export interface MockEntryRevision {
  id: number;
  entryId: number;
  content: string;
  tags: string[];
  date: string;
  format: 'plain' | 'markdown';
  visibility: 'public' | 'private';
  createdAt: string;
}

export interface SetupMockAppOptions {
  startAuthenticated?: boolean;
  initialEntries?: MockEntry[];
  initialRevisions?: Record<number, MockEntryRevision[]>;
  config?: Partial<MockAppState['config']>;
  diaries?: MockAppState['diaries'];
  cloudStatus?: MockAppState['cloudStatus'];
  cloudSchedules?: MockAppState['cloudSchedules'];
  cloudFiles?: MockCloudFile[];
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
    bio?: string;
    email?: string;
    fontFamily?: 'system' | 'serif' | 'modern' | 'mono';
    fontSize?: string | number;
    fontColor?: string;
    readDates?: boolean;
    ttsVoiceUri?: string;
    openRouterModel?: string;
  };
  diaries: Array<{
    id: number;
    name: string;
    icon: string;
    is_default: boolean;
    visibility: 'public' | 'private';
    color?: string | null;
  }>;
  entries: MockEntry[];
  revisions: Record<number, MockEntryRevision[]>;
  cloudStatus: Record<MockCloudProvider, MockCloudProviderStatus>;
  cloudSchedules: Partial<Record<MockCloudProvider, MockCloudSchedule>>;
  cloudFiles: MockCloudFile[];
  nextEntryId: number;
  lastLoginPayload: AuthPayload | null;
  lastRegisterPayload: AuthPayload | null;
  lastPreviewPayload: unknown;
  lastImportPayload: unknown;
  lastFormatPayload: unknown;
  lastDeleteAllRequestUrl: URL | null;
  lastExportRequestUrl: URL | null;
  lastAiSuggestionPayload: unknown;
  lastAiFixPayload: unknown;
  lastAiChatPayload: unknown;
  lastBulkPayload: unknown;
  lastReorderPayload: unknown;
  lastCloudFilesRequestUrl: URL | null;
  lastCloudUploadPayload: unknown;
  lastCloudDownloadPayload: unknown;
  lastCloudSchedulePayload: unknown;
  lastCloudSyncPayload: unknown;
  lastCloudDeleteScheduleProvider: string | null;
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
  { id: 1, name: 'Work', icon: '💼', is_default: true, visibility: 'private' as const, color: '#3B82F6' },
  { id: 2, name: 'Personal', icon: '🏠', is_default: false, visibility: 'private' as const, color: '#A855F7' },
];

const DEFAULT_CLOUD_STATUS: Record<MockCloudProvider, MockCloudProviderStatus> = {
  google_drive: { connected: true, connectedAt: '2026-04-18T10:00:00.000Z' },
  onedrive: { connected: false },
  dropbox: { connected: false },
};

const DEFAULT_CLOUD_SCHEDULES: Partial<Record<MockCloudProvider, MockCloudSchedule>> = {
  google_drive: {
    enabled: true,
    frequency: 'daily',
    format: 'json',
    includeVisibility: true,
    lastSyncAt: '2026-04-18T10:00:00.000Z',
    nextSyncAt: '2026-04-19T10:00:00.000Z',
  },
};

const DEFAULT_CLOUD_FILES: MockCloudFile[] = [
  {
    id: 'cloud-file-1',
    provider: 'google_drive',
    name: 'thoughty-cloud.json',
    size: 512,
    modifiedAt: '2026-04-18T10:00:00.000Z',
    content: JSON.stringify({
      entries: [
        {
          date: '2024-04-22',
          content: 'Cloud restored entry',
          tags: ['cloud'],
          visibility: 'private',
        },
      ],
    }),
  },
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
  const thoughtsPerDay: Record<string, number> = {};
  const thoughtsPerTag: Record<string, number> = {};
  const tagsPerYear: Record<string, Record<string, number>> = {};

  for (const entry of entries) {
    const year = entry.date.slice(0, 4);
    const month = entry.date.slice(0, 7);

    thoughtsPerYear[year] = (thoughtsPerYear[year] || 0) + 1;
    thoughtsPerMonth[month] = (thoughtsPerMonth[month] || 0) + 1;
    thoughtsPerDay[entry.date] = (thoughtsPerDay[entry.date] || 0) + 1;
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
    thoughtsPerDay,
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
      readDates: true,
      ...options.config,
    },
    diaries: options.diaries || DEFAULT_DIARIES,
    entries: sortEntries(options.initialEntries || []),
    revisions: options.initialRevisions || {},
    cloudStatus: options.cloudStatus || DEFAULT_CLOUD_STATUS,
    cloudSchedules: options.cloudSchedules || DEFAULT_CLOUD_SCHEDULES,
    cloudFiles: options.cloudFiles || DEFAULT_CLOUD_FILES,
    nextEntryId:
      (options.initialEntries?.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) || 0) +
      1,
    lastLoginPayload: null,
    lastRegisterPayload: null,
    lastPreviewPayload: null,
    lastImportPayload: null,
    lastFormatPayload: null,
    lastDeleteAllRequestUrl: null,
    lastExportRequestUrl: null,
    lastAiSuggestionPayload: null,
    lastAiFixPayload: null,
    lastAiChatPayload: null,
    lastBulkPayload: null,
    lastReorderPayload: null,
    lastCloudFilesRequestUrl: null,
    lastCloudUploadPayload: null,
    lastCloudDownloadPayload: null,
    lastCloudSchedulePayload: null,
    lastCloudSyncPayload: null,
    lastCloudDeleteScheduleProvider: null,
  };
}