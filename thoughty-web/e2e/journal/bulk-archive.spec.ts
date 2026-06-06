import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Journal bulk archive actions', () => {
  test('uses bulk selection to archive and reveal selected entries', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 101,
          date: '2024-04-18',
          index: 1,
          content: 'Private focus reflection for filtering',
          tags: ['focus', 'reflection'],
          visibility: 'private',
          is_favorite: true,
          diaryId: 1,
        },
        {
          id: 103,
          date: '2024-04-17',
          index: 1,
          content: 'Public work planning note',
          tags: ['work'],
          visibility: 'public',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Select' }).click();
    await page.locator('#entry-101 input[type="checkbox"]').check();
    await page.locator('#entry-103 input[type="checkbox"]').check();

    await expect(page.getByText('2 selected')).toBeVisible();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();

    await expect.poll(() => state.entries.every((entry) => entry.is_archived)).toBe(true);
    await expect.poll(() => state.lastBulkPayload).toMatchObject({
      ids: [101, 103],
      action: 'archive',
      isArchived: true,
    });
    await expect(page.getByText('No entries found')).toBeVisible();

    await page.getByRole('button', { name: 'Filter archived entries' }).click();
    await expect(page.getByText('Private focus reflection for filtering')).toBeVisible();
    await expect(page.getByText('Public work planning note')).toBeVisible();
  });
});