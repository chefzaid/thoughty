import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Journal navigation', () => {
  test('follows a cross-reference into another diary and keeps the journal interactive', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 101,
          date: '2024-01-15',
          index: 1,
          content: 'Work source entry with [[2024-01-16]]',
          tags: ['work'],
          visibility: 'private',
          diaryId: 1,
        },
        {
          id: 202,
          date: '2024-01-16',
          index: 1,
          content: 'Personal target entry',
          tags: ['personal'],
          visibility: 'private',
          diaryId: 2,
        },
      ],
    });

    await page.goto('/journal?diary=1');

    await expect(page.getByText('Work source entry with')).toBeVisible();
    await expect(page.getByRole('button', { name: '[[2024-01-16]]' })).toBeVisible();

    await page.getByRole('button', { name: '[[2024-01-16]]' }).click();

    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.getByText('Personal target entry')).toBeVisible();
    await expect(page.locator('#entry-202')).toHaveClass(/highlight-entry/);

    await page.getByTitle('Work').click();

    await expect(page).toHaveURL(/\/journal\?diary=1$/);
    await expect(page.getByText('Work source entry with')).toBeVisible();
  });

  test('switches between diary tabs without blanking the journal view', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 11,
          date: '2024-01-15',
          index: 1,
          content: 'Work entry',
          tags: ['work'],
          visibility: 'private',
          diaryId: 1,
        },
        {
          id: 22,
          date: '2024-01-14',
          index: 1,
          content: 'Personal entry',
          tags: ['personal'],
          visibility: 'private',
          diaryId: 2,
        },
      ],
    });

    await page.goto('/journal?diary=all');

    await expect(page.getByText('Work entry')).toBeVisible();
    await expect(page.getByText('Personal entry')).toBeVisible();

    await page.getByTitle('Personal').click();
    await expect(page).toHaveURL(/\/journal\?diary=2$/);
    await expect(page.getByText('Personal entry')).toBeVisible();
    await expect(page.getByText('Work entry')).toHaveCount(0);

    await page.getByTitle('All Diaries').click();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.getByText('Work entry')).toBeVisible();
    await expect(page.getByText('Personal entry')).toBeVisible();
  });
});