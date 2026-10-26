/**
 * Shared setup for the `useAppState` specs. Each spec mocks its modules from here:
 *
 *   vi.mock("../contexts/AuthContext", async () => (await import("./useAppState.test-helpers")).authContextMock());
 *   vi.mock("../services/api", async () => (await import("./useAppState.test-helpers")).apiModuleMock());
 */
import { vi } from "vitest";
import type { Notifier } from "./useAppNotice";
import { getTranslation, type Language } from "../utils/translations";

export const mockAuthFetch = vi.fn();
export const mockGetAccessToken = vi.fn(() => "test-token");

/** The `../contexts/AuthContext` module as these specs mock it. */
export const authContextMock = () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
    getAccessToken: mockGetAccessToken,
  }),
});

/** The `../services/api` module as these specs mock it: every service method is a bare `vi.fn()`. */
export const apiModuleMock = () => ({
  createAuthFetch: vi.fn((authFetch) => authFetch),
  createConfigService: vi.fn(() => ({
    fetchConfig: vi.fn(),
    fetchFeatureFlags: vi.fn(),
    fetchProfileStats: vi.fn(),
    updateConfig: vi.fn(),
    downloadUserData: vi.fn(),
  })),
  createEntriesService: vi.fn(() => ({
    fetchEntries: vi.fn(),
    fetchEntryDates: vi.fn(),
    fetchYearsMonths: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    toggleVisibility: vi.fn(),
    toggleFavorite: vi.fn(),
    toggleArchived: vi.fn(),
    togglePinned: vi.fn(),
    setEntryTask: vi.fn(),
    bulkOperation: vi.fn(),
    navigateToFirst: vi.fn(),
    navigateByDate: vi.fn(),
    navigateById: vi.fn(),
    fetchEntryHistory: vi.fn(),
    fetchEntryBacklinks: vi.fn(),
    deleteRevision: vi.fn(),
    reorderEntries: vi.fn(),
  })),
  createDiariesService: vi.fn(() => ({
    fetchDiaries: vi.fn(),
    createDiary: vi.fn(),
    updateDiary: vi.fn(),
    deleteDiary: vi.fn(),
    setDefaultDiary: vi.fn(),
    reorderDiaries: vi.fn(),
  })),
  createAttachmentsService: vi.fn(() => ({
    uploadAttachment: vi.fn(),
    linkAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    transcribeAttachment: vi.fn(),
  })),
  createAiService: vi.fn(() => ({
    suggestTags: vi.fn(),
    fixWriting: vi.fn(),
    semanticSearch: vi.fn(),
    previewJournalRetag: vi.fn(),
    applyJournalRetag: vi.fn(),
  })),
  createCloudSyncService: vi.fn(() => ({
    getStatus: vi.fn(),
    getAuthUrl: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    listFiles: vi.fn(),
    uploadExport: vi.fn(),
    downloadFile: vi.fn(),
    getSchedules: vi.fn(),
    setSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    triggerSync: vi.fn(),
  })),
});

/** A notifier whose `notify` is a mock and whose `t` reads the real translations. */
export const createNotifier = (language: Language = "en"): Notifier => ({
  notify: vi.fn(),
  t: (key, params) => getTranslation(language, key, params),
  language,
});

export const notifier = createNotifier();
