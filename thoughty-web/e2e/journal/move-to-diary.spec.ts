import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';
import type { MockEntry, SetupMockAppOptions } from '../support/mockApp.shared';

const diaries = [
  mockDiary({ id: 1, name: 'Work', icon: '💼', color: '#3B82F6', isDefault: true }),
  mockDiary({ id: 2, name: 'Travel', icon: '✈️', color: '#22C55E' }),
  mockDiary({ id: 3, name: 'Family', icon: '🏠', color: '#A855F7' }),
];
const packing: MockEntry = { id: 901, date: '2026-10-02', index: 1, title: 'Packing list', content: 'Passport, charger, the blue scarf.', tags: ['trip'], visibility: 'public', diaryId: 1 };
const standup: MockEntry = { id: 902, date: '2026-10-01', index: 1, content: 'Standup notes for the week.', tags: ['work'], visibility: 'private', diaryId: 1 };

async function openJournal(page: Page, path: string, config: SetupMockAppOptions['config'] = {}) {
  const app = await setupMockApp(page, { startAuthenticated: true, diaries, initialEntries: [packing, standup], config });
  await page.goto(path);
  return app;
}

async function axeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

test.describe('Move one entry to another diary', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`moves an entry from More actions with the keyboard; it leaves the diary shown, in the ${theme} theme`, async ({ page }) => {
      const { state } = await openJournal(page, '/journal?diary=1', { theme });
      const card = page.locator('#entry-901');

      await card.getByRole('button', { name: 'More actions' }).click();
      await card.getByRole('menuitem', { name: 'Move to diary…' }).click();
      const dialog = page.getByRole('dialog', { name: 'Move to diary' });
      await expect(dialog).toContainText('October 2, 2026 · Packing list');
      await expect(dialog).toContainText('Now in 💼 Work');
      await expect(dialog.getByRole('radio')).toHaveCount(2);
      await expect(dialog.getByRole('radio', { name: '✈️ Travel' })).toBeFocused();
      expect(await axeViolations(page, '[role="dialog"]')).toEqual([]);

      await page.keyboard.press('Space');
      await expect(dialog.getByRole('radio', { name: '✈️ Travel' })).toBeChecked();
      const moved = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/entries/bulk'));
      await page.keyboard.press('Enter');
      expect((await moved).postDataJSON()).toEqual({ ids: [901], action: 'move', diaryId: 2 });

      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('status').filter({ hasText: 'Entry moved to Travel. It no longer shows in this diary.' })).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Open Travel' }))
        .toHaveAccessibleDescription('Entry moved to Travel. It no longer shows in this diary.');
      await expect(page.locator('#entry-901')).toHaveCount(0);
      await expect(page.locator('#entry-902')).toBeVisible();
      // Only the diary changes, as with the bulk move
      expect(state.entries.find((entry) => entry.id === 901)).toMatchObject({ diaryId: 2, visibility: 'public', tags: ['trip'], title: 'Packing list' });

      // The card the keyboard was on is gone, so focus is on the notice's way to the entry's new diary
      const openTravel = page.getByRole('button', { name: 'Open Travel' });
      await expect(openTravel).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/[?&]diary=2(&|$)/);
      await expect(page.locator('#entry-901')).toBeVisible();
    });
  }

  test('keeps the entry in All diaries, names its new diary, and Escape gives focus back to the menu', async ({ page }) => {
    await openJournal(page, '/journal?diary=all');
    const card = page.locator('#entry-901');
    const menuButton = card.getByRole('button', { name: 'More actions' });

    await menuButton.click();
    await card.getByRole('menuitem', { name: 'Move to diary…' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(menuButton).toBeFocused();

    await menuButton.click();
    await card.getByRole('menuitem', { name: 'Move to diary…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Move to diary' });
    await dialog.getByRole('radio', { name: '🏠 Family' }).check();
    await dialog.getByRole('button', { name: 'Move' }).click();

    await expect(page.getByRole('alert')).toHaveText('Entry moved to Family.');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Family');
    await expect(menuButton).toBeFocused();
  });

  test('moves an entry from the editor’s diary field along with its other changes', async ({ page }) => {
    const { state } = await openJournal(page, '/journal?diary=1');
    const card = page.locator('#entry-901');

    await card.getByRole('button', { name: 'Edit' }).click();
    const diaryField = card.getByRole('combobox', { name: 'Diary' });
    await expect(diaryField).toHaveValue('1');
    await card.getByRole('textbox', { name: 'Title (optional)' }).fill('Packing list for Lisbon');
    await diaryField.selectOption({ label: '✈️ Travel' });
    await card.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('button', { name: 'Open Travel' }))
      .toHaveAccessibleDescription('Entry moved to Travel. It no longer shows in this diary.');
    await expect(page.locator('#entry-901')).toHaveCount(0);
    expect(state.entries.find((entry) => entry.id === 901)).toMatchObject({ diaryId: 2, title: 'Packing list for Lisbon', visibility: 'public' });
    await page.getByRole('button', { name: 'Open Travel' }).click();
    await expect(page.locator('#entry-901')).toContainText('Packing list for Lisbon');
  });

  test('speaks French', async ({ page }) => {
    await openJournal(page, '/journal?diary=all', { language: 'fr' });
    const card = page.locator('#entry-901');

    await card.getByRole('button', { name: "Plus d'actions" }).click();
    await card.getByRole('menuitem', { name: 'Déplacer vers un journal…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Déplacer vers un journal' });
    await expect(dialog).toContainText('Actuellement dans 💼 Work');
    await dialog.getByRole('button', { name: 'Déplacer' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Choisissez le journal vers lequel déplacer l’entrée.');
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('offers no move to a writer with a single diary', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, diaries: [diaries[0]!], initialEntries: [packing] });
    await page.goto('/journal?diary=all');
    await page.locator('#entry-901').getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Move to diary…' })).toHaveCount(0);
    await page.locator('#entry-901').getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('combobox', { name: 'Diary' })).toHaveCount(0);
  });
});
