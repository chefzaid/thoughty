import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { useEntries } from "./useAppState";
import { renderHook } from "./hookTestUtils";
import { createNotifier, notifier } from "./useAppState.test-helpers";

vi.mock("../contexts/AuthContext", async () => (await import("./useAppState.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useAppState.test-helpers")).apiModuleMock());

describe("useAppState Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.classList.remove(
      "light-mode",
      "dark-mode",
      "high-contrast-mode",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useEntries", () => {
    const mockConfig = { entriesPerPage: 10 };

    it("initializes with default state", () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null, notifier));

      expect(result.current.entries).toEqual([]);
      expect(result.current.groupedEntries).toEqual({});
      expect(result.current.loading).toBe(true);
      expect(result.current.page).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.allTags).toEqual([]);
      expect(result.current.entryDates).toEqual([]);
    });

    it("syncs inputPage with page changes", async () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null, notifier));

      act(() => {
        result.current.setPage(3);
      });

      await waitFor(() => {
        expect(result.current.inputPage).toBe("3");
      });
    });

    it("updates filter and navigation state", () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null, notifier));
      const filterDate = new Date("2024-01-15");

      act(() => {
        result.current.setSearch("query");
        result.current.setFilterTags(["tag1"]);
        result.current.setFilterDateObj(filterDate);
        result.current.setFilterVisibility("public");
        result.current.setTargetEntryId(123);
        result.current.setActiveTargetId(456);
        result.current.setSourceEntry({ id: 1, date: "2024-01-15", index: 1 });
      });

      expect(result.current.search).toBe("query");
      expect(result.current.filterTags).toEqual(["tag1"]);
      expect(result.current.filterDateObj).toEqual(filterDate);
      expect(result.current.filterVisibility).toBe("public");
      expect(result.current.targetEntryId).toBe(123);
      expect(result.current.activeTargetId).toBe(456);
      expect(result.current.sourceEntry).toEqual({
        id: 1,
        date: "2024-01-15",
        index: 1,
      });
    });

    it("groups entries by date and sorts by index", async () => {
      const { createEntriesService } = await import("../services/api");
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn().mockResolvedValue({
          entries: [
            { id: 2, date: "2024-01-15", index: 2, content: "later", tags: [] },
            {
              id: 1,
              date: "2024-01-15T08:00:00Z",
              index: 1,
              content: "earlier",
              tags: [],
            },
            {
              id: 3,
              date: "2024-01-16",
              index: 1,
              content: "next day",
              tags: [],
            },
          ],
          totalPages: 1,
          allTags: [],
        }),
        fetchEntryDates: vi.fn().mockResolvedValue([]),
        fetchYearsMonths: vi.fn().mockResolvedValue({ years: [], months: [] }),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        toggleFavorite: vi.fn(),
        toggleArchived: vi.fn(),
        togglePinned: vi.fn(),
        unsealEntry: vi.fn(),
        setEntryTask: vi.fn(),
        bulkOperation: vi.fn(),
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
      });

      const { result } = renderHook(() => useEntries(true, mockConfig, null, notifier));

      await waitFor(() => {
        expect(result.current.groupedEntries).toEqual({
          "2024-01-15": [
            {
              id: 1,
              date: "2024-01-15T08:00:00Z",
              index: 1,
              content: "earlier",
              tags: [],
            },
            { id: 2, date: "2024-01-15", index: 2, content: "later", tags: [] },
          ],
          "2024-01-16": [
            {
              id: 3,
              date: "2024-01-16",
              index: 1,
              content: "next day",
              tags: [],
            },
          ],
        });
      });
    });

    it("calculates page limit from config", () => {
      const numeric = renderHook(() =>
        useEntries(false, { entriesPerPage: 25 }, null, notifier),
      );
      const stringValue = renderHook(() =>
        useEntries(false, { entriesPerPage: "7" }, null, notifier),
      );
      const fallback = renderHook(() => useEntries(false, {}, null, notifier));

      expect(numeric.result.current.getLimit()).toBe(25);
      expect(stringValue.result.current.getLimit()).toBe(7);
      expect(fallback.result.current.getLimit()).toBe(10);
    });

    it("runs diary-scoped meaning search and filters entries by ranked IDs", async () => {
      const fetchEntries = vi
        .fn()
        .mockResolvedValue({ entries: [], totalPages: 1, allTags: [] });
      const semanticSearch = vi.fn().mockResolvedValue({
        analyzedEntries: 3,
        totalEntries: 3,
        truncated: false,
        matches: [
          { entryId: 9, score: 0.9 },
          { entryId: 3, score: 0.7 },
        ],
      });
      const { createAiService, createEntriesService } =
        await import("../services/api");
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries,
        fetchEntryDates: vi.fn().mockResolvedValue([]),
        fetchYearsMonths: vi.fn().mockResolvedValue({ years: [], months: [] }),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        toggleFavorite: vi.fn(),
        toggleArchived: vi.fn(),
        togglePinned: vi.fn(),
        unsealEntry: vi.fn(),
        setEntryTask: vi.fn(),
        bulkOperation: vi.fn(),
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
      });
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn(),
        fixWriting: vi.fn(),
        summarizeEntry: vi.fn(),
        getInspiration: vi.fn(),
        findDuplicateEntries: vi.fn(),
        semanticSearch,
        chat: vi.fn(),
        getChatHistory: vi.fn(),
        fetchModels: vi.fn(),
        getCredentialStatus: vi.fn(),
        updateCredential: vi.fn(),
        removeCredential: vi.fn(),
        getUsageDashboard: vi.fn(),
        previewJournalRetag: vi.fn(),
        applyJournalRetag: vi.fn(),
      });
      const { result } = renderHook(() => useEntries(true, mockConfig, 4, notifier));

      act(() => {
        result.current.setSearchMode("semantic");
        result.current.setSearch("a difficult career choice");
      });
      await act(async () => {
        await result.current.runSemanticSearch();
      });

      expect(semanticSearch).toHaveBeenCalledWith(
        "a difficult career choice",
        4,
      );
      await waitFor(() => {
        expect(fetchEntries).toHaveBeenCalledWith(
          expect.objectContaining({
            search: "",
            entryIds: [9, 3],
            diaryId: 4,
          }),
        );
      });
      expect(result.current.semanticSearchStatus).toBe("complete");
    });

    it("reorders the current day entries in local state before the API round-trip completes", async () => {
      const reorderEntriesMock = vi.fn().mockResolvedValue(true);
      const { createEntriesService } = await import("../services/api");
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries: vi.fn().mockResolvedValue({
          entries: [
            { id: 1, date: "2024-01-15", index: 1, content: "first", tags: [] },
            {
              id: 2,
              date: "2024-01-15",
              index: 2,
              content: "second",
              tags: [],
            },
            {
              id: 3,
              date: "2024-01-14",
              index: 1,
              content: "other day",
              tags: [],
            },
          ],
          totalPages: 1,
          allTags: [],
        }),
        fetchEntryDates: vi.fn().mockResolvedValue([]),
        fetchYearsMonths: vi.fn().mockResolvedValue({ years: [], months: [] }),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        toggleFavorite: vi.fn(),
        toggleArchived: vi.fn(),
        togglePinned: vi.fn(),
        unsealEntry: vi.fn(),
        setEntryTask: vi.fn(),
        bulkOperation: vi.fn(),
        navigateToFirst: vi.fn(),
        navigateByDate: vi.fn(),
        navigateById: vi.fn(),
        fetchEntryHistory: vi.fn(),
        fetchEntryBacklinks: vi.fn(),
        deleteRevision: vi.fn(),
        reorderEntries: reorderEntriesMock,
        renameTag: vi.fn(),
        fetchTagUsage: vi.fn(),
        deleteTag: vi.fn(),
      });

      const { result } = renderHook(() => useEntries(true, mockConfig, null, notifier));

      await waitFor(() => {
        expect(result.current.entries).toHaveLength(3);
      });

      await act(async () => {
        await result.current.reorderEntries("2024-01-15", [2, 1]);
      });

      expect(reorderEntriesMock).toHaveBeenCalledWith("2024-01-15", [2, 1]);
      await waitFor(() => {
        expect(
          result.current.groupedEntries["2024-01-15"]?.map((entry) => entry.id),
        ).toEqual([2, 1]);
        expect(result.current.entries.map((entry) => entry.id)).toEqual([
          2, 1, 3,
        ]);
      });
    });

    const mockTaskEntriesService = async (
      setEntryTask: (id: number, line: number, checked: boolean) => Promise<{ success: boolean; error?: string }>,
      fetchEntries = vi.fn(),
      overrides: {
        togglePinned?: (id: number, pinned: boolean) => Promise<{ success: boolean; error?: string }>;
        unsealEntry?: (id: number) => Promise<{ success: boolean; error?: string }>;
      } = {},
    ) => {
      fetchEntries.mockResolvedValue({
        entries: [
          { id: 7, date: "2024-01-15", index: 1, content: "- [ ] One\n- [ ] Two", tags: [], format: "markdown" },
        ],
        totalPages: 1,
        allTags: [],
      });
      const { createEntriesService } = await import("../services/api");
      vi.mocked(createEntriesService).mockReturnValue({
        fetchEntries,
        fetchEntryDates: vi.fn().mockResolvedValue([]),
        fetchYearsMonths: vi.fn().mockResolvedValue({ years: [], months: [] }),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        toggleVisibility: vi.fn(),
        toggleFavorite: vi.fn(),
        toggleArchived: vi.fn(),
        togglePinned: vi.fn(),
        unsealEntry: vi.fn(),
        setEntryTask,
        bulkOperation: vi.fn(),
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
      return fetchEntries;
    };

    it("ticks a task at once and sends ticks one after the other, only the last state of a line ticked again", async () => {
      let releaseFirst: (value: { success: boolean }) => void = () => {};
      const setEntryTask = vi.fn()
        .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
        .mockResolvedValue({ success: true });
      const fetchEntries = await mockTaskEntriesService(setEntryTask);

      const { result } = renderHook(() => useEntries(true, mockConfig, null, notifier));
      await waitFor(() => expect(result.current.entries).toHaveLength(1));
      const entry = result.current.entries[0]!;

      act(() => {
        result.current.setEntryTask(entry, 0, true);
        result.current.setEntryTask(entry, 1, true);
        result.current.setEntryTask(entry, 1, false);
        result.current.setEntryTask(entry, 1, true);
      });

      await waitFor(() => expect(result.current.entries[0]?.content).toBe("- [x] One\n- [x] Two"));
      expect(setEntryTask).toHaveBeenCalledTimes(1);
      await act(async () => { releaseFirst({ success: true }); });

      await waitFor(() => expect(setEntryTask).toHaveBeenCalledTimes(2));
      expect(setEntryTask.mock.calls).toEqual([[7, 0, true], [7, 1, true]]);
      expect(fetchEntries).toHaveBeenCalledTimes(1);
      expect(result.current.entries[0]?.content).toBe("- [x] One\n- [x] Two");
    });

    it.each([
      ["en", "That line is no longer a task.", "That line is no longer a task."],
      ["en", "taskUpdateFailed", "Failed to update the task."],
      ["fr", undefined, "Échec de la mise à jour de la tâche."],
    ] as const)("goes back to the saved entry and says why in the notice toast when a tick fails (%s, %s)", async (language, error, expected) => {
      const languageNotifier = createNotifier(language);
      const setEntryTask = vi.fn().mockResolvedValue({ success: false, error });
      const fetchEntries = await mockTaskEntriesService(setEntryTask);

      const { result } = renderHook(() => useEntries(true, { ...mockConfig, language }, null, languageNotifier));
      await waitFor(() => expect(result.current.entries).toHaveLength(1));

      act(() => {
        result.current.setEntryTask(result.current.entries[0]!, 0, true);
      });

      await waitFor(() => expect(languageNotifier.notify).toHaveBeenCalledWith(expected));
      expect(languageNotifier.notify).toHaveBeenCalledTimes(1);
      expect(fetchEntries).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(result.current.entries[0]?.content).toBe("- [ ] One\n- [ ] Two"));
    });

    it.each([
      ["en", "Only five entries can be pinned.", "Only five entries can be pinned."],
      ["en", "pinUpdateFailed", "Failed to update pinned state"],
      ["fr", undefined, "Échec de la mise à jour de l'épinglage"],
    ] as const)("says why in the notice toast when pinning fails (%s, %s)", async (language, error, expected) => {
      const languageNotifier = createNotifier(language);
      const togglePinned = vi.fn().mockResolvedValue({ success: false, error });
      const fetchEntries = await mockTaskEntriesService(vi.fn(), vi.fn(), { togglePinned });

      const { result } = renderHook(() => useEntries(true, { ...mockConfig, language }, null, languageNotifier));
      await waitFor(() => expect(result.current.entries).toHaveLength(1));

      await act(async () => {
        await result.current.togglePinned(result.current.entries[0]!);
      });

      expect(togglePinned).toHaveBeenCalledWith(7, true);
      expect(languageNotifier.notify).toHaveBeenCalledWith(expected);
      expect(fetchEntries).toHaveBeenCalledTimes(1);
    });

    it.each([
      [{ success: true }, "Time capsule opened", 2],
      [{ success: false, error: "apiError_ENTRY_NOT_SEALED" }, "This entry is not sealed.", 1],
      [{ success: false }, "Could not open the time capsule. Please try again.", 1],
    ] as const)("opens a time capsule early and says so (%o)", async (answer, expected, fetches) => {
      const languageNotifier = createNotifier("en");
      const unsealEntry = vi.fn().mockResolvedValue(answer);
      const fetchEntries = await mockTaskEntriesService(vi.fn(), vi.fn(), { unsealEntry });

      const { result } = renderHook(() => useEntries(true, { ...mockConfig, language: "en" }, null, languageNotifier));
      await waitFor(() => expect(result.current.entries).toHaveLength(1));

      await act(async () => {
        await result.current.unsealEntry(result.current.entries[0]!);
      });

      expect(unsealEntry).toHaveBeenCalledWith(7);
      expect(languageNotifier.notify).toHaveBeenCalledWith(expected);
      await waitFor(() => expect(fetchEntries).toHaveBeenCalledTimes(fetches));
    });

    it("exposes entry actions", () => {
      const { result } = renderHook(() => useEntries(false, mockConfig, null, notifier));

      expect(typeof result.current.fetchEntries).toBe("function");
      expect(typeof result.current.fetchEntryDates).toBe("function");
      expect(typeof result.current.toggleVisibility).toBe("function");
      expect(typeof result.current.toggleFavorite).toBe("function");
      expect(typeof result.current.toggleArchived).toBe("function");
      expect(typeof result.current.togglePinned).toBe("function");
      expect(typeof result.current.fetchEntryHistory).toBe("function");
      expect(typeof result.current.fetchEntryBacklinks).toBe("function");
      expect(typeof result.current.deleteRevision).toBe("function");
      expect(typeof result.current.reorderEntries).toBe("function");
    });
  });
});
