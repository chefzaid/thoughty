import { test, expect } from '@playwright/test';
import { setupMockApp } from './support/mockApp';

test.describe('Visibility Toggle', () => {
  test('toggles entry visibility from private to public and back', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      initialEntries: [
        {
          id: 1,
          date: '2025-01-15',
          index: 1,
          content: 'Test visibility toggle entry',
          tags: ['test'],
          visibility: 'private',
        },
      ],
    });

    // Login
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for entry to appear
    await expect(page.getByText('Test visibility toggle entry')).toBeVisible();

    // Entry should start as private
    const entry = page.locator('[id^="entry-"]').first();
    const visibilityBtn = entry.locator('button[title="Private - only you can see"]');
    await expect(visibilityBtn).toBeVisible();
    expect(state.entries[0]?.visibility).toBe('private');

    // Toggle to public
    await visibilityBtn.click();

    // Wait for the state to update and re-render
    await expect(entry.locator('button[title="Public - visible to everyone"]')).toBeVisible({ timeout: 5000 });
    expect(state.entries[0]?.visibility).toBe('public');

    // Toggle back to private
    await entry.locator('button[title="Public - visible to everyone"]').click();

    await expect(entry.locator('button[title="Private - only you can see"]')).toBeVisible({ timeout: 5000 });
    expect(state.entries[0]?.visibility).toBe('private');
  });
});
