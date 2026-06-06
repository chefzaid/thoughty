import { test, expect } from '@playwright/test';

test.describe('Public Intro Page', () => {
  test('shows the landing page and transitions into sign in and sign up flows', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('A journal that feels calm when you write and sharp when you search.')).toBeVisible();

    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.locator('#identifier')).toBeVisible();
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByText('Create your account')).toBeVisible();
  });
});