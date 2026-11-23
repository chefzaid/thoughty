import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryForm } from "./useEntryActions";
import { makeDiary } from "../test/diaryFixture";

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
        suggestTags: vi.fn().mockResolvedValue({ data: ["focus", "writing"], refusal: null }),
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
          { defaultVisibility: "private" },
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
        suggestTags: vi.fn().mockResolvedValue({ data: null, refusal: null }),
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
          { defaultVisibility: "private" },
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
        suggestTags: vi.fn().mockResolvedValue({ data: [], refusal: null }),
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
          { defaultVisibility: "private" },
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
        .mockResolvedValueOnce({ data: null, refusal: null })
        .mockResolvedValueOnce({ data: "Original draft", refusal: null })
        .mockResolvedValueOnce({ data: "Corrected draft", refusal: null });
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
          { defaultVisibility: "private" },
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
      // The composer's diary goes with the text, so the server can refuse a diary with AI off
      expect(fixWriting).toHaveBeenLastCalledWith("Original draft", "grammar", 1, undefined);
    });

    it("shows the server's refusal for a diary turned AI off elsewhere, and reloads the diaries", async () => {
      const { createAiService } = await import("../services/api");
      const refused = { data: null, refusal: "apiError_DIARY_AI_OFF" };
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn().mockResolvedValue(refused),
        fixWriting: vi.fn().mockResolvedValue(refused),
      } as unknown as ReturnType<typeof createAiService>);
      const onDiaryAiOff = vi.fn();

      const { result } = renderHook(() =>
        useEntryForm({ defaultVisibility: "private" }, 1, mockOnSuccess, [], onDiaryAiOff),
      );
      act(() => {
        result.current.setNewEntryText("A note for the doctor");
      });

      await act(async () => {
        await result.current.handleFixWriting();
      });
      expect(result.current.formError).toBe("apiError_DIARY_AI_OFF");
      expect(result.current.newEntryText).toBe("A note for the doctor");
      expect(onDiaryAiOff).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.handleSuggestTags();
      });
      expect(result.current.formError).toBe("apiError_DIARY_AI_OFF");
      expect(onDiaryAiOff).toHaveBeenCalledTimes(2);
    });

    it("asks before Rephrase in a diary that asks each time, sends only once confirmed, and adds no tags on save", async () => {
      const { createAiService } = await import("../services/api");
      const fixWriting = vi.fn().mockResolvedValue({ data: "A dream about the sea.", refusal: null });
      vi.mocked(createAiService).mockReturnValue({ suggestTags: vi.fn(), fixWriting } as unknown as ReturnType<typeof createAiService>);
      const requestConsent = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const diaries = [makeDiary({ id: 4, name: "Dreams", aiMode: "ask" })];

      const { result } = renderHook(() =>
        useEntryForm({ defaultVisibility: "private", autoTagMaxTags: 3 }, 4, mockOnSuccess, diaries, undefined, requestConsent),
      );
      expect(result.current.diaryAiMode).toBe("ask");
      act(() => {
        result.current.setNewEntryText("a dream about the sea");
      });

      await act(async () => {
        await expect(result.current.handleFixWriting()).resolves.toBe(false);
      });
      expect(requestConsent).toHaveBeenCalledWith({ text: "a dream about the sea", task: "writing" });
      expect(fixWriting).not.toHaveBeenCalled();

      await act(async () => {
        await expect(result.current.handleFixWriting()).resolves.toBe(true);
      });
      expect(fixWriting).toHaveBeenCalledWith("a dream about the sea", "grammar", 4, true);
      expect(result.current.newEntryText).toBe("A dream about the sea.");

      // Saving is no request the writer saw, so nothing tags the entry: it needs a tag of its own
      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });
      expect(result.current.formError).toBe("entryTagRequired");
    });

    it("shows another known refusal without reloading the diaries", async () => {
      const { createAiService } = await import("../services/api");
      vi.mocked(createAiService).mockReturnValue({
        suggestTags: vi.fn(),
        fixWriting: vi.fn().mockResolvedValue({ data: null, refusal: "apiError_AI_KEY_NOT_CONFIGURED" }),
      } as unknown as ReturnType<typeof createAiService>);
      const onDiaryAiOff = vi.fn();

      const { result } = renderHook(() =>
        useEntryForm({ defaultVisibility: "private" }, 1, mockOnSuccess, [], onDiaryAiOff),
      );
      act(() => {
        result.current.setNewEntryText("A note");
      });
      await act(async () => {
        await result.current.handleFixWriting();
      });

      expect(result.current.formError).toBe("apiError_AI_KEY_NOT_CONFIGURED");
      expect(onDiaryAiOff).not.toHaveBeenCalled();
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
          { defaultVisibility: "private" },
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
