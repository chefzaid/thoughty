import { expect, test } from '@playwright/test';
import { setupMockApp } from './support/mockApp';

test('automatically adds AI tags on save when the profile setting is enabled', async ({ page }) => {
  const { state } = await setupMockApp(page);

  await page.goto('/');

  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.locator('#identifier').fill('TestUser');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();

  await page.getByTitle('profile').click();
  const autoTagInput = page.locator('input[name="autoTagMaxTags"]');
  await autoTagInput.clear();
  await autoTagInput.fill('2');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByText('Saved successfully').waitFor();

  await page.getByText('back').click();
  await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();

  await page.getByPlaceholder("What's on your mind?").fill('This entry relies on automatic AI tags during save.');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('.truncate').filter({ hasText: /^#focus$/ })).toBeVisible();
  await expect(page.locator('.truncate').filter({ hasText: /^#reflection$/ })).toBeVisible();
  await expect.poll(() => state.entries[0]?.tags).toEqual(['focus', 'reflection']);
});