import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Stats insight surfaces', () => {
  test('shows totals, activity heatmap, top tags, and year-by-year tag breakdowns', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 10,
          date: '2024-04-18',
          index: 1,
          content: 'A quiet morning reflection about focus',
          tags: ['reflection', 'focus'],
          visibility: 'private',
          diaryId: 1,
        },
        {
          id: 11,
          date: '2024-04-19',
          index: 1,
          content: 'Work notes for the week',
          tags: ['work', 'focus'],
          visibility: 'public',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/journal');
    await page.getByRole('button', { name: 'Stats' }).click();

    await expect(page).toHaveURL(/\/stats(?:\?diary=1)?$/);
    await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Total Entries' }).getByText('2')).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Unique Tags' }).getByText('3')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Journal Activity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top Tags', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2024' })).toBeVisible();
    await expect(page.getByText('focus (2)')).toBeVisible();
  });
});