import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "./hookTestUtils";
import { useEntryForm } from "./useEntryActions";
import { createEntriesServiceMock } from "./useEntryActions.test-helpers";
import { browserTimeZone } from "../utils/timeCapsule";

vi.mock("../contexts/AuthContext", async () => (await import("./useEntryActions.test-helpers")).authContextMock());
vi.mock("../services/api", async () => (await import("./useEntryActions.test-helpers")).apiModuleMock());

describe("useEntryForm time capsules", () => {
  const config = { defaultVisibility: "private" as const, entriesPerPage: 10 };
  const event = { preventDefault: vi.fn() };
  const nextYear = `${new Date().getFullYear() + 1}-06-01`;

  beforeEach(() => vi.clearAllMocks());

  it("seals the entry in the writer's time zone, then clears the capsule", async () => {
    const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 42 });
    await createEntriesServiceMock({ createEntry });
    const { result } = renderHook(() => useEntryForm(config, 1, vi.fn()));

    act(() => {
      result.current.setNewEntryText("Dear future me");
      result.current.setTags(["future-self"]);
      result.current.setTimeCapsule({ opensOn: nextYear, openHour: 18 });
    });
    await act(async () => {
      await result.current.handleSubmit(event);
    });

    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({
      seal: { opensOn: nextYear, openHour: 18, timeZone: browserTimeZone() },
    }));
    expect(result.current.timeCapsule).toBeNull();
  });

  it("sends no capsule for an ordinary entry, and refuses an opening date out of range", async () => {
    const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 42 });
    await createEntriesServiceMock({ createEntry });
    const { result } = renderHook(() => useEntryForm(config, 1, vi.fn()));

    act(() => {
      result.current.setNewEntryText("Today");
      result.current.setTags(["daily"]);
    });
    await act(async () => {
      await result.current.handleSubmit(event);
    });
    expect(createEntry).toHaveBeenLastCalledWith(expect.objectContaining({ seal: null }));

    act(() => {
      result.current.setNewEntryText("Too soon");
      result.current.setTags(["daily"]);
      result.current.setTimeCapsule({ opensOn: "2000-01-01", openHour: 9 });
    });
    await act(async () => {
      await result.current.handleSubmit(event);
    });
    expect(result.current.formError).toBe("timeCapsuleDateRequired");
    expect(createEntry).toHaveBeenCalledTimes(1);
  });

  it("shows the reason the server gave when it refuses the entry", async () => {
    await createEntriesServiceMock({ createEntry: vi.fn().mockResolvedValue({ success: false, error: "apiError_TIME_CAPSULE_DATE_INVALID" }) });
    const { result } = renderHook(() => useEntryForm(config, 1, vi.fn()));

    act(() => {
      result.current.setNewEntryText("Dear future me");
      result.current.setTags(["future-self"]);
      result.current.setTimeCapsule({ opensOn: nextYear, openHour: 9 });
    });
    await act(async () => {
      await result.current.handleSubmit(event);
    });

    expect(result.current.formError).toBe("apiError_TIME_CAPSULE_DATE_INVALID");
  });
});
