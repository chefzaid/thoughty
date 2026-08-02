import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { components } from "../../generated/openapi";
import StatsCorrelationGraph from "./StatsCorrelationGraph";

type StatsCorrelations = components["schemas"]["StatsCorrelationsDto"];

const translations: Record<string, string> = {
  correlationGraph: "Connections",
  correlationGraphDescription: "Explore journal connections.",
  correlationEntriesAnalyzed: "{count} entries analyzed",
  entryConnections: "Related entries",
  tagConnections: "Tag network",
  connectionStrength: "Connection strength: {score}%",
  sharedEntryCount: "{count} shared entries",
  noEntryConnections: "No related entries yet.",
  noTagConnections: "No tag network yet.",
  openConnectedEntry: "Open entry {index} from {date}",
};

const t = (key: string, params?: Record<string, string | number>) =>
  Object.entries(params ?? {}).reduce(
    (value, [name, replacement]) =>
      value.replace(`{${name}}`, String(replacement)),
    translations[key] ?? key,
  );

const correlations: StatsCorrelations = {
  analyzedEntries: 4,
  entryConnections: [
    {
      sourceEntryId: 3,
      sourceDate: "2025-03-01",
      sourceIndex: 1,
      targetEntryId: 1,
      targetDate: "2025-01-01",
      targetIndex: 2,
      sharedTags: ["focus", "work"],
      score: 82,
    },
  ],
  tagConnections: [
    {
      firstTag: "focus",
      secondTag: "work",
      sharedEntries: 2,
      strength: 82,
    },
  ],
};

describe("StatsCorrelationGraph", () => {
  it("switches between entry and tag connections and opens an entry date", async () => {
    const user = userEvent.setup();
    const onOpenJournalDay = vi.fn();
    render(
      <StatsCorrelationGraph
        correlations={correlations}
        themeClass="dark"
        t={t}
        onOpenJournalDay={onOpenJournalDay}
      />,
    );

    expect(screen.getByText("4 entries analyzed")).toBeInTheDocument();
    expect(
      screen.getByRole("meter", { name: "Connection strength: 82%" }),
    ).toHaveValue(82);
    expect(screen.getByText("focus · work")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Open entry 2 from 2025-01-01",
      }),
    );
    expect(onOpenJournalDay).toHaveBeenCalledWith("2025-01-01");

    await user.click(screen.getByRole("tab", { name: "Tag network" }));
    expect(screen.getByText("2 shared entries")).toBeInTheDocument();
    expect(screen.getByText("focus")).toBeInTheDocument();
    expect(screen.getByText("work")).toBeInTheDocument();
  });

  it("shows useful empty states", async () => {
    const user = userEvent.setup();
    render(
      <StatsCorrelationGraph
        correlations={{
          analyzedEntries: 1,
          entryConnections: [],
          tagConnections: [],
        }}
        themeClass="light"
        t={t}
      />,
    );

    expect(screen.getByText("No related entries yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Tag network" }));
    expect(screen.getByText("No tag network yet.")).toBeInTheDocument();
  });
});
