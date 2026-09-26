import { expect, test } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('AI tag suggestions', () => {
  test('suggests subject and theme tags for the current draft', async ({ page }) => {
    const { state } = await setupMockApp(page);

    await page.goto('/');

    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();

    await page.getByPlaceholder("What's on your mind?").fill('I spent the morning writing a reflective note about focus and slowing down.');
    await expect(page.getByRole('button', { name: 'Theme Tags' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Auto Tag' }).click();

    await expect(page.locator('.truncate').filter({ hasText: /^focus$/ })).toBeVisible();
    await expect(page.locator('.truncate').filter({ hasText: /^writing$/ })).toBeVisible();
    await expect(page.locator('.truncate').filter({ hasText: /^self-awareness$/ })).toBeVisible();
    expect(state.lastAiSuggestionPayload).toEqual({
      content: 'I spent the morning writing a reflective note about focus and slowing down.',
      existingTags: [],
      maxTags: 5,
    });
  });
});
