import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Journal highlights', () => {
  test('shows random and on-this-day highlights and navigates back to the highlighted journal entry', async ({ page }) => {
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
        {
          id: 102,
          date: '2024-04-17',
          index: 1,
          content: 'Earlier highlight memory',
          tags: ['memory'],
          visibility: 'private',
          diaryId: 2,
        },
      ],
    });

    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Highlights' }).click();

    await expect(page.getByRole('heading', { name: 'Highlights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Random Thought' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'On This Day' })).toBeVisible();

    await page.getByRole('button', { name: /Private focus reflection for filtering/ }).click();

    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.locator('#entry-101')).toHaveClass(/highlight-entry/);
  });
});