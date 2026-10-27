import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockSavedSearch } from '../support/mockApp.routes.saved-searches';

const ENTRIES = [
  { id: 201, date: '2019-07-14', index: 1, content: 'Picnic with the family by the lake', tags: ['family'], visibility: 'private' as const, is_favorite: true, diaryId: 2 },
  { id: 202, date: '2019-07-14', index: 2, content: 'Family dinner, nothing special', tags: ['family'], visibility: 'private' as const, diaryId: 2 },
  { id: 203, date: '2024-04-17', index: 1, content: 'Work planning note', tags: ['work'], visibility: 'public' as const, is_favorite: true, diaryId: 1 },
];

const FAMILY_FAVORITES: MockSavedSearch = {
  id: 1,
  name: 'Family favorites',
  diaryId: 2,
  filters: {
    search: '', searchMode: 'keyword', sort: 'relevance', tags: ['family'], date: null,
    visibility: 'all', archiveStatus: 'active', favorites: true, mood: '',
  },
  createdAt: '2026-10-27T09:00:00.000Z',
  updatedAt: '2026-10-27T09:00:00.000Z',
};

async function openSavedSearches(page: Page, name: string | RegExp = /^Saved searches/) {
  await page.getByRole('button', { name }).click();
  const dialog = page.getByRole('dialog', { name: 'Saved searches' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Saved searches', () => {
  test('saves the current filters under a name and brings them back in one click, with a shareable URL', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');

    await page.getByPlaceholder('Search content...').fill('family');
    await page.getByTitle('Show favorites only').click();
    await expect(page.getByText('Family dinner, nothing special')).toHaveCount(0);
    await expect(page.getByText('Picnic with the family by the lake')).toBeVisible();

    let dialog = await openSavedSearches(page);
    await expect(dialog.getByText('No saved searches yet.', { exact: false })).toBeVisible();
    await expect(dialog.getByText('Saves: All Diaries · “family” · Favorites')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Family picnics');
    await dialog.getByRole('button', { name: 'Save current filters' }).click();
    await expect(dialog.getByRole('status')).toHaveText('Saved “Family picnics”.');
    await expect(dialog.getByRole('button', { name: 'Family picnics', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(page).toHaveURL(/\/journal\?diary=all&view=1$/);
    await page.keyboard.press('Escape');

    const trigger = page.getByRole('button', { name: 'Saved searches: Family picnics' });
    await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: 'Reset Filters' }).click();
    await expect(page.getByText('Family dinner, nothing special')).toBeVisible();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);

    dialog = await openSavedSearches(page);
    await dialog.getByRole('button', { name: 'Family picnics', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByPlaceholder('Search content...')).toHaveValue('family');
    await expect(page.getByText('Family dinner, nothing special')).toHaveCount(0);
    await expect(page).toHaveURL(/\/journal\?diary=all&view=1$/);

    // The address opens the same search again.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Saved searches: Family picnics' })).toBeVisible();
    await expect(page.getByPlaceholder('Search content...')).toHaveValue('family');
    await expect(page.getByText('Picnic with the family by the lake')).toBeVisible();
    await expect(page.getByText('Family dinner, nothing special')).toHaveCount(0);
  });

  test('opens a saved search in its diary, renames it, and deletes it after confirming', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, savedSearches: [FAMILY_FAVORITES] });
    await page.goto('/journal?diary=1');

    let dialog = await openSavedSearches(page);
    const family = dialog.getByRole('button', { name: 'Family favorites', exact: true });
    await expect(family).toHaveAccessibleDescription('Personal · family · Favorites');
    await family.click();
    await expect(page).toHaveURL(/\/journal\?diary=2&view=1$/);
    await expect(page.getByText('Picnic with the family by the lake')).toBeVisible();
    await expect(page.getByText('Work planning note')).toHaveCount(0);

    dialog = await openSavedSearches(page, 'Saved searches: Family favorites');
    await dialog.getByRole('button', { name: 'Rename Family favorites' }).click();
    const rename = dialog.getByRole('textbox', { name: 'New name for Family favorites' });
    await expect(rename).toBeFocused();
    await rename.fill('Family, summer 2019');
    await rename.press('Enter');
    await expect(dialog.getByRole('status')).toHaveText('Renamed to “Family, summer 2019”.');
    await expect(dialog.getByRole('button', { name: 'Rename Family, summer 2019' })).toBeFocused();

    await dialog.getByRole('button', { name: 'Delete Family, summer 2019' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Delete saved search?' });
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog.getByRole('status')).toHaveText('Deleted “Family, summer 2019”.');
    await expect(dialog.getByText('No saved searches yet.', { exact: false })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused();
    await expect(page).toHaveURL(/\/journal\?diary=2$/);
  });

  test('says when a link names a saved search that no longer exists', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all&view=7');

    await expect(page.getByText('That saved search no longer exists. The journal shows your current filters instead.')).toBeVisible();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    await expect(page.getByText('Family dinner, nothing special')).toBeVisible();
  });

  test('refuses a name already in use and speaks French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, savedSearches: [FAMILY_FAVORITES], config: { language: 'fr' } });
    await page.goto('/journal?diary=all');

    await page.getByRole('button', { name: 'Recherches enregistrées' }).click();
    const dialog = page.getByRole('dialog', { name: 'Recherches enregistrées' });
    await expect(dialog.getByText('1 sur 50 enregistrées')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Nom', exact: true }).fill('FAMILY FAVORITES');
    await dialog.getByRole('button', { name: 'Enregistrer les filtres actuels' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Vous avez déjà une recherche enregistrée portant ce nom.');
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`passes an accessibility scan in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, savedSearches: [FAMILY_FAVORITES], config: { theme } });
      await page.goto('/journal?diary=all');
      const dialog = await openSavedSearches(page);
      await dialog.getByRole('button', { name: 'Rename Family favorites' }).click();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('[role="dialog"]')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }
});
