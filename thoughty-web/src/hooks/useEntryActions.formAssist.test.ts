import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryForm } from "./useEntryActions";

vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());

describe("useEntryActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useEntryForm", () => {
    const mockOnSuccess = vi.fn();

    it("handleSuggestTags merges AI suggestions into the existing tags", async () => {
      const { createAiService } = await import("../services/api");
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn().mockResolvedValue(["focus", "writing"]),
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
      });

      const { result } = renderHook(() =>
        useEntryForm(
          { defaultVisibility: "private", entriesPerPage: 10 },
          1,
          mockOnSuccess,
        ),
      );

      act(() => {
        result.current.setNewEntryText(
          "I wrote about focus and deep work all morning.",
        );
        result.current.setTags(["journal"]);
      });

      await act(async () => {
        await result.current.handleSuggestTags();
      });

      expect(result.current.tags).toEqual(["journal", "focus", "writing"]);
      expect(result.current.formError).toBe("");
    });

    it("handleSuggestTags surfaces a configuration error when the AI request fails", async () => {
      const { createAiService } = await import("../services/api");
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn().mockResolvedValue(null),
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
      });

      const { result } = renderHook(() =>
        useEntryForm(
          { defaultVisibility: "private", entriesPerPage: 10 },
          1,
          mockOnSuccess,
        ),
      );

      act(() => {
        result.current.setNewEntryText(
          "This draft should trigger the AI error path.",
        );
      });

      await act(async () => {
        await result.current.handleSuggestTags();
      });

      expect(result.current.formError).toBe(
        "suggestTagsFailed",
      );
    });

    it("handleSuggestTags validates empty input and empty AI responses", async () => {
      const { createAiService } = await import("../services/api");
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn().mockResolvedValue([]),
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
      });

      const { result } = renderHook(() =>
        useEntryForm(
          { defaultVisibility: "private", entriesPerPage: 10 },
          1,
          mockOnSuccess,
        ),
      );

      await act(async () => {
        await result.current.handleSuggestTags();
      });
      expect(result.current.formError).toBe(
        "suggestTagsNeedsText",
      );

      act(() => {
        result.current.setNewEntryText("This still has no AI suggestions");
      });

      await act(async () => {
        await result.current.handleSuggestTags();
      });
      expect(result.current.formError).toBe(
        "suggestTagsEmpty",
      );
    });

    it("handleFixWriting validates input and updates corrected text", async () => {
      const { createAiService } = await import("../services/api");
      const fixWriting = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("Original draft")
        .mockResolvedValueOnce("Corrected draft");
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn(),
        fixWriting,
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
      });

      const { result } = renderHook(() =>
        useEntryForm(
          { defaultVisibility: "private", entriesPerPage: 10 },
          1,
          mockOnSuccess,
        ),
      );

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.formError).toBe(
        "fixWritingNeedsText",
      );

      act(() => {
        result.current.setNewEntryText("Original draft");
      });

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.formError).toBe(
        "fixWritingFailed",
      );

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.formError).toBe("fixWritingNoChanges");

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.newEntryText).toBe("Corrected draft");
    });

    it("removes uploaded attachments through the attachments service", async () => {
      const { createAttachmentsService } = await import("../services/api");
      const deleteAttachment = vi.fn().mockResolvedValue(true);
      vi.mocked(createAttachmentsService).mockReturnValue({
        uploadAttachment: vi.fn(),
        linkAttachment: vi.fn(),
        deleteAttachment,
        transcribeAttachment: vi.fn(),
      });

      const { result } = renderHook(() =>
        useEntryForm(
          { defaultVisibility: "private", entriesPerPage: 10 },
          1,
          mockOnSuccess,
        ),
      );
      act(() => {
        result.current.uploadedAttachments.push({ id: 7 } as never);
      });

      await act(async () => {
        await result.current.removeUploadedAttachment(7);
      });

      expect(deleteAttachment).toHaveBeenCalledWith(7);
      expect(result.current.uploadedAttachments).toEqual([]);
    });
  });
});
