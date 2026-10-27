import type { Request } from '@playwright/test';

import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { takeContractViolations } from '../support/mockApp.contract';

const ENTRIES = [
  { id: 1, date: '2024-05-01', index: 1, content: 'An idea for the garden', tags: ['ideas'], visibility: 'private' as const, diaryId: 1 },
  { id: 2, date: '2024-05-02', index: 1, content: 'Planning the week', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
];

const COVER = {
  name: 'garden-cover.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
};

/** The cover goes out as the browser builds a multipart upload: its own boundary, the file under `coverImage`. */
function expectCoverUpload(request: Request) {
  expect(request.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  expect(request.postDataBuffer()?.toString('latin1')).toContain('name="coverImage"; filename="garden-cover.png"');
}

test.describe('Book cover image', () => {
  test('sends the chosen cover with Download Book, Preview Book and Save First Version', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    const coverRequests: Request[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/books/')) coverRequests.push(request);
    });

    await page.goto('/import-export?diary=1&section=book');
    const bookSection = page.locator('#book-section');
    await bookSection.getByLabel('Title').fill('Garden Notes');
    await bookSection.getByLabel('Weave thoughts into flowing prose with AI').uncheck();
    await bookSection.getByLabel('Format').selectOption('epub');
    await bookSection.getByLabel('Choose cover image').setInputFiles(COVER);
    await expect(bookSection.getByAltText('Cover image preview')).toBeVisible();

    const download = page.waitForEvent('download');
    await bookSection.getByRole('button', { name: 'Download Book' }).click();
    expect((await download).suggestedFilename()).toBe('thoughty_book_Garden_Notes_2026-08-01.epub');
    await expect(page.getByText('Book downloaded successfully')).toBeVisible();

    await bookSection.getByRole('button', { name: 'Preview Book' }).click();
    const dialog = page.getByRole('dialog', { name: 'Book preview' });
    await expect(dialog.getByRole('toolbar').getByRole('status')).toHaveText(/^Page 1 of \d+$/);
    await dialog.getByRole('button', { name: 'Close' }).click();

    await bookSection.getByRole('button', { name: 'Save First Version' }).click();
    await expect(page.getByText('Book version 1 saved')).toBeVisible();

    expect(coverRequests.map((request) => new URL(request.url()).pathname)).toEqual([
      '/api/books/export',
      '/api/books/export',
      '/api/books/versions',
    ]);
    coverRequests.forEach(expectCoverUpload);
    expect(state.bookExportRequestUrls.map((url) => url.searchParams.get('format'))).toEqual(['epub', null]);
  });

  test('the mock API refuses a cover sent under a JSON content type, as the API does', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/import-export?diary=1&section=book');

    const answer = await page.evaluate(async () => {
      const body = new FormData();
      body.append('coverImage', new Blob(['png'], { type: 'image/png' }), 'cover.png');
      const response = await fetch('/api/books/export?format=pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      return { status: response.status, body: await response.json() as { code?: string } };
    });

    expect(answer).toEqual({ status: 400, body: expect.objectContaining({ code: 'VALIDATION_FAILED' }) });
    // The guard also fails whichever test sent it; this one sent it on purpose
    expect(takeContractViolations()).toEqual(['POST /api/books/export sends its multipart body as application/json']);
  });
});
