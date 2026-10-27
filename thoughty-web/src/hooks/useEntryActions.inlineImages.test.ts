import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryEdit, useEntryForm } from "./useEntryActions";
import { createEntriesServiceMock, notifier } from "./useEntryActions.test-helpers";

vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());

const picture = new File(["x"], "pier.png", { type: "image/png" });
const other = new File(["x"], "notes.pdf", { type: "application/pdf" });

async function attachmentsServiceMock() {
  const { createAttachmentsService } = await import("../services/api");
  const service = {
    uploadAttachment: vi.fn(async (file: File) => ({ id: file.name === "pier.png" ? 31 : 32 })),
    linkAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    transcribeAttachment: vi.fn(),
  };
  vi.mocked(createAttachmentsService).mockReturnValue(service as never);
  return service;
}

describe("inline images on save", () => {
  const event = { preventDefault: vi.fn() };

  beforeEach(() => vi.clearAllMocks());

  it("uploads the pictures a new Markdown entry places before saving it, and the other files after", async () => {
    const attachments = await attachmentsServiceMock();
    const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 42 });
    await createEntriesServiceMock({ createEntry });
    const { result } = renderHook(() => useEntryForm({ defaultVisibility: "private", entriesPerPage: 10 }, 1, vi.fn()));

    act(() => {
      result.current.setFormat("markdown");
      result.current.setNewEntryText("Walk ![The pier](attachment:pier.png)");
      result.current.setTags(["walks"]);
      result.current.addPendingFile(picture);
      result.current.addPendingFile(other);
    });
    await act(async () => {
      await result.current.handleSubmit(event);
    });

    expect(attachments.uploadAttachment.mock.calls).toEqual([[picture], [other, 42]]);
    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ text: "Walk ![The pier](attachment:31)" }));
  });

  it("leaves plain-text entries and their files as before", async () => {
    const attachments = await attachmentsServiceMock();
    const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 42 });
    await createEntriesServiceMock({ createEntry });
    const { result } = renderHook(() => useEntryForm({ defaultVisibility: "private", entriesPerPage: 10 }, 1, vi.fn()));

    act(() => {
      result.current.setNewEntryText("![x](attachment:pier.png)");
      result.current.setTags(["walks"]);
      result.current.addPendingFile(picture);
    });
    await act(async () => {
      await result.current.handleSubmit(event);
    });

    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ text: "![x](attachment:pier.png)" }));
    expect(attachments.uploadAttachment.mock.calls).toEqual([[picture, 42]]);
  });

  it("uploads the pictures an edit places onto the entry before saving the text", async () => {
    const attachments = await attachmentsServiceMock();
    const updateEntry = vi.fn().mockResolvedValue(true);
    await createEntriesServiceMock({ updateEntry });
    const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: "0" }, vi.fn(), notifier));

    act(() => {
      result.current.handleEdit({ id: 7, content: "Old", tags: ["walks"], date: "2024-01-15", visibility: "private", index: 1, format: "markdown" });
    });
    act(() => {
      result.current.setEditText("Old ![](attachment:pier.png)");
      result.current.addEditPendingFile(picture);
      result.current.addEditPendingFile(other);
    });
    await act(async () => {
      await result.current.handleSaveEdit();
    });

    expect(attachments.uploadAttachment.mock.calls).toEqual([[picture, 7], [other, 7]]);
    expect(updateEntry).toHaveBeenCalledWith(7, expect.objectContaining({ text: "Old ![](attachment:31)" }));
  });
});
