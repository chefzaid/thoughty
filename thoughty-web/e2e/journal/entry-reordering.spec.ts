import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

test.describe('Journal entry reordering', () => {
  test('reorders entries within a day and sends the ordered ids to the API', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 201,
          date: '2024-04-18',
          index: 1,
          content: 'First entry of the day',
          tags: ['focus'],
          visibility: 'private',
          diaryId: 1,
        },
        {
          id: 202,
          date: '2024-04-18',
          index: 2,
          content: 'Second entry of the day',
          tags: ['review'],
          visibility: 'private',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/journal');

    const firstEntry = page.locator('#entry-201');
    const secondEntry = page.locator('#entry-202');
    await expect(firstEntry).toContainText('First entry of the day');
    await expect(secondEntry).toContainText('Second entry of the day');

    const dragHandle = firstEntry.getByRole('button', { name: 'Drag to reorder' });
    await dragHandle.dispatchEvent('pointerdown');

    const reorderButtons = secondEntry.locator('button[aria-label="Drag to reorder"]');
    await expect(reorderButtons).toHaveCount(2);

    const dropTarget = reorderButtons.first();
    await dropTarget.dispatchEvent('pointerenter');
    await dropTarget.dispatchEvent('pointerup');

    await expect.poll(() => state.lastReorderPayload).toMatchObject({
      date: '2024-04-18',
      orderedIds: [202, 201],
    });
    await expect.poll(() => state.entries.filter((entry) => entry.date === '2024-04-18').map((entry) => entry.id)).toEqual([202, 201]);
    await expect(page.locator('[id^="entry-"]').first()).toContainText('Second entry of the day');
    await expect(firstEntry).toContainText('#2');
    await expect(secondEntry).toContainText('#1');
  });
});