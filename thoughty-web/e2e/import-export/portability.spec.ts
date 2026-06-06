import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Import/export portability', () => {
  test('saves format settings and guards delete-all for a scoped diary', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 401,
          date: '2024-04-18',
          index: 1,
          content: 'Entry that can be exported and deleted',
          tags: ['export'],
          visibility: 'private',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/import-export?diary=1&section=import&format=txt&includeVisibility=true');

    await page.locator('.format-section input').first().fill('---ENTRY---');
    await page.getByRole('button', { name: 'Save Format Settings' }).click();
    await expect(page.getByText('Format settings saved')).toBeVisible();
    await expect.poll(() => state.lastFormatPayload).toMatchObject({ entrySeparator: '---ENTRY---' });

    await page.getByRole('button', { name: 'Delete All Entries' }).click();
    await expect(page.getByRole('button', { name: 'Yes, Delete Everything' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Yes, Delete Everything' })).toHaveCount(0);
    expect(state.entries.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Delete All Entries' }).click();
    await page.getByRole('button', { name: 'Yes, Delete Everything' }).click();

    await expect(page.getByText('All entries have been deleted')).toBeVisible();
    await expect.poll(() => state.entries.length).toBe(0);
    await expect.poll(() => state.lastDeleteAllRequestUrl?.searchParams.get('diaryId')).toBe('1');
  });
});