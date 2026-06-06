import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Diary management', () => {
  test('creates, edits, reorders, defaults, and deletes diaries without stranding entries', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 301,
          date: '2024-04-18',
          index: 1,
          content: 'Personal diary entry that should move on delete',
          tags: ['personal'],
          visibility: 'private',
          diaryId: 2,
        },
      ],
    });

    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/diaries?from=journal&diary=all');
    await page.getByPlaceholder('Diary Name').fill('Dreams');
    await page.getByRole('button', { name: 'Create Diary' }).click();

    await expect(page.getByText('Dreams')).toBeVisible();
    expect(state.diaries.some((diary) => diary.name === 'Dreams')).toBe(true);

    const dreamsCard = page.locator('.diary-card', { hasText: 'Dreams' });
    await dreamsCard.getByTitle('Edit').click();
    await page.locator('.diary-card.editing input.diary-name-input').fill('Dream Log');
    await page.locator('.diary-card.editing .edit-form').getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Dream Log')).toBeVisible();
    expect(state.diaries.some((diary) => diary.name === 'Dream Log')).toBe(true);

    await page.getByLabel('Dream Log Drag to reorder').press('ArrowUp');
    await expect.poll(() => state.diaries[1]?.name).toBe('Dream Log');

    const dreamLogCard = page.locator('.diary-card', { hasText: 'Dream Log' });
    await dreamLogCard.getByTitle('Set as Default').click();
    await expect.poll(() => state.diaries.find((diary) => diary.name === 'Dream Log')?.is_default).toBe(true);

    const personalCard = page.locator('.diary-card', { hasText: 'Personal' });
    await personalCard.getByTitle('Delete').click();
    await expect(page.getByText('Personal')).toHaveCount(0);
    await expect.poll(() => state.entries.find((entry) => entry.id === 301)?.diaryId).toBe(3);

    await page.locator('.diary-manager-header .back-btn').click();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);
  });
});