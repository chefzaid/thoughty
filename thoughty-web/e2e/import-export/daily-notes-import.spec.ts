import { expect, test } from '../support/test';

import { buildZip } from '../../src/test/zipFixture';
import { setupMockApp } from '../support/mockApp';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** An Obsidian vault with a Logseq journals folder beside it, as a writer might zip them. */
async function dailyNotesArchive(): Promise<Buffer> {
  return Buffer.from(await buildZip([
    {
      name: 'Vault/Daily Notes/2024-03-14.md',
      data: '---\ntags: [journal]\n---\n# Thursday\n\nRain all day. #weather\n\n![[pier.png]]\n\nAs planned on [[2024-03-13]] with [[Marie]].',
    },
    { name: 'Vault/journals/2024_03_13.md', data: 'tags:: work\n\n- Planned the week\n\t- ![whiteboard](../assets/board.png)\n-\n' },
    { name: 'Vault/attachments/pier.png', data: png, store: true },
    { name: 'Vault/assets/board.png', data: png, store: true },
    { name: 'Vault/Ideas.md', data: 'Not a daily note' },
    { name: 'Vault/Daily Notes/2024-02-30.md', data: 'No such day' },
    { name: 'Vault/Daily Notes/2024-03-15.md', data: '' },
    { name: 'Vault/.obsidian/workspace.json', data: '{}' },
  ]));
}

test.describe('Import daily notes from Obsidian and Logseq', () => {
  test('imports a ZIP of daily notes into the page’s diary with tags and inline pictures, and skips it when imported again', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/import-export?diary=2&section=import');
    const panel = page.getByRole('region', { name: 'From another app' });
    const archive = { name: 'vault.zip', mimeType: 'application/zip', buffer: await dailyNotesArchive() };

    await panel.getByLabel('Daily notes (Obsidian, Logseq)').check();
    await panel.getByLabel('Choose an export').setInputFiles(archive);

    await expect(panel.getByText('Found in your daily notes')).toBeVisible();
    await expect(panel.getByText('Entries', { exact: true }).locator('..')).toContainText('2');
    await expect(panel.getByText('Notes left out').locator('..')).toContainText('3');
    await expect(panel.getByRole('list', { name: 'Notes left out' })).toContainText('Not named by a day: 2');
    await expect(panel.getByRole('list', { name: 'Notes left out' })).toContainText('Empty: 1');
    await expect(panel.getByText('Written from March 13, 2024 to March 14, 2024')).toBeVisible();
    await expect(panel.getByText('The entries go into Personal, the diary chosen for this page.')).toBeVisible();
    await panel.getByRole('button', { name: 'Start the import' }).click();

    await expect(panel.getByText('Import finished')).toBeVisible();
    await expect(panel.getByText('New entries').locator('..')).toContainText('2');
    await expect(panel.getByText('Files attached').locator('..')).toContainText('2');
    const payload = state.appImport.entryPayloads[0] as { source: string; diaryId: number; journalsAsDiaries: boolean; entries: Array<{ sourceId: string }> };
    expect(payload).toEqual(expect.objectContaining({ source: 'daily-notes', diaryId: 2, journalsAsDiaries: false }));
    // A path with a space is sent as its day and a hash; a plain path as it is
    expect(payload.entries.map((entry) => entry.sourceId)).toEqual(['Vault/journals/2024_03_13.md', expect.stringMatching(/^2024-03-14\.[0-9a-f]{16}$/)]);
    expect(state.appImport.uploads.map((upload) => [upload.name, upload.type])).toEqual([
      ['board.png', 'image/png'],
      ['pier.png', 'image/png'],
    ]);

    const thursday = state.entries.find((entry) => entry.date === '2024-03-14')!;
    const pier = thursday.attachments!.find((attachment) => attachment.original_filename === 'pier.png')!;
    expect(thursday).toEqual(expect.objectContaining({
      diaryId: 2,
      tags: ['journal', 'weather'],
      format: 'markdown',
      visibility: 'private',
      content: `# Thursday\n\nRain all day. #weather\n\n![pier.png](attachment:${pier.id})\n\nAs planned on [[2024-03-13]] with Marie.`,
    }));
    const wednesday = state.entries.find((entry) => entry.date === '2024-03-13')!;
    const board = wednesday.attachments![0]!;
    expect(wednesday).toEqual(expect.objectContaining({
      tags: ['work'],
      content: `- Planned the week\n\t- ![whiteboard](attachment:${board.id})`,
    }));

    await panel.getByRole('button', { name: 'Import another export' }).click();
    await panel.getByLabel('Daily notes (Obsidian, Logseq)').check();
    await panel.getByLabel('Choose an export').setInputFiles(archive);
    await panel.getByRole('button', { name: 'Start the import' }).click();

    await expect(panel.getByText('Import finished')).toBeVisible();
    await expect(panel.getByText('Already imported').locator('..')).toContainText('2');
    expect(state.appImport.uploads).toHaveLength(2);
    expect(state.entries.filter((entry) => entry.date === '2024-03-14')).toHaveLength(1);
  });

  test('explains when the ZIP holds no note named by a day, in French too', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/import-export?section=import');
    const panel = page.getByRole('region', { name: 'Depuis une autre application' });

    await panel.getByLabel('Notes quotidiennes (Obsidian, Logseq)').check();
    await panel.getByLabel('Choisir un export').setInputFiles({
      name: 'notes.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(await buildZip([{ name: 'Idées.md', data: 'Pas une note du jour' }, { name: '../2024-03-14.md', data: 'Hors archive' }])),
    });

    await expect(panel.getByRole('alert')).toHaveText(/Aucune note quotidienne dans ce fichier/);
  });
});
