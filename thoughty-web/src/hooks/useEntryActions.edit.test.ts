import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryEdit } from "./useEntryActions";
import { createEntriesServiceMock, mockNotify, notifier } from "./useEntryActions.test-helpers";

vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());

describe("useEntryActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useEntryEdit", () => {
    const mockOnSave = vi.fn();

    it("initializes with null editingEntry", () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );

      expect(result.current.editingEntry).toBeNull();
      expect(result.current.editText).toBe("");
      expect(result.current.editTags).toEqual([]);
      expect(result.current.editDate).toBeNull();
    });

    it("handleEdit sets editing state", () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const mockEntry = {
        id: 1,
        content: "Test content",
        tags: ["tag1"],
        date: "2024-01-15",
        visibility: "public" as const,
        index: 1,
      };

      act(() => {
        result.current.handleEdit(mockEntry);
      });

      expect(result.current.editingEntry).toEqual(mockEntry);
      expect(result.current.editText).toBe("Test content");
      expect(result.current.editTags).toEqual(["tag1"]);
      expect(result.current.editVisibility).toBe("public");
    });

    it("handleEdit handles date with T separator", () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const mockEntry = {
        id: 1,
        content: "Test",
        tags: ["tag1"],
        date: "2024-01-15T10:30:00Z",
        visibility: "private" as const,
        index: 1,
      };

      act(() => {
        result.current.handleEdit(mockEntry);
      });

      expect(result.current.editDate?.getFullYear()).toBe(2024);
    });

    it("handleCancelEdit clears editing state", () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const mockEntry = {
        id: 1,
        content: "Test",
        tags: ["tag1"],
        date: "2024-01-15",
        visibility: "public" as const,
        index: 1,
      };

      act(() => {
        result.current.handleEdit(mockEntry);
      });
      act(() => {
        result.current.handleCancelEdit();
      });

      expect(result.current.editingEntry).toBeNull();
      expect(result.current.editText).toBe("");
      expect(result.current.editTags).toEqual([]);
    });

    it("handleSaveEdit notifies when text empty", async () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const mockEntry = {
        id: 1,
        content: "Test",
        tags: ["tag1"],
        date: "2024-01-15",
        visibility: "public" as const,
        index: 1,
      };

      act(() => {
        result.current.handleEdit(mockEntry);
        result.current.setEditText("");
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(mockNotify).toHaveBeenCalledWith(
        "Text and at least one tag are required",
      );
    });

    it("handleSaveEdit notifies when no tags", async () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const mockEntry = {
        id: 1,
        content: "Test",
        tags: ["tag1"],
        date: "2024-01-15",
        visibility: "public" as const,
        index: 1,
      };

      act(() => {
        result.current.handleEdit(mockEntry);
        result.current.setEditTags([]);
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(mockNotify).toHaveBeenCalledWith(
        "Text and at least one tag are required",
      );
    });

    it("provides setters for edit state", () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const newDate = new Date("2024-06-15");

      act(() => {
        result.current.setEditText("New text");
        result.current.setEditTags(["new-tag"]);
        result.current.setEditDate(newDate);
        result.current.setEditVisibility("private");
      });

      expect(result.current.editText).toBe("New text");
      expect(result.current.editTags).toEqual(["new-tag"]);
      expect(result.current.editDate).toEqual(newDate);
      expect(result.current.editVisibility).toBe("private");
    });

    it("saves entry changes successfully", async () => {
      await createEntriesServiceMock({
        updateEntry: vi.fn().mockResolvedValue(true),
      });
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const entry = {
        id: 1,
        content: "Original",
        tags: ["tag1"],
        date: "2024-01-01",
        visibility: "private" as const,
      };

      act(() => {
        result.current.handleEdit(entry);
        result.current.setEditText("Modified text");
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(result.current.editingEntry).toBeNull();
    });

    it("edits the title and time of day and clears them on save", async () => {
      const updateEntry = vi.fn().mockResolvedValue(true);
      await createEntriesServiceMock({ updateEntry });
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const entry = {
        id: 1,
        content: "Original",
        title: "Harbour",
        time_of_day: "07:30",
        tags: ["tag1"],
        date: "2024-01-01",
        visibility: "private" as const,
      };

      act(() => {
        result.current.handleEdit(entry);
      });
      expect(result.current.editTitle).toBe("Harbour");
      expect(result.current.editTimeOfDay).toBe("07:30");

      act(() => {
        result.current.setEditTitle("");
        result.current.setEditTimeOfDay("");
      });
      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(updateEntry).toHaveBeenCalledWith(1, expect.objectContaining({ title: null, timeOfDay: null }));
    });

    it("loads the mood and feelings of the edited entry and saves their removal", async () => {
      const updateEntry = vi.fn().mockResolvedValue(true);
      await createEntriesServiceMock({ updateEntry });
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );

      act(() => {
        result.current.handleEdit({
          id: 1,
          content: "Original",
          mood: 5,
          feelings: ["joyful"],
          tags: ["tag1"],
          date: "2024-01-01",
          visibility: "private" as const,
        });
      });
      expect(result.current.editMood).toBe(5);
      expect(result.current.editFeelings).toEqual(["joyful"]);

      act(() => {
        result.current.setEditMood(null);
        result.current.setEditFeelings([]);
      });
      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(updateEntry).toHaveBeenCalledWith(1, expect.objectContaining({ mood: null, feelings: [] }));
      expect(result.current.editMood).toBeNull();
    });

    it("returns early when there is no edit date or entry to save", async () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "1" }, mockOnSave, notifier),
      );

      act(() => {
        result.current.setEditText("Draft");
        result.current.setEditTags(["tag"]);
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("notifies when saving entry changes fails", async () => {
      await createEntriesServiceMock({
        updateEntry: vi.fn().mockResolvedValue(false),
      });
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const entry = {
        id: 1,
        content: "Original",
        tags: ["tag1"],
        date: "2024-01-01",
        visibility: "private" as const,
      };

      act(() => {
        result.current.handleEdit(entry);
        result.current.setEditText("Modified text");
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(mockNotify).toHaveBeenCalledWith("Failed to update entry.");
    });

    it("uploads new edit files and deletes removed attachments after a successful save", async () => {
      await createEntriesServiceMock({
        updateEntry: vi.fn().mockResolvedValue(true),
      });
      const { createAttachmentsService } = await import("../services/api");
      const uploadAttachment = vi.fn().mockResolvedValue({ id: 88 });
      const deleteAttachment = vi.fn().mockResolvedValue(true);
      vi.mocked(createAttachmentsService).mockReturnValue({
        uploadAttachment,
        linkAttachment: vi.fn(),
        deleteAttachment,
        transcribeAttachment: vi.fn(),
      });

      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "1" }, mockOnSave, notifier),
      );
      const entry = {
        id: 1,
        content: "Original",
        tags: ["tag1"],
        date: "2024-01-01",
        visibility: "private" as const,
        attachments: [{ id: 10 }, { id: 11 }],
      };
      const pendingFile = new File(["draft"], "draft.txt");

      act(() => {
        result.current.handleEdit(entry as never);
        result.current.addEditPendingFile(pendingFile);
        result.current.removeEditAttachment(11);
      });

      await act(async () => {
        await result.current.handleSaveEdit();
      });

      expect(uploadAttachment).toHaveBeenCalledWith(pendingFile, 1);
      expect(deleteAttachment).toHaveBeenCalledWith(11);
      expect(mockOnSave).toHaveBeenCalled();
    });

    it("manages edit pending files and attachments locally", () => {
      const { result } = renderHook(() =>
        useEntryEdit({ autoTagMaxTags: "0" }, mockOnSave, notifier),
      );
      const firstFile = new File(["a"], "a.txt");
      const secondFile = new File(["b"], "b.txt");

      act(() => {
        result.current.addEditPendingFile(firstFile);
        result.current.addEditPendingFile(secondFile);
        result.current.removeEditPendingFile(0);
      });

      expect(result.current.editPendingFiles).toEqual([secondFile]);
    });
  });
});
