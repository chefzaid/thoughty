import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

test.describe('Book versioning', () => {
  test('saves and downloads an immutable book version', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/import-export?diary=1&section=book');

    const bookSection = page.locator('#book-section');
    await expect(bookSection.getByText(/Save a version to preserve this book/)).toBeVisible();
    await bookSection.getByLabel('Title').fill('Summer Notes');
    await bookSection.getByLabel('Format').selectOption('md');
    await bookSection.getByRole('button', { name: 'Save First Version' }).click();

    await expect(page.getByText('Book version 1 saved')).toBeVisible();
    await expect(bookSection.getByText('Version 1')).toBeVisible();
    await expect(bookSection.getByText('2 chapters · 3 entries')).toBeVisible();
    await expect(bookSection.getByText(/3 new entries · 2 new chapters/)).toBeVisible();
    await expect(bookSection.getByRole('button', { name: 'Create New Version' })).toBeVisible();
    await expect.poll(() => state.lastBookVersionRequestUrl?.searchParams.get('diaryId')).toBe('1');
    await expect.poll(() => state.lastBookVersionRequestUrl?.searchParams.get('format')).toBe('md');

    await bookSection.getByRole('button', { name: 'Download version 1' }).click();
    await expect.poll(() => state.lastBookVersionDownloadId).toBe(101);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(bookSection.getByText('Version History')).toBeVisible();
    expect(await bookSection.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
});
