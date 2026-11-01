import { expect, test } from '../support/test';

import { buildZip } from '../../src/test/zipFixture';
import { setupMockApp } from '../support/mockApp';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const usec = (iso: string) => Date.parse(iso) * 1000;
const keepNote = (fields: Record<string, unknown>) =>
  JSON.stringify({ color: 'DEFAULT', isTrashed: false, isPinned: false, isArchived: false, ...fields });

/** A Google Takeout of Keep as Takeout zips it: each note as JSON with its HTML twin, and its pictures beside them. */
async function keepTakeout(): Promise<Buffer> {
  return Buffer.from(await buildZip([
    { name: 'Takeout/archive_browser.html', data: '<html></html>' },
    { name: 'Takeout/Keep/Labels.txt', data: 'Shopping\nTravel plans\n' },
    {
      name: 'Takeout/Keep/Groceries.json',
      data: keepNote({
        title: 'Groceries',
        textContent: 'For Saturday',
        listContent: [{ text: 'Milk', isChecked: false }, { text: 'Bread', isChecked: true }],
        labels: [{ name: 'Shopping' }],
        isPinned: true,
        color: 'YELLOW',
        // 11:00 UTC on 13 March: already 01:00 on 14 March on the writer's clock in Kiritimati
        createdTimestampUsec: usec('2024-03-13T11:00:00Z'),
        userEditedTimestampUsec: usec('2024-03-20T08:00:00Z'),
      }),
    },
    { name: 'Takeout/Keep/Groceries.html', data: '<html><body>Groceries</body></html>' },
    {
      name: 'Takeout/Keep/Trip ideas.json',
      data: keepNote({
        title: 'Trip ideas',
        textContent: 'Lisbon in spring',
        labels: [{ name: 'Travel plans' }],
        attachments: [{ filePath: '18e2c1f0a9b.5d3c2b1a.jpeg', mimetype: 'image/jpeg' }],
        isArchived: true,
        createdTimestampUsec: usec('2023-06-01T04:30:00Z'),
      }),
    },
    { name: 'Takeout/Keep/Trip ideas.html', data: '<html><body>Trip ideas</body></html>' },
    { name: 'Takeout/Keep/18e2c1f0a9b.5d3c2b1a.jpg', data: jpeg, store: true },
    { name: 'Takeout/Keep/Old list.json', data: keepNote({ textContent: 'Binned', isTrashed: true, createdTimestampUsec: usec('2022-01-01T00:00:00Z') }) },
  ]));
}

test.describe('Import Google Keep notes from Takeout', () => {
  test.use({ timezoneId: 'Pacific/Kiritimati' });

  test('imports a Takeout ZIP on each note’s creation day with labels, checklists and pictures, and skips it when imported again', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/import-export?diary=2&section=import');
    const panel = page.getByRole('region', { name: 'From another app' });
    const takeout = { name: 'takeout-20261101T120000Z-001.zip', mimeType: 'application/zip', buffer: await keepTakeout() };

    await panel.getByLabel('Google Keep').check();
    await expect(panel.getByText(/Choose the \.zip Google Takeout made of your Keep notes/)).toBeVisible();
    await panel.getByLabel('Choose an export').setInputFiles(takeout);

    await expect(panel.getByText('Found in your Google Keep export')).toBeVisible();
    await expect(panel.getByText('Entries', { exact: true }).locator('..')).toContainText('2');
    await expect(panel.getByText('Photos and recordings').locator('..')).toContainText('1');
    await expect(panel.getByRole('list', { name: 'Notes left out' })).toHaveText('In the bin: 1');
    await expect(panel.getByText('Written from June 1, 2023 to March 14, 2024')).toBeVisible();
    await expect(panel.getByText('The entries go into Personal, the diary chosen for this page.')).toBeVisible();
    await panel.getByRole('button', { name: 'Start the import' }).click();

    await expect(panel.getByText('Import finished')).toBeVisible();
    await expect(panel.getByText('New entries').locator('..')).toContainText('2');
    await expect(panel.getByText('Files attached').locator('..')).toContainText('1');
    const payload = state.appImport.entryPayloads[0] as { source: string; diaryId: number; entries: Array<Record<string, unknown>> };
    expect(payload).toEqual(expect.objectContaining({ source: 'keep', diaryId: 2, journalsAsDiaries: false }));
    expect(payload.entries).toEqual([
      {
        // The file name has a space: its day and a hash of the name, as the contract case sends it
        sourceId: '2023-06-01.d542f897f89e26d2',
        date: '2023-06-01',
        timeOfDay: '18:30',
        title: 'Trip ideas',
        content: '![](attachment:18e2c1f0a9b.5d3c2b1a.jpg)\n\nLisbon in spring',
        tags: ['Travel plans'],
        favorite: false,
        archived: true,
      },
      {
        sourceId: 'Groceries',
        date: '2024-03-14',
        timeOfDay: '01:00',
        title: 'Groceries',
        content: 'For Saturday\n\n- [ ] Milk\n- [x] Bread',
        tags: ['Shopping'],
        favorite: false,
        pinned: true,
      },
    ]);
    expect(state.appImport.uploads.map((upload) => [upload.name, upload.type])).toEqual([['18e2c1f0a9b.5d3c2b1a.jpg', 'image/jpeg']]);

    const trip = state.entries.find((entry) => entry.title === 'Trip ideas')!;
    const photo = trip.attachments![0]!;
    expect(trip).toEqual(expect.objectContaining({
      diaryId: 2,
      is_archived: true,
      is_pinned: false,
      format: 'markdown',
      visibility: 'private',
      content: `![](attachment:${photo.id})\n\nLisbon in spring`,
    }));
    expect(state.entries.find((entry) => entry.title === 'Groceries')).toEqual(expect.objectContaining({ is_pinned: true, is_archived: false }));

    await panel.getByRole('button', { name: 'Import another export' }).click();
    await panel.getByLabel('Google Keep').check();
    await panel.getByLabel('Choose an export').setInputFiles(takeout);
    await panel.getByRole('button', { name: 'Start the import' }).click();

    await expect(panel.getByText('Import finished')).toBeVisible();
    await expect(panel.getByText('Already imported').locator('..')).toContainText('2');
    await expect(panel.getByText('New entries').locator('..')).toContainText('0');
    expect(state.appImport.uploads).toHaveLength(1);
    expect(state.entries.filter((entry) => entry.title === 'Groceries' || entry.title === 'Trip ideas')).toHaveLength(2);
  });

  test('explains when the ZIP holds no Keep note, in French too', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/import-export?section=import');
    const panel = page.getByRole('region', { name: 'Depuis une autre application' });

    await panel.getByLabel('Google Keep').check();
    await panel.getByLabel('Choisir un export').setInputFiles({
      name: 'photos.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(await buildZip([{ name: 'Takeout/Google Photos/album.txt', data: 'Pas Keep' }])),
    });

    await expect(panel.getByRole('alert')).toHaveText(/Aucune note Google Keep dans ce fichier/);
  });
});
