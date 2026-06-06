import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Favorites Feature', () => {
  test('filters the journal down to favorite entries', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 1,
          date: '2025-01-15',
          index: 1,
          content: 'Favorite entry',
          tags: ['focus'],
          visibility: 'private',
          is_favorite: true,
        },
        {
          id: 2,
          date: '2025-01-15',
          index: 2,
          content: 'Regular entry',
          tags: ['review'],
          visibility: 'private',
          is_favorite: false,
        },
      ],
    });

    await page.goto('/journal');
    await expect(page.getByText('Favorite entry')).toBeVisible();
    await expect(page.getByText('Regular entry')).toBeVisible();

    await page.getByTitle('Show favorites only').click();

    await expect(page.getByText('Favorite entry')).toBeVisible();
    await expect(page.getByText('Regular entry')).toHaveCount(0);
  });
});
