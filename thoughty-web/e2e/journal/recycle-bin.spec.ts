import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry, MockTrashedEntry } from '../support/mockApp.shared';

const harbor: MockEntry = {
  id: 501,
  date: '2026-10-21',
  index: 1,
  content: 'Walked by the harbor before work.',
  tags: ['walks'],
  visibility: 'private',
  diaryId: 2,
};

const market: MockEntry = {
  id: 502,
  date: '2026-10-21',
  index: 2,
  content: 'Bought figs at the market.',
  tags: [],
  visibility: 'private',
  diaryId: 1,
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

test.describe('Recycle bin', () => {
  test('keeps a deleted entry in the recycle bin and restores it to its diary', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [harbor, market] });
    await page.goto('/journal?diary=all');

    await page.locator('#entry-501').getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByText('Move this entry to the recycle bin? You can restore it from there for 30 days.')).toBeVisible();
    await page.locator('div.fixed.inset-0.z-50').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(harbor.content)).toHaveCount(0);

    await page.getByRole('button', { name: 'Recycle bin' }).click();
    await expect(page).toHaveURL(/\/recycle-bin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Recycle bin' })).toBeVisible();
    const card = page.getByRole('article', { name: 'October 21, 2026' });
    await expect(card.getByText(harbor.content)).toBeVisible();
    await expect(card.getByText('Returns to 🏠 Personal')).toBeVisible();
    await expect(card.getByText('Removed for good in 30 days')).toBeVisible();

    await card.getByRole('button', { name: 'Restore the entry of October 21, 2026' }).click();
    await expect(page.getByRole('status').getByText('1 entry back in your journal.')).toBeVisible();
    await expect(page.getByText('The recycle bin is empty. Entries you delete wait here for 30 days.')).toBeVisible();
    await expect.poll(() => state.entries.map((entry) => [entry.id, entry.index, entry.diaryId])).toEqual([[502, 1, 1], [501, 2, 2]]);

    await page.getByRole('button', { name: 'Back to journal' }).click();
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.locator('#entry-501').getByText(harbor.content)).toBeVisible();
  });

  test('moves bulk-deleted entries to the bin and brings them all back, the orphaned one to the default diary', async ({ page }) => {
    const orphan: MockTrashedEntry = {
      id: 503,
      date: '2026-10-01',
      index: 1,
      content: 'Notes from a diary that was later deleted.',
      tags: [],
      visibility: 'private',
      diaryId: 99,
      deletedAt: daysAgo(28),
    };
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [harbor, market], initialTrash: [orphan] });
    await page.goto('/journal?diary=all');

    await page.getByRole('button', { name: 'Select' }).click();
    await page.locator('#entry-501 input[type="checkbox"]').check();
    await page.locator('#entry-502 input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Move 2 entries to the recycle bin? You can restore them from there for 30 days.')).toBeVisible();
    await page.locator('div.fixed.inset-0.z-50').getByRole('button', { name: 'Delete' }).click();
    await expect.poll(() => state.trash.length).toBe(3);

    await page.goto('/recycle-bin');
    await expect(page.getByText('3 entries in the recycle bin')).toBeVisible();
    const orphanCard = page.getByRole('article', { name: 'October 1, 2026' });
    await expect(orphanCard.getByText('Its diary was deleted, so it returns to Work')).toBeVisible();
    await expect(orphanCard.getByText('Removed for good in 2 days')).toBeVisible();

    await page.getByRole('button', { name: 'Restore all' }).click();
    await expect(page.getByText(
      '3 entries back in your journal. 1 entry went to Work because the diary they came from no longer exists.',
    )).toBeVisible();
    await expect.poll(() => state.entries.find((entry) => entry.id === 503)?.diaryId).toBe(1);
    await expect(page.getByRole('button', { name: 'Restore all' })).toBeDisabled();
  });

  test('deletes an entry forever and empties the bin only after confirming', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialTrash: [
        { ...harbor, deletedAt: daysAgo(1) },
        { ...market, deletedAt: daysAgo(2) },
      ],
    });
    await page.goto('/recycle-bin');

    await page.getByRole('button', { name: 'Delete the entry of October 21, 2026 forever' }).first().click();
    const dialog = page.locator('div.fixed.inset-0.z-50');
    await expect(dialog.getByText('The entry of October 21, 2026 will be deleted with its history and files. This cannot be undone.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete forever' }).click();
    await expect(page.getByText('1 entry deleted for good.')).toBeVisible();
    await expect.poll(() => state.trash.map((entry) => entry.id)).toEqual([502]);

    await page.getByRole('button', { name: 'Empty recycle bin' }).click();
    await expect(dialog.getByText('1 entry will be deleted with their history and files. This cannot be undone.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => state.trash.length).toBe(1);

    await page.getByRole('button', { name: 'Empty recycle bin' }).click();
    await dialog.getByRole('button', { name: 'Empty recycle bin' }).click();
    await expect(page.getByText('The recycle bin is empty. Entries you delete wait here for 30 days.')).toBeVisible();
    await expect.poll(() => state.trash.length).toBe(0);
  });

  test('speaks French and fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      initialTrash: [{ ...harbor, deletedAt: daysAgo(0) }],
    });
    await page.goto('/recycle-bin');

    await expect(page.getByRole('heading', { level: 1, name: 'Corbeille' })).toBeVisible();
    await expect(page.getByText('1 entrée dans la corbeille')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restaurer l’entrée du 21 octobre 2026' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vider la corbeille' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
