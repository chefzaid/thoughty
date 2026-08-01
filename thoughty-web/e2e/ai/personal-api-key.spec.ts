import { expect, test } from "@playwright/test";
import { setupMockApp } from "../support/mockApp";

test.describe("Personal OpenRouter key", () => {
  test("saves a write-only key, shows usage, and restores server fallback on removal", async ({
    page,
  }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto("/profile");
    await expect(page.getByText("Using the server key")).toBeVisible();

    await page
      .getByLabel("OpenRouter API key")
      .fill("sk-or-v1-playwright-personal-key");
    await page.getByRole("button", { name: "Save key" }).click();

    await expect(page.getByText("Personal key active")).toBeVisible();
    await expect(page.getByText("Usage dashboard")).toBeVisible();
    await expect(page.getByText("1,500")).toBeVisible();
    await expect(page.getByText("$3.75")).toBeVisible();
    expect(state.lastOpenRouterKeyPayload).toEqual({
      apiKey: "sk-or-v1-playwright-personal-key",
    });

    await page.getByRole("button", { name: "Remove key" }).click();

    await expect(page.getByText("Using the server key")).toBeVisible();
    await expect(page.getByText("Usage dashboard")).toBeHidden();
    expect(state.personalOpenRouterKey).toBeNull();
  });
});
