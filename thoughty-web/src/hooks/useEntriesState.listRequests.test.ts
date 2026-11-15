import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { useDiaries, useEntries } from "./useAppState";
import { renderHook } from "./hookTestUtils";
import { makeDiary } from "../test/diaryFixture";

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

const batch = (ids: number[], fields: Partial<{ total: number; offset: number; nextCursor: string | null; prevCursor: string | null }> = {}) => ({
  entries: ids.map((id) => ({ id, date: `2024-03-${String(30 - (id % 30)).padStart(2, "0")}`, index: 1, content: `Entry ${id}`, tags: [], visibility: "private" })),
  total: 60,
  offset: 0,
  nextCursor: null,
  prevCursor: null,
  allTags: [],
  ...fields,
});

interface ListInputs {
  configLoaded: boolean;
  filtersReady: boolean;
  routeEntryId?: number;
  routePersonId?: number | null;
  onEntryMissing?: () => void;
}

/** Renders useEntries with inputs a test can change between renders, as the app shell does. */
function renderEntries(initial: ListInputs) {
  let inputs = initial;
  const hook = renderHook(() => useEntries(true, null, notifier, {
    configLoaded: inputs.configLoaded,
    filtersReady: inputs.filtersReady,
    routeEntryId: inputs.routeEntryId,
    routePersonId: inputs.routePersonId,
    onEntryMissing: inputs.onEntryMissing,
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
    services.fetchEntries.mockResolvedValue(batch([]));
    services.fetchDiaries.mockResolvedValue([]);
  });

  it("gives the list's query, which it asks with, sending the search order only with a search", async () => {
    const list = renderEntries({ configLoaded: true, filtersReady: true });

    act(() => {
      list.result.current.setSearchSort("date");
      list.result.current.setFilterTags(["walks"]);
      list.result.current.setFilterDateObj(new Date(2024, 2, 9));
      list.result.current.setFilterVisibility("private");
    });
    expect(list.result.current.listQuery).toMatchObject({
      search: "", sort: undefined, filterTags: ["walks"], filterDate: "2024-03-09", filterVisibility: "private",
    });
    expect(list.result.current.listQuery).not.toHaveProperty("page");

    act(() => list.result.current.setSearch("harbor"));
    expect(list.result.current.listQuery).toMatchObject({ search: "harbor", sort: "date" });
    await waitFor(() => expect(services.fetchEntries).toHaveBeenLastCalledWith(list.result.current.listQuery, 20, {}));
  });

  it("waits for the config and asks once for the first batch", async () => {
    const list = renderEntries({ configLoaded: false, filtersReady: true });

    expect(list.result.current.loading).toBe(true);
    await act(async () => {});
    expect(services.fetchEntries).not.toHaveBeenCalled();

    list.update({ configLoaded: true });

    await waitFor(() => expect(list.result.current.loading).toBe(false));
    expect(services.fetchEntries).toHaveBeenCalledTimes(1);
    expect(services.fetchEntries).toHaveBeenCalledWith(expect.objectContaining({ search: "" }), 20, {});
  });

  it("waits for the person the journal address names before asking, then asks for their entries", async () => {
    const list = renderEntries({ configLoaded: true, filtersReady: true, routePersonId: 12 });

    await act(async () => {});
    expect(services.fetchEntries).not.toHaveBeenCalled();

    act(() => list.result.current.setFilterPersonId(12));

    await waitFor(() => expect(services.fetchEntries).toHaveBeenCalledTimes(1));
    expect(services.fetchEntries).toHaveBeenCalledWith(expect.objectContaining({ personId: 12 }), 20, {});
  });

  it("waits for the diary filters to settle, and for the filters a jump resets", async () => {
    const list = renderEntries({ configLoaded: true, filtersReady: false });

    await act(async () => {});
    expect(services.fetchEntries).not.toHaveBeenCalled();
    expect(list.result.current.loading).toBe(true);

    list.update({ filtersReady: true });
    await waitFor(() => expect(services.fetchEntries).toHaveBeenCalledTimes(1));

    act(() => {
      list.result.current.setFiltersResetting(true);
      list.result.current.setFilterArchiveStatus("all");
    });
    await act(async () => {});
    expect(services.fetchEntries).toHaveBeenCalledTimes(1);
    expect(list.result.current.loading).toBe(true);

    act(() => list.result.current.setFiltersResetting(false));
    await waitFor(() => expect(services.fetchEntries).toHaveBeenCalledTimes(2));
  });

  it("on a permalink, asks once around the entry, with the reset filters", async () => {
    const list = renderEntries({ configLoaded: true, filtersReady: true, routeEntryId: 33 });

    // The permalink resets the archive filter before it opens the list at its entry
    act(() => {
      list.result.current.setFilterArchiveStatus("all");
    });
    await act(async () => {});
    expect(services.fetchEntries).not.toHaveBeenCalled();
    expect(list.result.current.loading).toBe(true);

    act(() => {
      list.result.current.openListAt(33);
      list.result.current.setHandledPermalinkEntryId(33);
    });

    await waitFor(() => expect(list.result.current.loading).toBe(false));
    expect(services.fetchEntries).toHaveBeenCalledTimes(1);
    expect(services.fetchEntries).toHaveBeenCalledWith(expect.objectContaining({ archiveStatus: "all" }), 20, { around: 33 });
  });

  it("keeps showing the current list while a new permalink waits", async () => {
    services.fetchEntries.mockResolvedValue(batch([1]));
    const list = renderEntries({ configLoaded: true, filtersReady: true });
    await waitFor(() => expect(list.result.current.entries).toHaveLength(1));

    list.update({ routeEntryId: 8 });

    expect(list.result.current.entries).toHaveLength(1);
    expect(list.result.current.loading).toBe(true);
    expect(services.fetchEntries).toHaveBeenCalledTimes(1);
  });
});

describe("journal infinite scroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.fetchDiaries.mockResolvedValue([]);
  });

  it("loads the batches after and before the ones shown from their cursors, and says how many match", async () => {
    services.fetchEntries.mockImplementation(async (_query: unknown, _limit: number, position: Record<string, unknown>) => {
      if ("after" in position) return batch([3, 4], { offset: 22, prevCursor: "c3" });
      if ("before" in position) return batch([0], { offset: 0, nextCursor: "c0" });
      return batch([1, 2], { offset: 20, nextCursor: "c2", prevCursor: "c1" });
    });
    const list = renderEntries({ configLoaded: true, filtersReady: true });
    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.id)).toEqual([1, 2]));
    expect(list.result.current.feed).toMatchObject({ total: 60, offset: 20, hasOlder: true, hasNewer: true });

    act(() => list.result.current.feed.loadOlder());
    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.id)).toEqual([1, 2, 3, 4]));
    expect(services.fetchEntries).toHaveBeenLastCalledWith(expect.anything(), 20, { after: "c2" });
    expect(list.result.current.feed.hasOlder).toBe(false);

    act(() => list.result.current.feed.loadNewer());
    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.id)).toEqual([0, 1, 2, 3, 4]));
    expect(services.fetchEntries).toHaveBeenLastCalledWith(expect.anything(), 20, { before: "c1" });
    expect(list.result.current.feed).toMatchObject({ offset: 0, hasNewer: false });

    // Nothing more either way: asking again sends nothing
    const sent = services.fetchEntries.mock.calls.length;
    act(() => {
      list.result.current.feed.loadOlder();
      list.result.current.feed.loadNewer();
    });
    expect(services.fetchEntries).toHaveBeenCalledTimes(sent);
  });

  it("opens the list around an entry for the filters it is opened with, and starts over when they change", async () => {
    services.fetchEntries.mockImplementation(async (_query: unknown, _limit: number, position: Record<string, unknown>) =>
      ("around" in position ? batch([40, 41], { offset: 30, prevCursor: "c40" }) : batch([1])));
    const list = renderEntries({ configLoaded: true, filtersReady: true });
    await waitFor(() => expect(list.result.current.entries).toHaveLength(1));

    act(() => list.result.current.openListAt(41));
    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.id)).toEqual([40, 41]));
    expect(services.fetchEntries).toHaveBeenLastCalledWith(expect.anything(), 20, { around: 41 });

    // Read again (a change saved), the window starts from its own first entry
    await act(async () => { await list.result.current.fetchEntries(); });
    expect(services.fetchEntries).toHaveBeenLastCalledWith(expect.anything(), 20, { from: "c40" });

    act(() => list.result.current.setFilterFavorites(true));
    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.id)).toEqual([1]));
    expect(services.fetchEntries).toHaveBeenLastCalledWith(expect.objectContaining({ favorites: true }), 20, {});

    // Going back to the start of the list
    act(() => list.result.current.openListAt(41));
    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.id)).toEqual([40, 41]));
    act(() => list.result.current.openListAt(null));
    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.id)).toEqual([1]));
  });

  it("opens the list at its start and says so when the filters leave out the entry to open", async () => {
    const onEntryMissing = vi.fn();
    services.fetchEntries.mockImplementation(async (_query: unknown, _limit: number, position: Record<string, unknown>) =>
      ("around" in position ? "notFound" : batch([1])));
    const list = renderEntries({ configLoaded: true, filtersReady: true, onEntryMissing });
    await waitFor(() => expect(list.result.current.entries).toHaveLength(1));

    act(() => {
      list.result.current.openListAt(99);
      list.result.current.setTargetEntryId(99);
      list.result.current.setActiveTargetId(99);
    });

    await waitFor(() => expect(onEntryMissing).toHaveBeenCalledTimes(1));
    expect(list.result.current.targetEntryId).toBeNull();
    expect(list.result.current.activeTargetId).toBeNull();
    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.id)).toEqual([1]));
  });

  it("shows nothing when the list cannot be read", async () => {
    services.fetchEntries.mockResolvedValue(null);
    const list = renderEntries({ configLoaded: true, filtersReady: true });

    await waitFor(() => expect(services.fetchEntries).toHaveBeenCalled());
    await waitFor(() => expect(list.result.current.loading).toBe(false), { timeout: 3000 });
    expect(list.result.current.entries).toEqual([]);
  });

  it("changes the entries shown across batches without reading them again", async () => {
    services.fetchEntries.mockImplementation(async (_query: unknown, _limit: number, position: Record<string, unknown>) =>
      ("after" in position ? batch([3]) : batch([1, 2], { nextCursor: "c2" })));
    const list = renderEntries({ configLoaded: true, filtersReady: true });
    await waitFor(() => expect(list.result.current.entries).toHaveLength(2));
    act(() => list.result.current.feed.loadOlder());
    await waitFor(() => expect(list.result.current.entries).toHaveLength(3));
    const sent = services.fetchEntries.mock.calls.length;

    act(() => list.result.current.setEntries((entries) => entries.map((entry) => ({ ...entry, content: `${entry.content}!` }))));

    await waitFor(() => expect(list.result.current.entries.map((entry) => entry.content)).toEqual(["Entry 1!", "Entry 2!", "Entry 3!"]));
    expect(services.fetchEntries).toHaveBeenCalledTimes(sent);
  });
});

describe("default diary selection readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("becomes ready in the same render the default diary is picked", async () => {
    services.fetchDiaries.mockResolvedValue([
      makeDiary({ id: 1, name: "Default", isDefault: true }),
      makeDiary({ id: 2, name: "Work" }),
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
