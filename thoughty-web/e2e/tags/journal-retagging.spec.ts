import { expect, test } from "@playwright/test";
import { setupMockApp } from "../support/mockApp";

test.describe("Journal theme organization", () => {
  test("reviews and applies selected themes from the tags view", async ({
    page,
  }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 401,
          date: "2026-07-01",
          index: 1,
          content: "I learned to make room for gradual progress.",
          tags: ["reflection"],
          visibility: "private",
          diaryId: 1,
        },
        {
          id: 402,
          date: "2026-07-02",
          index: 1,
          content: "A focused day at work.",
          tags: ["focus"],
          visibility: "private",
          diaryId: 1,
        },
      ],
    });

    await page.goto("/tags");
    await page.getByRole("button", { name: "Organize journal themes" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Review journal themes",
    });
    await expect(dialog).toBeVisible();
    const desktopBounds = await dialog.boundingBox();
    expect(desktopBounds?.y).toBeGreaterThanOrEqual(0);
    expect(
      (desktopBounds?.y ?? 0) + (desktopBounds?.height ?? 0),
    ).toBeLessThanOrEqual(720);
    await expect(dialog.getByText("#growth")).toBeVisible();
    await expect(dialog.getByText("Analyzed 2 of 2 entries.")).toBeVisible();

    await dialog.getByRole("button", { name: "Add themes" }).click();
    await dialog.getByRole("checkbox").nth(1).uncheck();
    await dialog
      .getByRole("button", { name: "Apply selected changes" })
      .click();

    await expect(dialog.getByText("Updated 1 entries.")).toBeVisible();
    await expect
      .poll(() => state.lastAiJournalRetagPayload)
      .toEqual({
        mode: "add",
        assignments: [{ entryId: 402, tags: ["growth"] }],
      });
    await expect
      .poll(() => state.entries.map((entry) => entry.tags))
      .toEqual([["focus", "growth"], ["reflection"]]);
  });

  test("keeps the theme review within a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 403,
          date: "2026-07-03",
          index: 1,
          content: "A small step toward a calmer routine.",
          tags: ["reflection"],
          visibility: "private",
          diaryId: 1,
        },
      ],
    });

    await page.goto("/tags");
    await page.getByRole("button", { name: "Organize journal themes" }).click();
    const dialog = page.getByRole("dialog", { name: "Review journal themes" });
    await expect(dialog).toBeVisible();

    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect(bounds?.y).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(844);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
});
