import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Public Intro Page', () => {
  test('shows the landing page and transitions into sign in and sign up flows', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await expect(page.locator('#identifier')).toBeVisible();
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Sign Up' }).first().click();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByText('Create your account')).toBeVisible();
  });

  test('stays the entry point for signed-in users and opens their journal', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Sign In' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open your journal' }).first().click();
    await expect(page).toHaveURL(/\/journal(\?|$)/);
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
  });
});
