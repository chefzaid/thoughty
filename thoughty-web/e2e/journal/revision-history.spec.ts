import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Journal revision history', () => {
  test('opens revision history from More actions after an inline edit', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 101,
          date: '2024-04-18',
          index: 1,
          content: 'Private focus reflection for filtering',
          tags: ['focus', 'reflection'],
          visibility: 'private',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/journal');

    const entry = page.locator('#entry-101');
    await entry.getByRole('button', { name: 'Edit' }).click();
    await entry.locator('textarea').fill('Updated focus reflection');
    await entry.getByRole('button', { name: 'Save' }).click();

    await entry.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'View history' }).click();

    await expect(entry.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(entry.getByText('Private focus reflection for filtering')).toBeVisible();
  });
});