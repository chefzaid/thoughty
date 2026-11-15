import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryEdit, useEntryForm } from "./useEntryActions";
import { createEntriesServiceMock, notifier } from "./useEntryActions.test-helpers";
import { composerDraftSyncMock } from "../components/ComposerDraft/composerDraft.test-helpers";
import type { ComposerDraftFields } from "../services/api/composerDraftService";

const draftSync = vi.hoisted(() => ({ calls: [] as Array<{ fields: ComposerDraftFields; apply: (fields: ComposerDraftFields) => void }> }));
const draft = vi.hoisted(() => ({ current: null as ReturnType<typeof composerDraftSyncMock> | null }));
vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());
vi.mock("../components/ComposerDraft/useComposerDraftSync", () => ({
  useComposerDraftSync: (fields: ComposerDraftFields, apply: (fields: ComposerDraftFields) => void) => {
    draftSync.calls.push({ fields, apply });
    return draft.current;
  },
}));

const leave = () => {
  const event = new Event("beforeunload", { cancelable: true });
  globalThis.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("useEntryForm draft", () => {
  const config = { defaultVisibility: "private" as const, entriesPerPage: 10 };

  beforeEach(() => {
    vi.clearAllMocks();
    draftSync.calls = [];
    draft.current = composerDraftSyncMock();
  });

  it("hands the composer fields to the draft, and lets a restored draft fill them", () => {
    const { result } = renderHook(() => useEntryForm(config, 1, vi.fn()));

    act(() => {
      result.current.setNewEntryText("Hello");
      result.current.setMood(4);
    });
    expect(draftSync.calls.at(-1)?.fields).toEqual({ text: "Hello", title: null, tags: [], format: "plain", mood: 4, feelings: [] });

    act(() => draftSync.calls.at(-1)?.apply({ text: "From the phone", title: "Walk", tags: ["walks"], format: "markdown", mood: null, feelings: ["calm"] }));
    expect(result.current).toMatchObject({ newEntryText: "From the phone", title: "Walk", tags: ["walks"], format: "markdown", mood: null, feelings: ["calm"] });
    expect(draftSync.calls.at(-1)?.fields.title).toBe("Walk");
    expect(result.current.draft).toBe(draft.current);
  });

  it("discards the draft once the entry is published, and keeps it when the save fails", async () => {
    const createEntry = vi.fn().mockResolvedValueOnce({ success: false, error: "entrySaveFailed" }).mockResolvedValueOnce({ success: true, entryId: 9 });
    await createEntriesServiceMock({ createEntry });
    const { result } = renderHook(() => useEntryForm(config, 1, vi.fn()));
    act(() => {
      result.current.setNewEntryText("Hello");
      result.current.setTags(["walks"]);
    });

    await act(async () => { await result.current.handleSubmit({ preventDefault: vi.fn() }); });
    expect(draft.current?.onPublished).not.toHaveBeenCalled();
    await act(async () => { await result.current.handleSubmit({ preventDefault: vi.fn() }); });
    expect(draft.current?.onPublished).toHaveBeenCalledTimes(1);
  });
});

describe("useEntryEdit leave warning", () => {
  it("asks before the page closes on unsaved changes to an entry", () => {
    const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: "0" }, vi.fn(), notifier));
    const entry = { id: 3, content: "Saved text", title: "Saved", date: "2026-11-15", tags: ["a"] } as never;

    expect(leave()).toBe(false);
    act(() => result.current.handleEdit(entry));
    expect(leave()).toBe(false);
    act(() => result.current.setEditTitle("Changed"));
    expect(leave()).toBe(true);
    act(() => {
      result.current.setEditTitle("Saved");
      result.current.setEditText("Changed text");
    });
    expect(leave()).toBe(true);
    act(() => result.current.handleCancelEdit());
    expect(leave()).toBe(false);
  });
});
