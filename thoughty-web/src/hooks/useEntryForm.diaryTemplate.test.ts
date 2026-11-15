import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryForm } from "./useEntryActions";
import { createEntriesServiceMock } from "./useEntryActions.test-helpers";
import { composerDraftSyncMock } from "../components/ComposerDraft/composerDraft.test-helpers";
import { makeDiary } from "../test/diaryFixture";
import type { Diary } from "../types";

const draftSync = vi.hoisted(() => ({ untouched: [] as boolean[] }));
const draft = vi.hoisted(() => ({ current: null as ReturnType<typeof composerDraftSyncMock> | null }));
vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());
vi.mock("../components/ComposerDraft/useComposerDraftSync", () => ({
  useComposerDraftSync: (_fields: unknown, _apply: unknown, untouchedTemplate: boolean) => {
    draftSync.untouched.push(untouchedTemplate);
    return draft.current;
  },
}));

const custom = { id: "custom-1", name: "Evening walk", content: "Where I walked:", tags: ["walks"], visibility: "private", format: "markdown" };
const config = { defaultVisibility: "private" as const, entriesPerPage: 10, entryTemplates: JSON.stringify([custom]) };
const diaries: Diary[] = [
  makeDiary({ id: 1, name: "Personal", isDefault: true, defaultTemplateId: "builtin-daily-reflection" }),
  makeDiary({ id: 2, name: "Walks", defaultTemplateId: "custom-1" }),
  makeDiary({ id: 3, name: "Plain" }),
  makeDiary({ id: 4, name: "Old", defaultTemplateId: "custom-deleted" }),
  makeDiary({ id: 5, name: "Future", defaultTemplateId: "builtin-letter-to-future-self" }),
];

const onSuccess = vi.fn();
/** Renders the composer on a diary; `show` picks another one, as the diary tabs do. */
const render = (diaryId: number | null) => {
  let current = diaryId;
  const rendered = renderHook(() => useEntryForm(config, current, onSuccess, diaries));
  const show = (id: number | null) => {
    current = id;
    rendered.rerender();
  };
  return { ...rendered, show };
};

describe("useEntryForm diary templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    draftSync.untouched = [];
    draft.current = composerDraftSyncMock();
  });

  it("starts an empty composer from the diary's template, tells the draft it is untouched, and names it", () => {
    const { result } = render(2);

    expect(result.current).toMatchObject({ newEntryText: "Where I walked:", tags: ["walks"], format: "markdown", visibility: "private" });
    expect(result.current.diaryTemplateName).toBe("Evening walk");
    expect(draftSync.untouched.at(-1)).toBe(true);

    act(() => result.current.setNewEntryText("Where I walked: the river"));
    expect(result.current.diaryTemplateName).toBeNull();
    expect(draftSync.untouched.at(-1)).toBe(false);
  });

  it("uses the default diary's template while every diary is shown", () => {
    const { result } = render(null);

    expect(result.current.newEntryText).toContain("What happened today?");
    expect(result.current.tags).toEqual(["reflection"]);
  });

  it("swaps an untouched template for the next diary's, or empties the composer for a diary without one", () => {
    const { result, show } = render(2);

    show(1);
    expect(result.current.newEntryText).toContain("What happened today?");
    expect(result.current).toMatchObject({ format: "plain", visibility: "private" });

    show(3);
    expect(result.current).toMatchObject({ newEntryText: "", tags: [], format: "plain", diaryTemplateName: null });
  });

  it("never replaces the writer's words, and leaves a composer they emptied empty", () => {
    const { result, show } = render(3);
    act(() => result.current.setNewEntryText("My own words"));

    show(2);
    expect(result.current.newEntryText).toBe("My own words");

    act(() => result.current.setNewEntryText(""));
    expect(result.current.newEntryText).toBe("");
    show(1);
    expect(result.current.newEntryText).toContain("What happened today?");
    act(() => result.current.setNewEntryText(""));
    expect(result.current.newEntryText).toBe("");
  });

  it("ignores a template deleted since, and seals the letter to the future self as its template does", () => {
    const { result, show } = render(4);
    expect(result.current.newEntryText).toBe("");

    show(5);
    expect(result.current.newEntryText).toContain("Dear future me");
    expect(result.current.timeCapsule).not.toBeNull();
    show(3);
    expect(result.current.timeCapsule).toBeNull();
  });

  it("waits for the draft to load, and for an offered draft to be answered", () => {
    draft.current = composerDraftSyncMock({ ready: false });
    const { result, show } = render(2);
    expect(result.current.newEntryText).toBe("");

    draft.current = composerDraftSyncMock({ offer: { kind: "restore", draft: null } });
    show(2);
    expect(result.current.newEntryText).toBe("");

    draft.current = composerDraftSyncMock();
    show(2);
    expect(result.current.newEntryText).toBe("Where I walked:");
  });

  it("starts the next entry from the template once one is saved", async () => {
    await createEntriesServiceMock({ createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 9 }) });
    const { result } = render(2);
    act(() => result.current.setNewEntryText("Where I walked: the hills"));

    await act(async () => { await result.current.handleSubmit({ preventDefault: vi.fn() }); });
    expect(result.current.newEntryText).toBe("Where I walked:");
    expect(result.current.diaryTemplateName).toBe("Evening walk");
  });
});
