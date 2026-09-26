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

  test('creates, counts, and deletes tags from the tags view', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 311,
          date: '2024-04-18',
          index: 1,
          content: 'Planning the week',
          tags: ['focus', 'planning'],
          visibility: 'private',
          diaryId: 1,
        },
        {
          id: 312,
          date: '2024-04-17',
          index: 1,
          content: 'Deep work block',
          tags: ['focus'],
          visibility: 'private',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/tags');
    await expect(page.getByText('2 entries')).toBeVisible();

    await page.getByPlaceholder('Tag name').fill('gratitude');
    await page.getByRole('button', { name: 'Add tag' }).click();
    await expect(page.getByLabel('Name gratitude')).toBeVisible();
    await expect(page.getByText('Unused')).toBeVisible();

    await page.getByRole('button', { name: 'Delete tag focus' }).click();
    await expect(page.getByText('It will be removed from 2 entries')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByLabel('Name focus')).toHaveCount(0);
    await expect.poll(() => state.entries.map((entry) => entry.tags)).toEqual([['planning'], []]);
  });
});
