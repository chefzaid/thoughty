import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { useConfig, useDiaries } from "./useAppState";
import { renderHook } from "./hookTestUtils";
import { makeDiary } from "../test/diaryFixture";

vi.mock("../contexts/AuthContext", async () => (await import("./useAppState.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useAppState.test-helpers")).apiModuleMock());

describe("useAppState Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.classList.remove(
      "light-mode",
      "dark-mode",
      "high-contrast-mode",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useConfig", () => {
    it("initializes with empty config", () => {
      const { result } = renderHook(() => useConfig(false));

      expect(result.current.config).toEqual({});
      expect(result.current.profileStats).toBeNull();
    });

    it("provides translation function", () => {
      const { result } = renderHook(() => useConfig(false));

      expect(typeof result.current.t("save")).toBe("string");
    });

    it("applies theme classes from config", async () => {
      const { result } = renderHook(() => useConfig(false));

      act(() => {
        result.current.setConfig({ theme: "dark" });
      });

      await waitFor(() => {
        expect(document.body.classList.contains("dark-mode")).toBe(true);
        expect(document.body.classList.contains("light-mode")).toBe(false);
      });

      act(() => {
        result.current.setConfig({ theme: "light" });
      });

      await waitFor(() => {
        expect(document.body.classList.contains("light-mode")).toBe(true);
        expect(document.body.classList.contains("dark-mode")).toBe(false);
      });
    });

    it("applies high contrast class from config", async () => {
      const { result } = renderHook(() => useConfig(false));

      act(() => {
        result.current.setConfig({ theme: "dark", highContrast: true });
      });

      await waitFor(() => {
        expect(document.body.classList.contains("high-contrast-mode")).toBe(
          true,
        );
      });

      act(() => {
        result.current.setConfig({ theme: "dark", highContrast: false });
      });

      await waitFor(() => {
        expect(document.body.classList.contains("high-contrast-mode")).toBe(
          false,
        );
      });
    });

    it("exposes config actions", () => {
      const { result } = renderHook(() => useConfig(false));

      expect(typeof result.current.fetchConfig).toBe("function");
      expect(typeof result.current.fetchProfileStats).toBe("function");
      expect(typeof result.current.updateConfig).toBe("function");
      expect(typeof result.current.downloadUserData).toBe("function");
    });

    it("updateConfig updates state when the service succeeds", async () => {
      const { createConfigService } = await import("../services/api");
      vi.mocked(createConfigService).mockReturnValue({
        fetchConfig: vi
          .fn()
          .mockResolvedValue({ theme: "dark", language: "en" }),
        fetchFeatureFlags: vi.fn().mockResolvedValue({}),
        fetchProfileStats: vi.fn().mockResolvedValue(null),
        updateConfig: vi.fn().mockResolvedValue(true),
        downloadUserData: vi.fn().mockResolvedValue(true),
      });

      const { result } = renderHook(() => useConfig(true));

      await waitFor(() => {
        expect(result.current.config).toBeDefined();
      });

      await act(async () => {
        await result.current.updateConfig({ theme: "light" });
      });

      await waitFor(() => {
        expect(result.current.config.theme).toBe("light");
      });
    });
  });

  describe("useDiaries", () => {
    it("initializes with empty diaries", () => {
      const { result } = renderHook(() => useDiaries(false));

      expect(result.current.diaries).toEqual([]);
      expect(result.current.currentDiaryId).toBeNull();
    });

    it("updates currentDiaryId manually", () => {
      const { result } = renderHook(() => useDiaries(false));

      act(() => {
        result.current.setCurrentDiaryId(1);
      });

      expect(result.current.currentDiaryId).toBe(1);
    });

    it("exposes diary actions", () => {
      const { result } = renderHook(() => useDiaries(false));

      expect(typeof result.current.fetchDiaries).toBe("function");
      expect(typeof result.current.handleCreateDiary).toBe("function");
      expect(typeof result.current.handleUpdateDiary).toBe("function");
      expect(typeof result.current.handleDeleteDiary).toBe("function");
      expect(typeof result.current.handleSetDefaultDiary).toBe("function");
      expect(typeof result.current.handleReorderDiaries).toBe("function");
    });

    it("selects the default diary after fetch and preserves user clearing it later", async () => {
      const { createDiariesService } = await import("../services/api");
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([
          makeDiary({ id: 1, name: "Default", isDefault: true }),
          makeDiary({ id: 2, name: "Work" }),
        ]),
        createDiary: vi.fn(),
        updateDiary: vi.fn(),
        deleteDiary: vi.fn(),
        setDefaultDiary: vi.fn(),
        reorderDiaries: vi.fn(),
      });

      const { result } = renderHook(() => useDiaries(true));

      await waitFor(() => {
        expect(result.current.currentDiaryId).toBe(1);
      });

      act(() => {
        result.current.setCurrentDiaryId(null);
      });

      await act(async () => {
        await result.current.fetchDiaries();
      });

      expect(result.current.currentDiaryId).toBeNull();
    });

    it("propagates diary service failures", async () => {
      const { createDiariesService } = await import("../services/api");
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi.fn().mockResolvedValue([]),
        createDiary: vi
          .fn()
          .mockResolvedValue({ success: false, error: "Failed" }),
        updateDiary: vi
          .fn()
          .mockResolvedValue({ success: false, error: "Update failed" }),
        deleteDiary: vi.fn(),
        setDefaultDiary: vi
          .fn()
          .mockResolvedValue({ success: false, error: "Set default failed" }),
        reorderDiaries: vi.fn(),
      });

      const { result } = renderHook(() => useDiaries(true));

      await expect(async () => {
        await act(async () => {
          await result.current.handleCreateDiary({ name: "Test", icon: "📓", visibility: "private" });
        });
      }).rejects.toThrow("Failed");

      await expect(async () => {
        await act(async () => {
          await result.current.handleUpdateDiary(1, { name: "Updated" });
        });
      }).rejects.toThrow("Update failed");

      await expect(async () => {
        await act(async () => {
          await result.current.handleSetDefaultDiary(1);
        });
      }).rejects.toThrow("Set default failed");
    });

    it("refreshes entries after deleting the current diary", async () => {
      const { createDiariesService } = await import("../services/api");
      vi.mocked(createDiariesService).mockReturnValue({
        fetchDiaries: vi
          .fn()
          .mockResolvedValue([makeDiary({ id: 2, name: "Other", isDefault: true })]),
        createDiary: vi.fn(),
        updateDiary: vi.fn(),
        deleteDiary: vi.fn().mockResolvedValue({ success: true }),
        setDefaultDiary: vi.fn(),
        reorderDiaries: vi.fn(),
      });

      const { result } = renderHook(() => useDiaries(true));

      await waitFor(() => {
        expect(result.current.diaries).toBeDefined();
      });

      act(() => {
        result.current.setCurrentDiaryId(1);
      });

      const refreshEntries = vi.fn();
      await act(async () => {
        await result.current.handleDeleteDiary(1, refreshEntries);
      });

      expect(refreshEntries).toHaveBeenCalled();
    });
  });
});
