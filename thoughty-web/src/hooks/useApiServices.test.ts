import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from './hookTestUtils';
import { useApiServices } from './useApiServices';

const mockAuthFetch = vi.fn();
const mockGetAccessToken = vi.fn(() => 'test-token');

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
    getAccessToken: mockGetAccessToken,
  }),
}));

vi.mock('../services/api', () => ({
  createAuthFetch: vi.fn((authFetch) => authFetch),
  createConfigService: vi.fn(() => ({
    fetchConfig: vi.fn(),
    fetchFeatureFlags: vi.fn(),
    fetchProfileStats: vi.fn(),
    updateConfig: vi.fn(),
    downloadUserData: vi.fn(),
  })),
  createEntriesService: vi.fn(() => ({ fetchEntries: vi.fn(), fetchEntryDates: vi.fn(), fetchYearsMonths: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn(), deleteEntry: vi.fn(), toggleVisibility: vi.fn(), bulkOperation: vi.fn(), navigateToFirst: vi.fn(), navigateByDate: vi.fn(), navigateById: vi.fn(), toggleFavorite: vi.fn(), toggleArchived: vi.fn(), togglePinned: vi.fn(), fetchEntryHistory: vi.fn(), fetchEntryBacklinks: vi.fn() })),
  createDiariesService: vi.fn(() => ({ fetchDiaries: vi.fn(), createDiary: vi.fn(), updateDiary: vi.fn(), deleteDiary: vi.fn(), setDefaultDiary: vi.fn(), reorderDiaries: vi.fn() })),
  createAttachmentsService: vi.fn(() => ({ uploadAttachment: vi.fn(), getAttachmentsByEntry: vi.fn(), linkAttachment: vi.fn(), deleteAttachment: vi.fn(), getAttachmentUrl: vi.fn() })),
  createAiService: vi.fn(() => ({ suggestTags: vi.fn(), fixWriting: vi.fn() })),
  createCloudSyncService: vi.fn(() => ({ getStatus: vi.fn(), getAuthUrl: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), listFiles: vi.fn(), uploadExport: vi.fn(), downloadFile: vi.fn(), getSchedules: vi.fn(), setSchedule: vi.fn(), deleteSchedule: vi.fn(), triggerSync: vi.fn() })),
}));

describe('useApiServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns api services', () => {
    const { result } = renderHook(() => useApiServices());

    expect(result.current.authFetchHelper).toBeDefined();
    expect(result.current.configService).toBeDefined();
    expect(result.current.entriesService).toBeDefined();
    expect(result.current.diariesService).toBeDefined();
    expect(result.current.attachmentsService).toBeDefined();
    expect(result.current.aiService).toBeDefined();
    expect(result.current.cloudSyncService).toBeDefined();
  });

  it('memoizes services correctly', () => {
    const { result, rerender } = renderHook(() => useApiServices());

    const firstConfigService = result.current.configService;
    rerender();
    expect(result.current.configService).toBe(firstConfigService);
  });
});
