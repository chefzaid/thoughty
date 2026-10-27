import { readFile } from 'node:fs/promises';
import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const placed: MockEntry = {
  id: 610,
  date: '2024-06-01',
  index: 1,
  format: 'markdown',
  tags: ['sea'],
  visibility: 'private',
  diaryId: 1,
  content: 'Before ![The pier](attachment:77) after',
  attachments: [{ id: 77, original_filename: 'pier.png', stored_filename: 'stored-pier', mimetype: 'image/png', size: 68 }],
};

test.describe('Inline images in exports and books', () => {
  test('keeps references in a JSON export, and an import of that file keeps their alt text', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [placed] });
    await page.goto('/import-export?diary=all&section=export&format=json');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const exported = await readFile(await (await download).path());
    expect(exported.toString()).toContain('Before ![The pier](attachment:77) after');
    expect(exported.toString()).not.toContain('stored-pier');

    await page.locator('#file-input').setInputFiles({ name: 'journal.json', mimeType: 'application/json', buffer: exported });
    await expect(page.getByText('Preview Summary')).toBeVisible();
    await page.getByRole('button', { name: 'Import Entries' }).click();
    await expect(page.getByText('Successfully imported 1 entry (0 duplicates skipped)')).toBeVisible();

    // The file carries no pictures, so the imported copy keeps the alt text where the picture stood
    expect(state.entries.map((entry) => entry.content)).toEqual(expect.arrayContaining(['Before The pier after']));
  });

  test('embeds a placed picture where the text places it when the book includes images', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [placed] });
    await page.goto('/import-export?diary=all&section=book');

    const bookSection = page.locator('#book-section');
    await bookSection.getByLabel('Format').selectOption('md');
    await bookSection.getByText('Include image attachments').click();
    const download = page.waitForEvent('download');
    await bookSection.getByRole('button', { name: 'Download Book' }).click();
    const book = (await readFile(await (await download).path())).toString();
    expect(book).toContain('Before ![The pier](data:image/png;base64,');
    expect(book).toContain(') after');

    await bookSection.getByText('Include image attachments').click();
    const plain = page.waitForEvent('download');
    await bookSection.getByRole('button', { name: 'Download Book' }).click();
    expect((await readFile(await (await plain).path())).toString()).toContain('Before The pier after');
  });
});
