import { test, expect } from '@playwright/test';
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
    await expect(page.getByText('Successfully imported 1 entries (0 duplicates skipped)')).toBeVisible();
  });
});
