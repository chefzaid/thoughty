/**
 * Shared setup for the `useEntryActions` specs. Each spec mocks its modules from here:
 *
 *   vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
 *   vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());
 */
import { vi } from "vitest";
import { getTranslation } from "../utils/translations";

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
    bulkOperation: vi.fn(),
    navigateToFirst: vi.fn(),
    navigateByDate: vi.fn(),
    navigateById: vi.fn(),
    toggleFavorite: vi.fn(),
    toggleArchived: vi.fn(),
    togglePinned: vi.fn(),
    unsealEntry: vi.fn(),
    setEntryTask: vi.fn(),
    fetchEntryHistory: vi.fn(),
    fetchEntryBacklinks: vi.fn(),
    deleteRevision: vi.fn(),
    reorderEntries: vi.fn(),
    renameTag: vi.fn(),
    fetchTagUsage: vi.fn(),
    deleteTag: vi.fn(),
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
    summarizeEntry: vi.fn(),
    getInspiration: vi.fn(),
    findDuplicateEntries: vi.fn(),
    semanticSearch: vi.fn(),
    chat: vi.fn(),
    getChatHistory: vi.fn(),
    fetchModels: vi.fn(),
    getCredentialStatus: vi.fn(),
    updateCredential: vi.fn(),
    removeCredential: vi.fn(),
    getUsageDashboard: vi.fn(),
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

export const mockNotify = vi.fn();
export const notifier = {
  notify: mockNotify,
  t: (key: string, params?: Record<string, string | number>) => getTranslation("en", key, params),
  language: "en" as const,
};

/** Makes `createEntriesService` return a bare mock with the given methods replaced. */
export const createEntriesServiceMock = async (
  overrides: Record<string, unknown> = {},
) => {
  const { createEntriesService } = await import("../services/api");
  vi.mocked(createEntriesService).mockReturnValue({
    fetchEntries: vi.fn(),
    fetchEntryDates: vi.fn(),
    fetchYearsMonths: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    toggleVisibility: vi.fn(),
    bulkOperation: vi.fn(),
    toggleFavorite: vi.fn(),
    toggleArchived: vi.fn(),
    togglePinned: vi.fn(),
    unsealEntry: vi.fn(),
    setEntryTask: vi.fn(),
    navigateToFirst: vi.fn(),
    navigateByDate: vi.fn(),
    navigateById: vi.fn(),
    fetchEntryHistory: vi.fn(),
    fetchEntryBacklinks: vi.fn(),
    deleteRevision: vi.fn(),
    reorderEntries: vi.fn(),
    renameTag: vi.fn(),
    fetchTagUsage: vi.fn(),
    deleteTag: vi.fn(),
    ...overrides,
  });
};

/** Makes `createAiService` return a bare mock with the given methods replaced. */
export const createAiServiceMock = async (overrides: Record<string, unknown> = {}) => {
  const { createAiService } = await import("../services/api");
  vi.mocked(createAiService).mockReturnValue({
    suggestTags: vi.fn(),
    fixWriting: vi.fn(),
    summarizeEntry: vi.fn(),
    getInspiration: vi.fn(),
    findDuplicateEntries: vi.fn(),
    semanticSearch: vi.fn(),
    chat: vi.fn(),
    getChatHistory: vi.fn(),
    fetchModels: vi.fn(),
    getCredentialStatus: vi.fn(),
    updateCredential: vi.fn(),
    removeCredential: vi.fn(),
    getUsageDashboard: vi.fn(),
    previewJournalRetag: vi.fn(),
    applyJournalRetag: vi.fn(),
    ...overrides,
  });
};
