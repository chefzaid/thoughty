import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryForm } from "./useEntryActions";
import { createEntriesServiceMock } from "./useEntryActions.test-helpers";
import { composerDraftSyncMock } from "../components/ComposerDraft/composerDraft.test-helpers";

vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());
vi.mock("../components/ComposerDraft/useComposerDraftSync", () => ({ useComposerDraftSync: () => composerDraftSyncMock() }));

const submit = { preventDefault: vi.fn() };

/** An upload that finishes only when the spec lets it, as a slow connection does. */
async function slowUpload() {
  let finish: () => void = () => undefined;
  const uploadAttachment = vi.fn(() => new Promise((resolve) => { finish = () => resolve({ id: 7 }); }));
  const { createAttachmentsService } = await import("../services/api");
  vi.mocked(createAttachmentsService).mockReturnValue({
    uploadAttachment,
    linkAttachment: vi.fn().mockResolvedValue(true),
    deleteAttachment: vi.fn().mockResolvedValue(true),
    transcribeAttachment: vi.fn(),
  } as never);
  return { uploadAttachment, finish: () => finish() };
}

describe("useEntryForm while an entry is being saved", () => {
  const photo = new File(["photo"], "beach.png", { type: "image/png" });
  const ticket = new File(["ticket"], "ticket.pdf", { type: "application/pdf" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const startSaving = async () => {
    const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 9 });
    await createEntriesServiceMock({ createEntry });
    const upload = await slowUpload();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useEntryForm({ defaultVisibility: "public" }, 1, onSuccess));
    act(() => {
      result.current.setNewEntryText("Shells everywhere");
      result.current.setTitle("Low tide");
      result.current.setTags(["beach"]);
      result.current.setMood(4);
      result.current.setVisibility("private");
      result.current.setFormat("markdown");
      result.current.addPendingFile(photo);
    });
    let saved: Promise<void> = Promise.resolve();
    act(() => { saved = result.current.handleSubmit(submit); });
    await vi.waitFor(() => expect(upload.uploadAttachment).toHaveBeenCalledTimes(1));
    const finish = async () => {
      upload.finish();
      await act(async () => { await saved; });
    };
    return { result, createEntry, onSuccess, finish };
  };

  it("empties the composer of the entry it saved", async () => {
    const { result, finish, onSuccess } = await startSaving();
    await finish();

    expect(result.current).toMatchObject({ newEntryText: "", title: "", tags: [], mood: null, format: "plain", visibility: "public", pendingFiles: [] });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("keeps what the writer wrote and attached after pressing Save, and empties the rest", async () => {
    const { result, finish, createEntry } = await startSaving();
    act(() => {
      result.current.setNewEntryText("Evening walk");
      result.current.setMood(2);
      result.current.addPendingFile(ticket);
    });
    await finish();

    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ text: "Shells everywhere", title: "Low tide", mood: 4 }));
    // The new text keeps the format it was written in
    expect(result.current).toMatchObject({ newEntryText: "Evening walk", mood: 2, format: "markdown", title: "", tags: [], visibility: "public" });
    expect(result.current.pendingFiles).toEqual([ticket]);
  });

  it("saves the entry once when Save is pressed again before the save ends", async () => {
    const { result, finish, createEntry } = await startSaving();
    await act(async () => { await result.current.handleSubmit(submit); });
    await finish();

    expect(createEntry).toHaveBeenCalledTimes(1);
    // Free again afterwards
    act(() => {
      result.current.setNewEntryText("Another");
      result.current.setTags(["walks"]);
    });
    await act(async () => { await result.current.handleSubmit(submit); });
    expect(createEntry).toHaveBeenCalledTimes(2);
  });
});
