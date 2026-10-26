import { test, expect, type Page } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

const entry = {
  id: 10,
  date: '2024-04-18',
  index: 1,
  content: 'A quiet morning reflection about focus',
  tags: ['focus'],
  visibility: 'private' as const,
  diaryId: 1,
};

/** Answers the given entry endpoint as if the API were down. */
async function failEntryRequests(page: Page, path: string) {
  await page.route(`http://localhost:5173${path}`, (route) => route.fulfill({ status: 503, json: {} }));
}

test.describe('Entry action messages', () => {
  test('asks for text before saving an empty entry, in French', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });

    await page.goto('/journal');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText('Veuillez saisir du texte');
    expect(state.entries).toHaveLength(0);
  });

  test('reports a failed bulk action in a toast, in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: [entry] });
    await failEntryRequests(page, '/api/entries/bulk');

    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Sélectionner', exact: true }).click();
    await page.locator('#entry-10 input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Archiver', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText('L’opération groupée a échoué.');
    await expect(page.getByText(entry.content)).toBeVisible();
  });

  test('reports a failed delete in a toast, in English', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [entry] });
    await failEntryRequests(page, `/api/entries/${entry.id}`);

    await page.goto('/journal');
    const firstEntry = page.locator('[id^="entry-"]').first();
    await firstEntry.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.locator('div.fixed.inset-0.z-50').getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('alert')).toHaveText('Failed to delete entry.');
    await expect(page.getByText(entry.content)).toBeVisible();
    expect(state.entries).toHaveLength(1);
  });
});
