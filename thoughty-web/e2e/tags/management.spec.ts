import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

test.describe('Tag management', () => {
  test('renames a tag across entries from the tags view', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 301,
          date: '2024-04-18',
          index: 1,
          content: 'Morning focus entry',
          tags: ['focus', 'planning'],
          visibility: 'private',
          diaryId: 1,
        },
        {
          id: 302,
          date: '2024-04-17',
          index: 1,
          content: 'Another focus reflection',
          tags: ['focus'],
          visibility: 'private',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/tags');
    await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();

    const focusNameInput = page.getByLabel('Name focus');
    await focusNameInput.fill('focus-updated');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Settings saved successfully')).toBeVisible();
    await expect.poll(() => state.entries.map((entry) => entry.tags)).toEqual([
      ['focus-updated', 'planning'],
      ['focus-updated'],
    ]);
    await expect(page.getByText('#focus-updated')).toBeVisible();
  });
});