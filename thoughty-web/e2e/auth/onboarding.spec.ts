import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Authentication onboarding', () => {
  test('signs up from the public intro page and opens the journal', async ({ page }) => {
    const { state } = await setupMockApp(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign Up' }).first().click();

    await page.locator('#username').fill('NewWriter');
    await page.locator('#email').fill('newwriter@example.com');
    await page.locator('#password').fill('password123');
    await page.locator('#confirmPassword').fill('password123');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await expect.poll(() => state.lastRegisterPayload?.username).toBe('NewWriter');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
  });

  test('logs in with a username and lands on the journal route', async ({ page }) => {
    const { state } = await setupMockApp(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect.poll(() => state.lastLoginPayload?.identifier).toBe('TestUser');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(page).toHaveURL(/\/journal$/);
  });
});
