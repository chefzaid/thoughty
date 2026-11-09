import { test, expect } from '../support/test';
import { setupMockApp } from "../support/mockApp";
import { goToView } from "../support/navigation";

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
    await goToView(page, "Stats");

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
      page.getByRole("gridcell", { name: "Thursday, April 18, 2024. 1 entry", exact: true }),
    ).not.toHaveAttribute("title");
    await expect(
      page.getByRole("gridcell", { name: "Wednesday, April 17, 2024. No entries", exact: true }),
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

  test("labels the activity heatmap in French", async ({ page }) => {
    const day = { tags: [], visibility: "private" as const, diaryId: 1 };
    await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: "fr" },
      initialEntries: [
        { ...day, id: 20, date: "2024-04-18", index: 1, content: "Matin calme" },
        { ...day, id: 21, date: "2024-04-18", index: 2, content: "Soir de pluie" },
        { ...day, id: 22, date: "2024-04-19", index: 1, content: "Promenade au parc" },
      ],
    });

    await page.goto("/stats");

    const heatmap = page.getByRole("region", { name: "Activité du journal par jour" });
    for (const label of ["jeudi 18 avril 2024. 2 entrées", "vendredi 19 avril 2024. 1 entrée", "mercredi 17 avril 2024. Aucune entrée"]) {
      await expect(heatmap.getByRole("gridcell", { name: label, exact: true })).toBeAttached();
    }
    await heatmap.getByRole("gridcell", { name: "jeudi 18 avril 2024. 2 entrées" }).hover();
    await expect(page.getByTestId("heatmap-tooltip")).toHaveText("jeudi 18 avril 2024" + "2 entrées");
    await expect(heatmap.getByText("Moins", { exact: true })).toBeVisible();
    await expect(heatmap.getByText("Plus", { exact: true })).toBeVisible();
    await expect(heatmap.getByText("févr.", { exact: true })).toBeVisible();
    await expect(heatmap.getByText("mer.", { exact: true })).toBeVisible();
  });
});
