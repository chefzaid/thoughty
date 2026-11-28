import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryEdit, useEntryForm } from "./useEntryActions";
import { createEntriesServiceMock, notifier } from "./useEntryActions.test-helpers";
import { composerDraftSyncMock } from "../components/ComposerDraft/composerDraft.test-helpers";
import { NO_LOCATION } from "../utils/entryLocation";

vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());
vi.mock("../components/ComposerDraft/useComposerDraftSync", () => ({ useComposerDraftSync: () => composerDraftSyncMock() }));

const submit = { preventDefault: vi.fn() };

describe("entry places in the composer and the editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves the composer's place with the entry, then empties it", async () => {
    const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 9 });
    await createEntriesServiceMock({ createEntry });
    const { result } = renderHook(() => useEntryForm({}, 1, vi.fn()));
    act(() => {
      result.current.setNewEntryText("By the lake");
      result.current.setTags(["trip"]);
      result.current.setLocation({ name: " Lake Annecy ", latitude: 45.9, longitude: 6.13 });
    });

    await act(async () => { await result.current.handleSubmit(submit); });

    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ location: { name: "Lake Annecy", latitude: 45.9, longitude: 6.13 } }));
    expect(result.current.location).toEqual(NO_LOCATION);
  });

  it("saves an entry without a place when the composer has none", async () => {
    const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 9 });
    await createEntriesServiceMock({ createEntry });
    const { result } = renderHook(() => useEntryForm({}, 1, vi.fn()));
    act(() => {
      result.current.setNewEntryText("At home");
      result.current.setTags(["home"]);
    });

    await act(async () => { await result.current.handleSubmit(submit); });

    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
  });

  it("opens the editor on the entry's place and saves the change, or null once it is cleared", async () => {
    const updateEntry = vi.fn().mockResolvedValue(true);
    await createEntriesServiceMock({ updateEntry });
    const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: "0" }, vi.fn(), notifier));
    const entry = {
      id: 3, content: "Imported", tags: ["trip"], date: "2024-05-02", visibility: "private" as const,
      location: { name: "Café de Flore, Paris", latitude: 48.854, longitude: 2.3325 },
    };

    act(() => result.current.handleEdit(entry));
    expect(result.current.editLocation).toEqual({ name: "Café de Flore, Paris", latitude: 48.854, longitude: 2.3325 });

    act(() => result.current.setEditLocation((current) => ({ ...current, latitude: null, longitude: null })));
    await act(async () => { await result.current.handleSaveEdit(); });
    expect(updateEntry).toHaveBeenLastCalledWith(3, expect.objectContaining({ location: { name: "Café de Flore, Paris" } }));
    expect(result.current.editLocation).toEqual(NO_LOCATION);

    act(() => {
      result.current.handleEdit(entry);
      result.current.setEditLocation(NO_LOCATION);
    });
    await act(async () => { await result.current.handleSaveEdit(); });
    expect(updateEntry).toHaveBeenLastCalledWith(3, expect.objectContaining({ location: null }));
  });
});
