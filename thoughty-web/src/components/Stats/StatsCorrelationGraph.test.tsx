import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { components } from "../../generated/openapi";
import { getTranslation } from "../../utils/translations";
import StatsCorrelationGraph from "./StatsCorrelationGraph";

type StatsCorrelations = components["schemas"]["StatsCorrelationsDto"];

const translations: Record<string, string> = {
  correlationGraph: "Connections",
  correlationGraphDescription: "Explore journal connections.",
  correlationEntriesAnalyzed_other: "{count} entries analyzed",
  entryConnections: "Related entries",
  tagConnections: "Tag network",
  connectionStrength: "Connection strength: {score}%",
  sharedEntryCount_other: "{count} shared entries",
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
        language="en"
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
        language="en"
        t={t}
      />,
    );

    expect(screen.getByText("No related entries yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Tag network" }));
    expect(screen.getByText("No tag network yet.")).toBeInTheDocument();
  });

  it.each([
    ["en", "1 entry analyzed", "Tag network", "1 shared entry"],
    ["fr", "1 entrée analysée", "Réseau de tags", "1 entrée partagée"],
  ] as const)("writes single counts in %s", async (language, analyzed, tagTab, shared) => {
    const user = userEvent.setup();
    const translate = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
    render(
      <StatsCorrelationGraph
        correlations={{ ...correlations, analyzedEntries: 1, tagConnections: [{ ...correlations.tagConnections[0]!, sharedEntries: 1 }] }}
        themeClass="dark"
        language={language}
        t={translate}
      />,
    );

    expect(screen.getByText(analyzed)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: tagTab }));
    expect(screen.getByText(shared)).toBeInTheDocument();
  });
});
