import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const day = (id: number, index: number, content: string): MockEntry => ({
  id,
  date: '2026-10-21',
  index,
  content,
  tags: [],
  visibility: 'private',
  diaryId: 1,
});

const morning = day(601, 1, 'Coffee on the balcony at dawn.');
const noon = day(602, 2, 'Lunch with Sam by the river.');
const evening = day(603, 3, 'Read two chapters before bed.');
const entries = [morning, noon, evening];

const dialog = (page: Page) => page.locator('div.fixed.inset-0.z-50');
const undoButton = (page: Page, name = 'Undo') => page.getByRole('button', { name, exact: true });
const announcement = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });
const dayOrder = (state: { entries: MockEntry[] }) => state.entries.map((entry) => [entry.id, entry.index]);

async function deleteWithPointer(page: Page, entryId: number) {
  await page.locator(`#entry-${entryId}`).getByLabel('More actions').click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await dialog(page).getByRole('button', { name: 'Delete' }).click();
}

test.describe('Undo after delete', () => {
  test('puts a deleted entry back where it was in its day', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal');

    await deleteWithPointer(page, noon.id);
    await expect(announcement(page, 'Entry moved to the recycle bin')).toHaveCount(1);
    await expect(page.getByText(noon.content)).toHaveCount(0);
    await expect.poll(() => state.trash.map((entry) => entry.id)).toEqual([noon.id]);
    // Someone using a pointer keeps their place: the toast does not take focus
    await expect(undoButton(page)).toBeVisible();
    await expect(undoButton(page)).not.toBeFocused();

    await undoButton(page).click();
    await expect(page.getByRole('alert')).toHaveText('1 entry back in your journal.');
    await expect(undoButton(page)).toHaveCount(0);
    await expect(page.locator(`#entry-${noon.id}`).getByText(noon.content)).toBeVisible();
    await expect.poll(() => dayOrder(state)).toEqual([[601, 1], [602, 2], [603, 3]]);
    expect(state.trash).toHaveLength(0);
  });

  test('counts the entries of a bulk delete and brings exactly those back in their order', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal');

    await page.getByRole('button', { name: 'Select' }).click();
    await page.locator(`#entry-${evening.id} input[type="checkbox"]`).check();
    await page.locator(`#entry-${morning.id} input[type="checkbox"]`).check();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Delete' }).click();

    await expect(announcement(page, '2 entries moved to the recycle bin')).toHaveCount(1);
    await expect.poll(() => dayOrder(state)).toEqual([[602, 1]]);

    await undoButton(page).click();
    await expect(page.getByRole('alert')).toHaveText('2 entries back in your journal.');
    await expect.poll(() => dayOrder(state)).toEqual([[601, 1], [602, 2], [603, 3]]);
  });

  test('stays while the pointer is on it, then goes and leaves the entry in the recycle bin', async ({ page }) => {
    await page.clock.install();
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal');

    await deleteWithPointer(page, morning.id);
    await expect(undoButton(page)).toBeVisible();
    await undoButton(page).hover();
    await page.clock.runFor(30_000);
    await expect(undoButton(page)).toBeVisible();

    await page.mouse.move(0, 0);
    await page.clock.runFor(9_000);
    await expect(undoButton(page)).toBeVisible();
    await page.clock.runFor(1_500);
    await expect(undoButton(page)).toHaveCount(0);
    expect(state.trash.map((entry) => entry.id)).toEqual([morning.id]);
  });

  test('takes a keyboard user to Undo, which waits for them, and hands focus back to the journal', async ({ page }) => {
    await page.clock.install();
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal');

    await page.locator(`#entry-${evening.id}`).getByLabel('More actions').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Delete' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await expect(undoButton(page)).toBeFocused();
    await expect(page.getByText(evening.content)).toHaveCount(0);
    await page.clock.runFor(60_000);
    await expect(undoButton(page)).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('1 entry back in your journal.');
    await expect(page.locator('#main-content')).toBeFocused();
    await expect.poll(() => dayOrder(state)).toEqual([[601, 1], [602, 2], [603, 3]]);
  });

  test('closes on Escape without restoring anything', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/journal');

    await page.locator(`#entry-${morning.id}`).getByLabel('More actions').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Delete' }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(undoButton(page)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(undoButton(page)).toHaveCount(0);
    await expect(page.locator('#main-content')).toBeFocused();
    expect(state.trash.map((entry) => entry.id)).toEqual([morning.id]);
  });

  test('says why, in French, when the entry is no longer in the recycle bin', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      initialEntries: entries,
    });
    await page.goto('/journal');

    await page.locator(`#entry-${noon.id}`).getByLabel("Plus d'actions").click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();
    await dialog(page).getByRole('button', { name: 'Supprimer' }).click();
    await expect(announcement(page, 'Entrée placée dans la corbeille')).toHaveCount(1);

    // Emptied from another tab in the meantime
    state.trash = [];
    await undoButton(page, 'Annuler').click();
    await expect(page.getByRole('alert')).toHaveText('Ces entrées ne sont plus dans la corbeille.');
    await expect(page.getByText(noon.content)).toHaveCount(0);
  });
});
