import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useBulkSelect, useDeleteModal } from "./useEntryActions";
import { createAiServiceMock, createEntriesServiceMock, mockNotify, notifier } from "./useEntryActions.test-helpers";

vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());

describe("useEntryActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useDeleteModal", () => {
    const mockOnDelete = vi.fn();

    it("initializes with modal closed", () => {
      const { result } = renderHook(() => useDeleteModal(mockOnDelete, notifier));

      expect(result.current.deleteModalOpen).toBe(false);
      expect(result.current.entryToDelete).toBeNull();
    });

    it("handleDelete opens modal and sets entry", () => {
      const { result } = renderHook(() => useDeleteModal(mockOnDelete, notifier));

      act(() => {
        result.current.handleDelete(123);
      });

      expect(result.current.deleteModalOpen).toBe(true);
      expect(result.current.entryToDelete).toBe(123);
    });

    it("cancelDelete closes modal and clears entry", () => {
      const { result } = renderHook(() => useDeleteModal(mockOnDelete, notifier));

      act(() => {
        result.current.handleDelete(123);
      });
      act(() => {
        result.current.cancelDelete();
      });

      expect(result.current.deleteModalOpen).toBe(false);
      expect(result.current.entryToDelete).toBeNull();
    });

    it("confirmDelete returns early if no entry to delete", async () => {
      const { result } = renderHook(() => useDeleteModal(mockOnDelete, notifier));

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it("confirmDelete calls onDelete on success", async () => {
      await createEntriesServiceMock({
        deleteEntry: vi.fn().mockResolvedValue(true),
      });
      const onDeleteMock = vi.fn();
      const { result } = renderHook(() => useDeleteModal(onDeleteMock, notifier));

      act(() => {
        result.current.handleDelete(123);
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(onDeleteMock).toHaveBeenCalled();
      expect(result.current.deleteModalOpen).toBe(false);
      expect(result.current.entryToDelete).toBeNull();
    });

    it("confirmDelete notifies on failure", async () => {
      await createEntriesServiceMock({
        deleteEntry: vi.fn().mockResolvedValue(false),
      });
      const { result } = renderHook(() => useDeleteModal(vi.fn(), notifier));

      act(() => {
        result.current.handleDelete(456);
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockNotify).toHaveBeenCalledWith("Failed to delete entry.");
    });
  });

  describe("useBulkSelect", () => {
    const mockOnComplete = vi.fn();

    it("initializes with default state", () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      expect(result.current.bulkMode).toBe(false);
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.bulkModalOpen).toBe(false);
      expect(result.current.pendingAction).toBeNull();
    });

    it("toggleBulkMode enables and disables bulk mode", () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      act(() => {
        result.current.toggleBulkMode();
      });
      expect(result.current.bulkMode).toBe(true);

      act(() => {
        result.current.toggleBulkMode();
      });
      expect(result.current.bulkMode).toBe(false);
    });

    it("hands the selected entries to the book converter and leaves bulk mode", async () => {
      const bulkOperation = vi.fn();
      await createEntriesServiceMock({ bulkOperation });
      const onMakeBook = vi.fn();
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier, onMakeBook));

      act(() => {
        result.current.toggleBulkMode();
        result.current.toggleSelect(4);
        result.current.toggleSelect(2);
      });
      act(() => {
        result.current.requestBulkAction("book");
      });

      expect(onMakeBook).toHaveBeenCalledWith([4, 2]);
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.bulkMode).toBe(false);
      expect(bulkOperation).not.toHaveBeenCalled();
    });

    it("clears selection when exiting bulk mode", () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      act(() => {
        result.current.toggleBulkMode();
        result.current.toggleSelect(1);
        result.current.toggleSelect(2);
      });
      expect(result.current.selectedIds.size).toBe(2);

      act(() => {
        result.current.toggleBulkMode();
      });
      expect(result.current.selectedIds.size).toBe(0);
    });

    it("toggleSelect adds and removes entries", () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      act(() => {
        result.current.toggleSelect(1);
      });
      expect(result.current.selectedIds.has(1)).toBe(true);

      act(() => {
        result.current.toggleSelect(1);
      });
      expect(result.current.selectedIds.has(1)).toBe(false);
    });

    it("selectAll sets all provided ids", () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      act(() => {
        result.current.selectAll([1, 2, 3]);
      });

      expect(result.current.selectedIds.size).toBe(3);
      expect(result.current.selectedIds.has(1)).toBe(true);
      expect(result.current.selectedIds.has(2)).toBe(true);
      expect(result.current.selectedIds.has(3)).toBe(true);
    });

    it("clearSelection empties the selection set", () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      act(() => {
        result.current.selectAll([1, 2, 3]);
        result.current.clearSelection();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });

    it("requestBulkAction with delete opens confirm modal", () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      act(() => {
        result.current.toggleSelect(1);
      });

      act(() => {
        result.current.requestBulkAction("delete");
      });

      expect(result.current.bulkModalOpen).toBe(true);
      expect(result.current.pendingAction).toEqual({ action: "delete" });
    });

    it("requestBulkAction does nothing when no entries selected", async () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      await act(async () => {
        result.current.requestBulkAction("delete");
      });

      expect(result.current.bulkModalOpen).toBe(false);
    });

    it("requestBulkAction with non-delete executes immediately", async () => {
      const mockBulkOperation = vi
        .fn()
        .mockResolvedValue({ success: true, affectedCount: 1 });
      await createEntriesServiceMock({ bulkOperation: mockBulkOperation });

      const onComplete = vi.fn();
      const { result } = renderHook(() => useBulkSelect(onComplete, [], notifier));

      act(() => {
        result.current.toggleSelect(1);
      });

      await act(async () => {
        result.current.requestBulkAction("visibility", {
          visibility: "public",
        });
      });

      expect(mockBulkOperation).toHaveBeenCalledWith([1], "visibility", {
        visibility: "public",
      });
      expect(onComplete).toHaveBeenCalled();
    });

    it("cancelBulkModal closes modal and clears pending action", () => {
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      act(() => {
        result.current.toggleSelect(1);
      });

      act(() => {
        result.current.requestBulkAction("delete");
      });
      expect(result.current.bulkModalOpen).toBe(true);

      act(() => {
        result.current.cancelBulkModal();
      });

      expect(result.current.bulkModalOpen).toBe(false);
      expect(result.current.pendingAction).toBeNull();
    });

    it("confirmBulkDelete executes delete and clears state", async () => {
      const mockBulkOperation = vi
        .fn()
        .mockResolvedValue({ success: true, affectedCount: 2 });
      await createEntriesServiceMock({ bulkOperation: mockBulkOperation });

      const onComplete = vi.fn();
      const { result } = renderHook(() => useBulkSelect(onComplete, [], notifier));

      act(() => {
        result.current.toggleSelect(1);
        result.current.toggleSelect(2);
        result.current.requestBulkAction("delete");
      });

      await act(async () => {
        await result.current.confirmBulkDelete();
      });

      expect(mockBulkOperation).toHaveBeenCalledWith(
        [1, 2],
        "delete",
        undefined,
      );
      expect(result.current.bulkModalOpen).toBe(false);
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.bulkMode).toBe(false);
      expect(onComplete).toHaveBeenCalled();
    });

    it("executeBulkAction notifies on failure", async () => {
      await createEntriesServiceMock({
        bulkOperation: vi.fn().mockResolvedValue(null),
      });
      const { result } = renderHook(() => useBulkSelect(mockOnComplete, [], notifier));

      act(() => {
        result.current.toggleSelect(1);
      });

      await act(async () => {
        await result.current.executeBulkAction("delete");
      });

      expect(mockNotify).toHaveBeenCalledWith("Bulk operation failed.");
    });

    it("bulk rephrases selected entries and preserves metadata", async () => {
      const updateEntry = vi.fn().mockResolvedValue(true);
      const fixWriting = vi.fn().mockResolvedValue("Improved first entry");
      await createEntriesServiceMock({ updateEntry });
      await createAiServiceMock({ fixWriting });

      const entries = [
        {
          id: 1,
          content: "First entry",
          tags: ["focus"],
          date: "2024-01-15T10:00:00.000Z",
          visibility: "private" as const,
          format: "markdown" as const,
        },
      ];

      const onComplete = vi.fn();
      const { result } = renderHook(() => useBulkSelect(onComplete, entries, notifier));

      act(() => {
        result.current.toggleSelect(1);
      });

      await act(async () => {
        await result.current.requestBulkAction("rephrase", { mode: "polish" });
      });

      expect(fixWriting).toHaveBeenCalledWith("First entry", "polish");
      expect(updateEntry).toHaveBeenCalledWith(1, {
        text: "Improved first entry",
        tags: ["focus"],
        date: "2024-01-15",
        visibility: "private",
        format: "markdown",
      });
      expect(onComplete).toHaveBeenCalled();
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.bulkMode).toBe(false);
    });

    it("shows a no-op message when selected entries do not need rephrasing", async () => {
      const fixWriting = vi.fn().mockResolvedValue("Same entry");
      await createEntriesServiceMock({ updateEntry: vi.fn() });
      await createAiServiceMock({ fixWriting });

      const entries = [
        {
          id: 1,
          content: "Same entry",
          tags: ["focus"],
          date: "2024-01-15",
          visibility: "private" as const,
        },
      ];

      const { result } = renderHook(() =>
        useBulkSelect(mockOnComplete, entries, notifier),
      );

      act(() => {
        result.current.toggleSelect(1);
      });

      await act(async () => {
        await result.current.executeBulkAction("rephrase", { mode: "grammar" });
      });

      expect(mockNotify).toHaveBeenCalledWith(
        "No selected entries needed rephrasing.",
      );
    });
  });
});
