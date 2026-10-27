import { expect, test } from '../support/test';

import { buildZip } from '../../src/test/zipFixture';
import { setupMockApp } from '../support/mockApp';
import { MOCK_WEBM } from '../support/mockVideo';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

async function dayOneExport(): Promise<Buffer> {
  const journal = (entries: object[]) => JSON.stringify({ metadata: { version: '1.0' }, entries });
  return Buffer.from(await buildZip([
    {
      name: 'Journal.json',
      data: journal([
        {
          uuid: 'D1',
          creationDate: '2023-07-14T19:30:00Z',
          timeZone: 'Europe/Paris',
          text: 'Fireworks over the river\\.\n\n![](dayone-moment://P1)',
          tags: ['summer'],
          starred: true,
          photos: [{ identifier: 'P1', md5: 'aa11', type: 'jpeg' }],
          audios: [{ identifier: 'A1', md5: 'bb22', format: 'm4a' }],
          videos: [{ identifier: 'V1', md5: 'cc33', type: 'mov' }],
        },
      ]),
    },
    {
      name: 'Travel.json',
      data: journal([{ uuid: 'D2', creationDate: '2019-04-02T08:00:00Z', timeZone: 'Asia/Tokyo', text: 'Landed in Tokyo.' }]),
    },
    { name: 'photos/aa11.jpeg', data: jpeg, store: true },
    { name: 'audios/bb22.m4a', data: new Uint8Array([0, 0, 0, 24]), store: true },
    { name: 'videos/cc33.mov', data: MOCK_WEBM, store: true },
  ]));
}

test.describe('Import from other journaling apps', () => {
  test('imports a Day One export with its photos and videos into a diary per journal, and skips it when imported again', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    const videoUploads: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/attachments/upload')) videoUploads.push(request.url());
    });
    await page.goto('/import-export?section=import');
    const panel = page.getByRole('region', { name: 'From Day One or Journey' });
    const archive = { name: 'Day One export.zip', mimeType: 'application/zip', buffer: await dayOneExport() };

    await panel.getByLabel('Choose an export').setInputFiles(archive);

    await expect(panel.getByText('Found in your Day One export')).toBeVisible();
    await expect(panel.getByText('Written from April 2, 2019 to July 14, 2023')).toBeVisible();
    await expect(panel.getByLabel('A diary for each journal: Journal, Travel')).toBeChecked();
    await panel.getByRole('button', { name: 'Start the import' }).click();

    await expect(panel.getByText('Import finished')).toBeVisible();
    await expect(panel.getByText('New diaries: Travel, Journal')).toBeVisible();
    await expect.poll(() => state.appImport.uploads).toEqual([
      { entryId: expect.any(Number), name: 'aa11.jpeg', type: 'image/jpeg' },
      { entryId: expect.any(Number), name: 'bb22.m4a', type: 'audio/mp4' },
    ]);
    const fireworks = state.entries.find((entry) => entry.content.startsWith('Fireworks over the river.'));
    expect(fireworks).toEqual(expect.objectContaining({ date: '2023-07-14', tags: ['summer'], is_favorite: true, visibility: 'private', format: 'markdown' }));
    expect(state.appImport.uploads[0]!.entryId).toBe(fireworks!.id);
    // The photo Day One placed in the text was sent by name, then points at the stored file
    const sent = state.appImport.entryPayloads as Array<{ entries: Array<{ sourceId: string; content: string }> }>;
    expect(sent.flatMap((payload) => payload.entries).find((entry) => entry.sourceId === 'D1')!.content)
      .toBe('Fireworks over the river.\n\n![](attachment:aa11.jpeg)');
    const photo = fireworks!.attachments!.find((attachment) => attachment.original_filename === 'aa11.jpeg')!;
    expect(fireworks!.content).toBe(`Fireworks over the river.\n\n![](attachment:${photo.id})`);
    expect(state.diaries.map((diary) => diary.name)).toEqual(['Work', 'Personal', 'Travel', 'Journal']);
    // The video went on its own to the upload route, then the poster frame drawn from it
    await expect.poll(() => fireworks!.attachments!.find((attachment) => attachment.original_filename === 'cc33.mov')).toEqual(
      expect.objectContaining({ mimetype: 'video/quicktime', poster_filename: expect.stringMatching(/^poster-/) }),
    );
    await expect(panel.getByText('Files left out (missing or of another type)')).toHaveCount(0);

    await panel.getByRole('button', { name: 'Import another export' }).click();
    await panel.getByLabel('Choose an export').setInputFiles(archive);
    await panel.getByRole('button', { name: 'Start the import' }).click();

    await expect(panel.getByText('Import finished')).toBeVisible();
    await expect(panel.getByText('Already imported').locator('..')).toContainText('2');
    expect(state.appImport.uploads).toHaveLength(2);
    expect(videoUploads).toHaveLength(1);
    expect(state.entries.filter((entry) => entry.content.startsWith('Fireworks over the river.'))).toHaveLength(1);
  });

  test('imports a Journey export into the current diary, turning its HTML into Markdown', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    const archive = Buffer.from(await buildZip([
      {
        name: '1588325160000-ab.json',
        data: JSON.stringify({
          id: '1588325160000-ab',
          date_journal: Date.parse('2020-05-01T09:26:00Z'),
          timezone: 'Europe/London',
          type: 'html',
          text: '<p>A <strong>slow</strong> morning.</p><ul><li>coffee</li><li>garden</li></ul>',
          tags: ['home'],
          photos: ['1588325160000-ab-1.jpg'],
        }),
      },
      { name: '1588325160000-ab-1.jpg', data: jpeg, store: true },
    ]));
    await page.goto('/import-export?diary=2&section=import');
    const panel = page.getByRole('region', { name: 'From Day One or Journey' });

    await panel.getByLabel('Choose an export').setInputFiles({ name: 'journey.zip', mimeType: 'application/zip', buffer: archive });
    await expect(panel.getByText('Found in your Journey export')).toBeVisible();
    await expect(panel.getByLabel('Everything in Personal')).toBeChecked();
    await panel.getByRole('button', { name: 'Start the import' }).click();

    await expect(panel.getByText('Import finished')).toBeVisible();
    expect(state.appImport.entryPayloads[0]).toEqual(expect.objectContaining({ source: 'journey', diaryId: 2, journalsAsDiaries: false }));
    expect(state.entries.find((entry) => entry.tags.includes('home'))).toEqual(
      expect.objectContaining({ content: 'A **slow** morning.\n\n- coffee\n- garden', diaryId: 2 }),
    );
    expect(state.appImport.uploads.map((upload) => upload.name)).toEqual(['1588325160000-ab-1.jpg']);
  });

  test('explains when a file is not an export it knows', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/import-export?section=import');
    const panel = page.getByRole('region', { name: 'From Day One or Journey' });

    await panel.getByLabel('Choose an export').setInputFiles({ name: 'notes.zip', mimeType: 'application/zip', buffer: Buffer.from(await buildZip([{ name: 'notes.txt', data: 'hello' }])) });

    await expect(panel.getByRole('alert')).toHaveText(/not a Day One or Journey export/);
  });

  test('downloads everything as a Markdown folder with attachments', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/import-export?diary=all&section=export');

    await page.locator('#export-format').selectOption({ label: 'Markdown folder with attachments (.zip)' });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();

    expect((await download).suggestedFilename()).toBe('thoughty_export_2026-04-18.zip');
    expect(state.lastExportRequestUrl?.searchParams.get('format')).toBe('zip');
    await expect(page).toHaveURL(/format=zip/);
  });

  test('fits a phone screen while previewing an export', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/import-export?section=import');
    const panel = page.getByRole('region', { name: 'From Day One or Journey' });

    await panel.getByLabel('Choose an export').setInputFiles({ name: 'export.zip', mimeType: 'application/zip', buffer: await dayOneExport() });
    await expect(panel.getByRole('button', { name: 'Start the import' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
