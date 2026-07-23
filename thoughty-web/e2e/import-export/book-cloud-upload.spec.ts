import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

test.describe('Book cloud upload', () => {
  test('generates a configured book and uploads it to a connected provider', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/import-export?diary=1&section=book');

    const bookSection = page.locator('#book-section');
    await bookSection.getByLabel('Title').fill('Summer Notes');
    await bookSection.getByLabel('Format').selectOption('epub');
    await expect(bookSection.getByLabel('Cloud destination')).toHaveValue('google_drive');
    await bookSection.getByRole('button', { name: 'Upload Book' }).click();

    await expect(page.getByText('Uploaded thoughty_book_Summer Notes.epub successfully')).toBeVisible();
    await expect.poll(() => state.lastBookUploadRequestUrl?.searchParams.get('provider')).toBe('google_drive');
    await expect.poll(() => state.lastBookUploadRequestUrl?.searchParams.get('format')).toBe('epub');
    await expect.poll(() => state.lastBookUploadRequestUrl?.searchParams.get('title')).toBe('Summer Notes');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(bookSection.getByLabel('Cloud destination')).toBeVisible();
    const cloudRow = await bookSection.locator('.book-cloud-row').boundingBox();
    expect(cloudRow).not.toBeNull();
    expect((cloudRow?.x || 0) + (cloudRow?.width || 0)).toBeLessThanOrEqual(390);
  });
});
