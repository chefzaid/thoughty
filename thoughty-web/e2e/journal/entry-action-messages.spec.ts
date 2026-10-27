import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { fulfillJson } from '../support/mockApp.route-utils';

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
  await page.route(`http://localhost:5173${path}`, (route) => fulfillJson(route, {}, { status: 503 }));
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

  test('reports a failed task tick in a toast and unticks it again, in French', async ({ page }) => {
    const errands = { ...entry, id: 11, content: '- [ ] Call the bank', format: 'markdown' as const };
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: [errands] });
    // The API cannot be reached at all
    await page.route(`http://localhost:5173/api/entries/${errands.id}/tasks`, (route) => route.abort('connectionrefused'));

    await page.goto('/journal');
    const task = page.locator('#entry-11').getByRole('checkbox', { name: 'Call the bank' });
    await task.click();

    await expect(page.getByRole('alert')).toHaveText('Échec de la mise à jour de la tâche.');
    await expect(task).not.toBeChecked();
  });

  test('reports a task tick the API answered without a message in a toast, in English', async ({ page }) => {
    const errands = { ...entry, id: 12, content: '- [ ] Water the plants', format: 'markdown' as const };
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [errands] });
    await failEntryRequests(page, `/api/entries/${errands.id}/tasks`);

    await page.goto('/journal');
    const task = page.locator('#entry-12').getByRole('checkbox', { name: 'Water the plants' });
    await task.click();

    await expect(page.getByRole('alert')).toHaveText('Failed to update the task.');
    await expect(task).not.toBeChecked();
  });

  test('reports why pinning failed in a toast, in English', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [entry] });
    await page.route(`http://localhost:5173/api/entries/${entry.id}/pinned`, (route) =>
      fulfillJson(route, { statusCode: 400, message: 'You can pin at most 3 entries.', error: 'Bad Request' }, { status: 400 }));

    await page.goto('/journal');
    await page.locator('#entry-10').getByTitle('Pin entry').click();

    await expect(page.getByRole('alert')).toHaveText('You can pin at most 3 entries.');
  });
});
