import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryForm } from "./useEntryActions";
import { createEntriesServiceMock } from "./useEntryActions.test-helpers";

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
    const mockConfig = {
      defaultVisibility: "private" as const,
      autoTagMaxTags: "0",
    };
    const mockOnSuccess = vi.fn();
    const mockEvent = { preventDefault: vi.fn() };

    it("initializes with default state", () => {
      const { result } = renderHook(() =>
        useEntryForm(mockConfig, 1, mockOnSuccess),
      );

      expect(result.current.newEntryText).toBe("");
      expect(result.current.tags).toEqual([]);
      expect(result.current.formError).toBe("");
    });

    it("sets default visibility from config", async () => {
      const { result } = renderHook(() =>
        useEntryForm({ defaultVisibility: "public" }, 1, mockOnSuccess),
      );

      await waitFor(() => {
        expect(result.current.visibility).toBe("public");
      });
    });

    it("provides setters for text, tags, date, and visibility", () => {
      const { result } = renderHook(() =>
        useEntryForm(mockConfig, 1, mockOnSuccess),
      );
      const newDate = new Date("2024-06-15");

      act(() => {
        result.current.setNewEntryText("Test entry");
        result.current.setTags(["tag1", "tag2"]);
        result.current.setSelectedDate(newDate);
        result.current.setVisibility("public");
      });

      expect(result.current.newEntryText).toBe("Test entry");
      expect(result.current.tags).toEqual(["tag1", "tag2"]);
      expect(result.current.selectedDate).toEqual(newDate);
      expect(result.current.visibility).toBe("public");
    });

    it("handleSubmit sets error when text is empty", async () => {
      const { result } = renderHook(() =>
        useEntryForm(mockConfig, 1, mockOnSuccess),
      );

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe("entryTextRequired");
    });

    it("handleSubmit sets error when no tags", async () => {
      const { result } = renderHook(() =>
        useEntryForm(mockConfig, 1, mockOnSuccess),
      );

      act(() => {
        result.current.setNewEntryText("Test content");
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe("entryTagRequired");
    });

    it("handleSubmit allows empty tags when automatic tagging is enabled", async () => {
      await createEntriesServiceMock({
        createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 42 }),
      });
      const { result } = renderHook(() =>
        useEntryForm(
          { defaultVisibility: "private", autoTagMaxTags: "3" },
          1,
          mockOnSuccess,
        ),
      );

      act(() => {
        result.current.setNewEntryText("Auto-tag this draft");
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe("");
    });

    it("handleSubmit clears form on success", async () => {
      await createEntriesServiceMock({
        createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 42 }),
      });
      const { result } = renderHook(() =>
        useEntryForm(
          { defaultVisibility: "private", entriesPerPage: 10 },
          1,
          mockOnSuccess,
        ),
      );

      act(() => {
        result.current.setNewEntryText("Test entry");
        result.current.setTags(["tag1", "tag2"]);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.newEntryText).toBe("");
      expect(result.current.tags).toEqual([]);
    });

    it("handleSubmit sends the cleaned title and the time of day, then clears them", async () => {
      const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 42 });
      await createEntriesServiceMock({ createEntry });
      const { result } = renderHook(() =>
        useEntryForm({ defaultVisibility: "private", entriesPerPage: 10 }, 1, mockOnSuccess),
      );

      expect(result.current.title).toBe("");
      expect(result.current.timeOfDay).toBe("");
      act(() => {
        result.current.setNewEntryText("Test entry");
        result.current.setTags(["tag1"]);
        result.current.setTitle("  Harbour   walk ");
        result.current.setTimeOfDay("07:30");
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ title: "Harbour walk", timeOfDay: "07:30" }));
      expect(result.current.title).toBe("");
      expect(result.current.timeOfDay).toBe("");
    });

    it("handleSubmit sends the mood and feelings, then clears them", async () => {
      const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 42 });
      await createEntriesServiceMock({ createEntry });
      const { result } = renderHook(() =>
        useEntryForm({ defaultVisibility: "private", entriesPerPage: 10 }, 1, mockOnSuccess),
      );

      expect(result.current.mood).toBeNull();
      expect(result.current.feelings).toEqual([]);
      act(() => {
        result.current.setNewEntryText("Test entry");
        result.current.setTags(["tag1"]);
        result.current.setMood(2);
        result.current.setFeelings(["tired", "hopeful"]);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ mood: 2, feelings: ["tired", "hopeful"] }));
      expect(result.current.mood).toBeNull();
      expect(result.current.feelings).toEqual([]);
    });

    it("handleSubmit sends no title or time when they are left empty", async () => {
      const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 42 });
      await createEntriesServiceMock({ createEntry });
      const { result } = renderHook(() =>
        useEntryForm({ defaultVisibility: "private", entriesPerPage: 10 }, 1, mockOnSuccess),
      );

      act(() => {
        result.current.setNewEntryText("Test entry");
        result.current.setTags(["tag1"]);
        result.current.setTitle("   ");
      });
      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ title: null, timeOfDay: null }));
    });

    it("handleSubmit uploads pending files and links unattached uploads after save", async () => {
      await createEntriesServiceMock({
        createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 42 }),
      });
      const { createAttachmentsService } = await import("../services/api");
      const uploadAttachment = vi
        .fn()
        .mockResolvedValueOnce({ id: 201 })
        .mockResolvedValueOnce({ id: 202 });
      const linkAttachment = vi.fn().mockResolvedValue(true);
      const deleteAttachment = vi.fn().mockResolvedValue(true);
      vi.mocked(createAttachmentsService).mockReturnValue({
        uploadAttachment,
        linkAttachment,
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
      const pendingFileA = new File(["a"], "first.txt");
      const pendingFileB = new File(["b"], "second.txt");

      act(() => {
        result.current.setNewEntryText("Test entry");
        result.current.setTags(["tag1"]);
        result.current.addPendingFile(pendingFileA);
        result.current.addPendingFile(pendingFileB);
        result.current.removePendingFile(0);
        result.current.addPendingFile(pendingFileA);
      });

      act(() => {
        result.current.uploadedAttachments.push({
          id: 99,
          entry_id: null,
        } as never);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(uploadAttachment).toHaveBeenCalledTimes(2);
      expect(linkAttachment).toHaveBeenCalledWith(99, 42);
    });

    it("handleSubmit sets error on failure", async () => {
      await createEntriesServiceMock({
        createEntry: vi.fn().mockResolvedValue({ success: false }),
      });
      const { result } = renderHook(() =>
        useEntryForm(
          { defaultVisibility: "private", entriesPerPage: 10 },
          1,
          mockOnSuccess,
        ),
      );

      act(() => {
        result.current.setNewEntryText("Test entry");
        result.current.setTags(["tag1"]);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.formError).toBe(
        "entrySaveFailed",
      );
    });
  });
});
