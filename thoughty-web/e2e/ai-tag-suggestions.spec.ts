import { expect, test } from '@playwright/test';
import { setupMockApp } from './support/mockApp';

test('suggests tags for the current draft', async ({ page }) => {
  const { state } = await setupMockApp(page);

  await page.goto('/');

  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.locator('#identifier').fill('TestUser');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();

  await page.getByPlaceholder("What's on your mind?").fill('I spent the morning writing a reflective note about focus and slowing down.');
  await page.getByRole('button', { name: 'Auto-Tags' }).click();

  await expect(page.locator('.truncate').filter({ hasText: /^focus$/ })).toBeVisible();
  await expect(page.locator('.truncate').filter({ hasText: /^reflection$/ })).toBeVisible();
  await expect(page.locator('.truncate').filter({ hasText: /^writing$/ })).toBeVisible();
  expect(state.lastAiSuggestionPayload).toEqual({
    content: 'I spent the morning writing a reflective note about focus and slowing down.',
    existingTags: [],
    maxTags: 5,
  });
});