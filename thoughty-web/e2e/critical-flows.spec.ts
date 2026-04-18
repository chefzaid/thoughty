import { test, expect } from '@playwright/test';
import { setupMockApp } from './support/mockApp';

test.describe('Critical User Flows', () => {
  test('signs up from the public intro page', async ({ page }) => {
    const { state } = await setupMockApp(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await page.locator('#username').fill('NewWriter');
    await page.locator('#email').fill('newwriter@example.com');
    await page.locator('#password').fill('password123');
    await page.locator('#confirmPassword').fill('password123');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await expect.poll(() => state.lastRegisterPayload?.username).toBe('NewWriter');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
  });

  test('logs in and manages an entry through create, edit, and delete', async ({ page }) => {
    const { state } = await setupMockApp(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect.poll(() => state.lastLoginPayload?.identifier).toBe('TestUser');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();

    const entryForm = page.locator('form').first();

    await page.getByPlaceholder("What's on your mind?").fill('Original entry body');
    await entryForm.locator('input[placeholder="tags..."]').fill('work');
    await entryForm.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Original entry body')).toBeVisible();

    const firstEntry = page.locator('[id^="entry-"]').first();
    await firstEntry.locator('button[title="Edit"]').click();
    await firstEntry.locator('textarea').fill('Edited entry body');
    await firstEntry.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Edited entry body')).toBeVisible();
    await expect(page.getByText('Original entry body')).toHaveCount(0);

    await firstEntry.locator('button[title="Delete"]').click();
    await page.locator('div.fixed.inset-0.z-50').getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Edited entry body')).toHaveCount(0);
    await expect.poll(() => state.entries.length).toBe(0);
  });
});