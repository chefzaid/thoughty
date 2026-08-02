import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JournalRetagReview from "./JournalRetagReview";

const previewJournalRetag = vi.fn();
const applyJournalRetag = vi.fn();

vi.mock("../../hooks/useApiServices", () => ({
  useApiServices: () => ({
    aiService: { previewJournalRetag, applyJournalRetag },
  }),
}));

const plan = {
  analyzedEntries: 2,
  totalEntries: 350,
  truncated: true,
  themes: ["growth", "work"],
  entries: [
    {
      id: 11,
      date: "2026-01-01",
      index: 1,
      currentTags: ["old"],
      suggestedTags: ["growth"],
    },
    {
      id: 12,
      date: "2026-01-02",
      index: 2,
      currentTags: ["work"],
      suggestedTags: ["work"],
    },
  ],
};

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${Object.values(params).join("/")}` : key;

describe("JournalRetagReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reviews a bounded plan and applies the explicitly selected mode and entries", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn().mockResolvedValue(undefined);
    previewJournalRetag.mockResolvedValue({ data: plan, error: null });
    applyJournalRetag.mockResolvedValue({
      data: { success: true, affectedEntries: 2 },
      error: null,
    });

    render(<JournalRetagReview isDark={false} onApplied={onApplied} t={t} />);

    await user.click(
      screen.getByRole("button", { name: "organizeJournalThemes" }),
    );

    expect(await screen.findByText("#growth")).toBeVisible();
    expect(screen.getByText("journalRetagScanCount:2/350")).toBeVisible();
    expect(screen.getByText("journalRetagLimited")).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveClass("light");
    expect(screen.getByRole("button", { name: "close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(
      screen.getByRole("button", { name: "applyJournalRetag" }),
    ).toHaveFocus();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    await user.click(checkboxes[1]!);
    await user.click(screen.getByRole("button", { name: "journalRetagAdd" }));
    await user.click(screen.getByRole("button", { name: "applyJournalRetag" }));

    expect(applyJournalRetag).toHaveBeenCalledWith("add", [
      { entryId: 11, tags: ["growth"] },
      { entryId: 12, tags: ["work"] },
    ]);
    expect(await screen.findByText("journalRetagApplied:2")).toBeVisible();
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("retries a failed preview and reports an empty journal", async () => {
    const user = userEvent.setup();
    previewJournalRetag
      .mockResolvedValueOnce({ data: null, error: "Provider unavailable" })
      .mockResolvedValueOnce({
        data: {
          analyzedEntries: 0,
          totalEntries: 0,
          truncated: false,
          themes: [],
          entries: [],
        },
        error: null,
      });

    render(
      <JournalRetagReview
        isDark
        onApplied={vi.fn().mockResolvedValue(undefined)}
        t={t}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "organizeJournalThemes" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider unavailable",
    );
    await user.click(screen.getByRole("button", { name: "tryAgain" }));

    expect(await screen.findByText("journalRetagEmpty")).toBeVisible();
    expect(previewJournalRetag).toHaveBeenCalledTimes(2);
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "organizeJournalThemes" }),
    ).toHaveFocus();
  });
});
