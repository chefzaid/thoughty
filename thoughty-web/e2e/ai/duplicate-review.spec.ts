import { expect, test } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('AI duplicate review', () => {
  test('reviews high-confidence matches and deletes only after confirmation', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{
        id: 201,
        date: '2026-04-20',
        index: 1,
        content: 'I decided to reserve mornings for focused work.',
        tags: ['focus', 'work'],
        visibility: 'private',
        diaryId: 1,
      }, {
        id: 202,
        date: '2026-04-19',
        index: 1,
        content: 'Protecting morning focus time is the right decision.',
        tags: ['focus', 'decision'],
        visibility: 'private',
        diaryId: 1,
      }],
    });

    await page.goto('/journal?diary=1');
    await page.getByRole('button', { name: 'Find duplicates' }).click();

    const dialog = page.getByRole('dialog', { name: 'Similar entries' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('94% confidence')).toBeVisible();
    await expect(dialog.getByText('Both entries reach the same decision about protecting focus time.')).toBeVisible();
    await expect.poll(() => state.lastAiDuplicatePayload).toEqual({ diaryId: 1 });

    await dialog.getByRole('button', { name: 'Delete duplicate entry' }).first().click();
    await page.locator('div.fixed.inset-0.z-50').getByRole('button', { name: 'Delete' }).click();

    await expect.poll(() => state.entries.map((entry) => entry.id)).toEqual([202]);
    await expect(page.getByText('I decided to reserve mornings for focused work.')).toHaveCount(0);
  });
});
