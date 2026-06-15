import { test, expect } from '@playwright/test';

test.describe('Public Intro Page', () => {
  test('shows the landing page and transitions into sign in and sign up flows', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Thoughty gives you structured diaries, fast import and export')).toBeVisible();

    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await expect(page.locator('#identifier')).toBeVisible();
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Sign Up' }).first().click();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByText('Create your account')).toBeVisible();
  });
});
