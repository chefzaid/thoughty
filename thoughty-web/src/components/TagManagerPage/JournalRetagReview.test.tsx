import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTranslation } from "../../utils/translations";
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

    render(<JournalRetagReview isDark={false} language="en" onApplied={onApplied} t={t} />);

    await user.click(
      screen.getByRole("button", { name: "organizeJournalTags" }),
    );

    expect(await screen.findByText("#growth")).toBeVisible();
    expect(screen.getByText("journalRetagScanCount_other:2/350")).toBeVisible();
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
    expect(await screen.findByText("journalRetagApplied_other:2")).toBeVisible();
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("is a described modal dialog that ignores Escape while the tags are applied", async () => {
    const user = userEvent.setup();
    let finishApply: (value: unknown) => void = () => undefined;
    previewJournalRetag.mockResolvedValue({ data: plan, error: null });
    applyJournalRetag.mockReturnValue(new Promise((resolve) => { finishApply = resolve; }));

    render(<JournalRetagReview isDark language="en" onApplied={vi.fn().mockResolvedValue(undefined)} t={t} />);
    const trigger = screen.getByRole("button", { name: "organizeJournalTags" });
    await user.click(trigger);
    await screen.findByText("#growth");

    const dialog = screen.getByRole("dialog", { name: "journalRetagTitle" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("journalRetagDescription");
    const apply = screen.getByRole("button", { name: "applyJournalRetag" });
    apply.focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "close" })).toHaveFocus();

    await user.click(apply);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    finishApply({ data: { success: true, affectedEntries: 1 }, error: null });
    expect(await screen.findByText("journalRetagApplied_one:1")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
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
        language="en"
        onApplied={vi.fn().mockResolvedValue(undefined)}
        t={t}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "organizeJournalTags" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider unavailable",
    );
    await user.click(screen.getByRole("button", { name: "tryAgain" }));

    expect(await screen.findByText("journalRetagEmpty")).toBeVisible();
    expect(previewJournalRetag).toHaveBeenCalledTimes(2);
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "organizeJournalTags" }),
    ).toHaveFocus();
  });

  it.each([
    ["en", "Analyzed 1 of 1 entry.", "1 entry selected", "Updated 1 entry."],
    ["fr", "1 sur 1 entrée analysée.", "1 entrée sélectionnée", "1 entrée mise à jour."],
  ] as const)("writes single counts in %s", async (language, scanned, selected, applied) => {
    const user = userEvent.setup();
    previewJournalRetag.mockResolvedValue({ data: { ...plan, analyzedEntries: 1, totalEntries: 1 }, error: null });
    applyJournalRetag.mockResolvedValue({ data: { success: true, affectedEntries: 1 }, error: null });
    const translate = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

    render(<JournalRetagReview isDark language={language} onApplied={vi.fn().mockResolvedValue(undefined)} t={translate} />);
    await user.click(screen.getByRole("button", { name: translate("organizeJournalTags") }));

    expect(await screen.findByText(scanned)).toBeVisible();
    expect(screen.getByText(selected)).toBeVisible();
    await user.click(screen.getByRole("button", { name: translate("applyJournalRetag") }));
    expect(await screen.findByText(applied)).toBeVisible();
  });

  it.each([
    ["en", "journalRetagError", "Could not analyze the journal."],
    ["fr", "journalRetagError", "Impossible d'analyser le journal."],
    ["fr", "Provider unavailable", "Provider unavailable"],
  ] as const)("shows a failed preview in %s (%s)", async (language, error, expected) => {
    const user = userEvent.setup();
    previewJournalRetag.mockResolvedValue({ data: null, error });
    const translate = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

    render(<JournalRetagReview isDark language={language} onApplied={vi.fn().mockResolvedValue(undefined)} t={translate} />);
    await user.click(screen.getByRole("button", { name: translate("organizeJournalTags") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
  });
});
