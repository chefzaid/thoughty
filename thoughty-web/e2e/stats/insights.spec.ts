import { test, expect } from "@playwright/test";
import { setupMockApp } from "../support/mockApp";

test.describe("Stats insight surfaces", () => {
  test("shows totals, activity heatmap, top tags, and year-by-year tag breakdowns", async ({
    page,
  }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 10,
          date: "2024-04-18",
          index: 1,
          content: "A quiet morning reflection about focus",
          tags: ["reflection", "focus"],
          visibility: "private",
          diaryId: 1,
        },
        {
          id: 11,
          date: "2024-04-19",
          index: 1,
          content: "Work notes for the week",
          tags: ["work", "focus"],
          visibility: "public",
          diaryId: 1,
        },
      ],
    });

    await page.goto("/journal");
    await page.getByRole("button", { name: "Stats" }).click();

    await expect(page).toHaveURL(/\/stats(?:\?diary=1)?$/);
    await expect(page.getByRole("heading", { name: "Stats" })).toBeVisible();
    await expect(
      page.locator(".stat-card", { hasText: "Total Entries" }).getByText("2"),
    ).toBeVisible();
    await expect(
      page.locator(".stat-card", { hasText: "Unique Tags" }).getByText("3"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Journal Activity" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Subjects Discussed" }),
    ).toBeVisible();
    await expect(
      page.getByText("Recent entries focus on reflection, focus, and work."),
    ).toBeVisible();
    await expect(page.getByText("Reflection", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Top Tags", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "2024" })).toBeVisible();
    await expect(page.getByText("focus (2)")).toBeVisible();

    const correlationGraph = page.getByRole("region", { name: "Connections" });
    await expect(
      correlationGraph.getByText("2 entries analyzed"),
    ).toBeVisible();
    await expect(
      correlationGraph.getByRole("tab", { name: "Related entries" }),
    ).toHaveAttribute("aria-selected", "true");
    await correlationGraph.getByRole("tab", { name: "Tag network" }).click();
    await expect(
      correlationGraph.getByText("work", { exact: true }),
    ).toBeVisible();
    await correlationGraph
      .getByRole("tab", { name: "Related entries" })
      .click();

    await page.setViewportSize({ width: 390, height: 844 });
    const personalityPanel = page.getByRole("region", {
      name: "Writing Tendencies",
    });
    await personalityPanel.getByLabel("From").fill("2024-04-18");
    await personalityPanel.getByLabel("To").fill("2024-04-19");
    await personalityPanel.getByRole("button", { name: "Analyze" }).click();
    await expect(
      personalityPanel.getByText(
        "The selected writing suggests a reflective and practical approach to decisions.",
      ),
    ).toBeVisible();
    await expect(
      personalityPanel.getByText("Reflective planning"),
    ).toBeVisible();
    await expect
      .poll(() => state.lastPersonalityAnalysisPayload)
      .toEqual({
        diaryId: 1,
        fromDate: "2024-04-18",
        toDate: "2024-04-19",
      });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await correlationGraph
      .getByRole("button", { name: "Open entry 1 from 2024-04-18" })
      .click();
    await expect(page).toHaveURL(/\/journal(?:\?diary=1)?$/);
    await expect(
      page.getByText("A quiet morning reflection about focus"),
    ).toBeVisible();
  });
});
