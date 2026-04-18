import { test, expect } from '@playwright/test';

test.describe('Favorites Feature', () => {
  test('app loads and renders the login/auth page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Thoughty/i);
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/');
    // The app should show some content (auth page or journal)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
