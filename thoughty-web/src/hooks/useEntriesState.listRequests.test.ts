import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { useDiaries, useEntries } from "./useAppState";
import { renderHook } from "./hookTestUtils";
import type { Config } from "../types";

const services = vi.hoisted(() => ({
  fetchEntries: vi.fn(),
  fetchDiaries: vi.fn(),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ authFetch: vi.fn(), getAccessToken: vi.fn(() => "test-token") }),
}));

vi.mock("../services/api", () => ({
  createAuthFetch: vi.fn((authFetch) => authFetch),
  createConfigService: vi.fn(() => ({})),
  createEntriesService: vi.fn(() => ({
    fetchEntries: services.fetchEntries,
    fetchEntryDates: vi.fn().mockResolvedValue([]),
    fetchYearsMonths: vi.fn().mockResolvedValue({ years: [], months: [] }),
  })),
  createDiariesService: vi.fn(() => ({ fetchDiaries: services.fetchDiaries })),
  createAttachmentsService: vi.fn(() => ({})),
  createAiService: vi.fn(() => ({})),
  createCloudSyncService: vi.fn(() => ({})),
}));

const notifier = { notify: vi.fn(), t: (key: string) => key, language: "en" as const };

interface ListInputs {
  config: Config;
  configLoaded: boolean;
  filtersReady: boolean;
  routeEntryId?: number;
}

/** Renders useEntries with inputs a test can change between renders, as the app shell does. */
function renderEntries(initial: ListInputs) {
  let inputs = initial;
  const hook = renderHook(() => useEntries(true, inputs.config, null, notifier, {
    configLoaded: inputs.configLoaded,
    filtersReady: inputs.filtersReady,
    routeEntryId: inputs.routeEntryId,
  }));

  return {
    ...hook,
    update(next: Partial<ListInputs>) {
      inputs = { ...inputs, ...next };
      hook.rerender();
    },
  };
}

describe("journal list requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.fetchEntries.mockResolvedValue({ entries: [], totalPages: 1, allTags: [] });
    services.fetchDiaries.mockResolvedValue([]);
  });

  it("waits for the config and asks once with the user's page size", async () => {
    const list = renderEntries({ config: {}, configLoaded: false, filtersReady: true });

    expect(list.result.current.loading).toBe(true);
    await act(async () => {});
    expect(services.fetchEntries).not.toHaveBeenCalled();

    list.update({ config: { entriesPerPage: 2 }, configLoaded: true });

    await waitFor(() => expect(list.result.current.loading).toBe(false));
    expect(services.fetchEntries).toHaveBeenCalledTimes(1);
    expect(services.fetchEntries).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 2 }));
  });

  it("asks once with the default page size when the config failed to load", async () => {
    const list = renderEntries({ config: {}, configLoaded: true, filtersReady: true });

    await waitFor(() => expect(list.result.current.loading).toBe(false));
    expect(services.fetchEntries).toHaveBeenCalledTimes(1);
    expect(services.fetchEntries).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  it("waits for the diary filters to settle", async () => {
    const list = renderEntries({ config: { entriesPerPage: 5 }, configLoaded: true, filtersReady: false });

    await act(async () => {});
    expect(services.fetchEntries).not.toHaveBeenCalled();
    expect(list.result.current.loading).toBe(true);

    list.update({ filtersReady: true });

    await waitFor(() => expect(services.fetchEntries).toHaveBeenCalledTimes(1));
  });

  it("on a permalink, asks once for the page the entry is on, with the reset filters", async () => {
    const list = renderEntries({ config: { entriesPerPage: 2 }, configLoaded: true, filtersReady: true, routeEntryId: 33 });

    // The permalink resets the archive filter before its lookup answers
    act(() => {
      list.result.current.setFilterArchiveStatus("all");
    });
    await act(async () => {});
    expect(services.fetchEntries).not.toHaveBeenCalled();
    expect(list.result.current.loading).toBe(true);

    act(() => {
      list.result.current.setPage(2);
      list.result.current.setHandledPermalinkEntryId(33);
    });

    await waitFor(() => expect(list.result.current.loading).toBe(false));
    expect(services.fetchEntries).toHaveBeenCalledTimes(1);
    expect(services.fetchEntries).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      limit: 2,
      archiveStatus: "all",
    }));
  });

  it("keeps showing the current list while a new permalink is looked up", async () => {
    services.fetchEntries.mockResolvedValue({
      entries: [{ id: 1, date: "2024-03-03", index: 1, content: "Shown", tags: [], visibility: "private" }],
      totalPages: 1,
      allTags: [],
    });
    const list = renderEntries({ config: {}, configLoaded: true, filtersReady: true });
    await waitFor(() => expect(list.result.current.entries).toHaveLength(1));

    list.update({ routeEntryId: 8 });
    act(() => {
      list.result.current.setPage(3);
    });

    expect(list.result.current.entries).toHaveLength(1);
    expect(list.result.current.loading).toBe(true);
    expect(services.fetchEntries).toHaveBeenCalledTimes(1);
  });
});

describe("default diary selection readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("becomes ready in the same render the default diary is picked", async () => {
    services.fetchDiaries.mockResolvedValue([
      { id: 1, name: "Default", is_default: true },
      { id: 2, name: "Work", is_default: false },
    ]);
    const seen: Array<{ ready: boolean; diaryId: number | null }> = [];

    const { result } = renderHook(() => {
      const diaries = useDiaries(true);
      seen.push({ ready: diaries.diarySelectionReady, diaryId: diaries.currentDiaryId });
      return diaries;
    });

    expect(result.current.diarySelectionReady).toBe(false);
    await waitFor(() => expect(result.current.diarySelectionReady).toBe(true));
    expect(result.current.currentDiaryId).toBe(1);
    expect(seen.filter((render) => render.ready && render.diaryId !== 1)).toEqual([]);
  });

  it("is ready once the diaries arrive when there is none to pick", async () => {
    services.fetchDiaries.mockResolvedValue([]);

    const { result } = renderHook(() => useDiaries(true));

    await waitFor(() => expect(result.current.diarySelectionReady).toBe(true));
    expect(result.current.currentDiaryId).toBeNull();
  });

  it("is ready at once when the route sets the diary", () => {
    const { result } = renderHook(() => useDiaries(true, true));

    expect(result.current.diarySelectionReady).toBe(true);
  });
});
