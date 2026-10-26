import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Import/Export Feature', () => {
  test('exports from All Diaries as JSON and imports a JSON file through the UI', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/import-export?diary=all&section=export&format=json');
    await page.getByRole('button', { name: 'All Diaries' }).click();

    const exportSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Export' }) });
    const formatSelect = exportSection.locator('.format-select');
    await expect(formatSelect).toHaveValue('json');
    await page.getByRole('button', { name: 'Download', exact: true }).click();

    await expect.poll(() => state.lastExportRequestUrl?.searchParams.get('format')).toBe('json');
    await expect.poll(() => state.lastExportRequestUrl?.searchParams.get('diaryId') ?? null).toBeNull();
    await expect(page.getByText('Export downloaded successfully')).toBeVisible();

    await page.locator('#file-input').setInputFiles({
      name: 'all-diaries.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          entries: [
            {
              date: '2024-01-15',
              index: 1,
              tags: ['work'],
              content: 'Imported entry',
              format: 'plain',
              diary: 'Work',
            },
          ],
        }),
      ),
    });

    await expect(page.getByText('Preview Summary')).toBeVisible();
    await page.getByRole('button', { name: 'Import Entries' }).click();

    await expect.poll(() => {
      const payload = state.lastPreviewPayload as { diaryId?: number | null } | null;
      return payload?.diaryId ?? null;
    }).toBeNull();
    await expect.poll(() => {
      const payload = state.lastImportPayload as { diaryId?: number | null; skipDuplicates?: boolean } | null;
      return payload?.diaryId ?? null;
    }).toBeNull();
    await expect.poll(() => {
      const payload = state.lastImportPayload as { content?: string } | null;
      return Boolean(payload?.content?.includes('"diary":"Work"'));
    }).toBe(true);
    await expect(page.getByText('Successfully imported 1 entry (0 duplicates skipped)')).toBeVisible();
  });

  test('shows the reason the API gives for a refused import and a refused preview, in French', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    let refusePreview = false;
    await page.route('http://localhost:5173/api/io/preview', async (route) => {
      if (!refusePreview) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 413,
        json: { statusCode: 413, message: 'File too large. Maximum size is 10MB', error: 'Payload Too Large', code: 'IMPORT_FILE_TOO_LARGE' },
      });
    });
    await page.route('http://localhost:5173/api/io/import', (route) => route.fulfill({
      status: 400,
      json: { statusCode: 400, message: 'Too many entries. Maximum 10000 entries per import. Found 10001.', error: 'Bad Request', code: 'IMPORT_TOO_MANY_ENTRIES' },
    }));
    await page.goto('/import-export?section=import');

    const file = (name: string) => ({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ entries: [{ date: '2024-01-15', index: 1, tags: [], content: 'Imported entry', format: 'plain' }] })),
    });
    await page.locator('#file-input').setInputFiles(file('journal.json'));
    await expect(page.getByText('Aperçu', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Importer les entrées' }).click();

    await expect(page.getByText('Ce fichier contient plus d’entrées qu’un seul import ne le permet. Divisez-le et réessayez.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Importer les entrées' })).toBeEnabled();
    expect(state.entries).toHaveLength(0);

    refusePreview = true;
    await page.locator('#file-input').setInputFiles(file('big-journal.json'));
    await expect(page.getByText('Ce fichier dépasse la taille maximale d’import.')).toBeVisible();
    await expect(page.getByText('Échec de l\'aperçu du fichier')).toHaveCount(0);
  });

  test('shows the reason the API gives for a refused export, format save and delete all, in French', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    const diaryGone = { statusCode: 404, message: 'Diary not found', error: 'Not Found', code: 'DIARY_NOT_FOUND' };
    await page.route((url) => url.pathname === '/api/io/export', (route) => route.fulfill({ status: 404, json: diaryGone }));
    await page.route((url) => url.pathname === '/api/entries/all', (route) => route.fulfill({ status: 404, json: diaryGone }));
    await page.route('http://localhost:5173/api/io/format', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 400,
        json: { statusCode: 400, message: ['dateFormat must be a string'], error: 'Bad Request', code: 'VALIDATION_FAILED' },
      });
    });
    await page.goto('/import-export?section=export');

    await page.getByRole('button', { name: 'Télécharger', exact: true }).click();
    await expect(page.getByText('Ce journal est introuvable.')).toBeVisible();
    await expect(page.getByText('Export téléchargé avec succès')).toHaveCount(0);

    await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
    await expect(page.getByText('Certaines informations envoyées sont manquantes ou invalides.')).toBeVisible();

    const entriesBefore = state.entries.length;
    await page.getByRole('button', { name: 'Supprimer toutes les entrées' }).click();
    await page.getByRole('button', { name: 'Oui, tout supprimer' }).click();
    await expect(page.getByText('Ce journal est introuvable.')).toBeVisible();
    await expect(page.getByText('Échec de la suppression des entrées')).toHaveCount(0);
    expect(state.entries).toHaveLength(entriesBefore);
  });
});
