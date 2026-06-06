import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

const lifecycleEntry = {
  id: 10,
  date: '2024-04-18',
  index: 1,
  content: 'A quiet morning reflection about focus',
  tags: ['reflection', 'focus'],
  visibility: 'private' as const,
  diaryId: 1,
};

test.describe('Journal entry lifecycle', () => {
  test('creates a dated, tagged journal entry', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/journal');

    const entryForm = page.locator('form').first();
    await page.getByPlaceholder("What's on your mind?").fill('Original entry body');
    await entryForm.locator('input[placeholder="tags..."]').fill('work');
    await entryForm.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Original entry body')).toBeVisible();
    await expect(page.locator('[id^="entry-"]').first().getByText('#work')).toBeVisible();
    await expect.poll(() => state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      content: 'Original entry body',
      tags: ['work'],
      visibility: 'private',
    });
  });

  test('edits an existing journal entry inline', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [lifecycleEntry],
    });

    await page.goto('/journal');

    const firstEntry = page.locator('[id^="entry-"]').first();
    await expect(page.getByText(lifecycleEntry.content)).toBeVisible();
    await firstEntry.getByRole('button', { name: 'Edit' }).click();
    await firstEntry.locator('textarea').fill('Edited entry body');
    await firstEntry.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Edited entry body')).toBeVisible();
    await expect(page.getByText(lifecycleEntry.content)).toHaveCount(0);
    await expect.poll(() => state.entries[0]?.content).toBe('Edited entry body');
  });

  test('deletes an existing journal entry after confirmation', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [lifecycleEntry],
    });

    await page.goto('/journal');

    const firstEntry = page.locator('[id^="entry-"]').first();
    await expect(page.getByText(lifecycleEntry.content)).toBeVisible();
    await firstEntry.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.locator('div.fixed.inset-0.z-50').getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(lifecycleEntry.content)).toHaveCount(0);
    await expect.poll(() => state.entries.length).toBe(0);
  });
});