import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockSavedSearch } from '../support/mockApp.routes.saved-searches';

const ENTRIES = [
  { id: 301, date: '2024-05-02', index: 1, content: 'Letter to mum about the garden', tags: ['family'], visibility: 'private' as const, diaryId: 1 },
  { id: 302, date: '2024-06-12', index: 1, content: 'Letter to mum from Lisbon', tags: ['travel'], visibility: 'private' as const, diaryId: 1 },
  { id: 303, date: '2024-06-20', index: 1, content: 'Work planning note', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
  { id: 304, date: '2024-07-01', index: 1, content: 'Family dinner by the river', tags: ['family'], visibility: 'private' as const, diaryId: 1 },
];

const savedSearch = (id: number, name: string, filters: Partial<MockSavedSearch['filters']>): MockSavedSearch => ({
  id,
  name,
  diaryId: null,
  filters: {
    search: '', searchMode: 'keyword', sort: 'relevance', tags: [], date: null,
    visibility: 'all', archiveStatus: 'active', favorites: false, mood: '', ...filters,
  },
  createdAt: '2026-10-27T09:00:00.000Z',
  updatedAt: '2026-10-27T09:00:00.000Z',
});

test.describe('Book sources', () => {
  test('makes a book from entries picked in the journal', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });

    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Select' }).click();
    for (const id of [301, 302, 303]) {
      await page.locator(`#entry-${id} input[type="checkbox"]`).check();
    }
    await page.getByRole('button', { name: 'Make a book' }).click();

    await expect(page).toHaveURL(/\/import-export\?.*section=book/);
    const bookSection = page.locator('#book-section');
    await expect(bookSection.getByLabel('Entries from')).toHaveValue('entries');
    await expect(bookSection.getByText('3 entries picked')).toBeVisible();
    await expect(bookSection.getByText('Letter to mum about the garden')).toBeVisible();

    await bookSection.getByRole('button', { name: 'Remove 2024-06-20 Work planning note from the book' }).click();
    await expect(bookSection.getByText('2 entries picked')).toBeVisible();
    await expect(bookSection.getByText('Work planning note')).toHaveCount(0);

    await bookSection.getByLabel('Title').fill('Letters to mum');
    await bookSection.getByLabel('Chapter type').selectOption('month');
    await bookSection.getByRole('button', { name: 'Preview Chapters' }).click();

    const outline = bookSection.locator('.preview-box');
    await expect(outline.getByText('May 2024')).toBeVisible();
    await expect(outline.getByText('June 2024')).toBeVisible();
    await expect.poll(() => state.lastBookPreviewRequestUrl?.searchParams.get('entryIds')).toBe('301,302');
    await expect.poll(() => state.lastBookPreviewRequestUrl?.searchParams.get('source')).toBe('entries');

    await bookSection.getByRole('button', { name: 'Save First Version' }).click();
    await expect(page.getByText('Book version 1 saved')).toBeVisible();
    await expect(bookSection.getByText('2 hand-picked entries')).toBeVisible();

    // The next version starts again from the entries the saved one holds
    await bookSection.getByRole('button', { name: 'Clear all' }).click();
    await expect(bookSection.getByText(/No entries picked yet/)).toBeVisible();
    await expect(bookSection.getByRole('button', { name: 'Preview Chapters' })).toBeDisabled();
    await bookSection.getByRole('button', { name: 'Use the entries of version 1' }).click();
    await expect(bookSection.getByText('2 entries picked')).toBeVisible();
    await bookSection.getByRole('button', { name: 'Create New Version' }).click();
    await expect(page.getByText('Book version 2 saved')).toBeVisible();
    await expect.poll(() => state.lastBookVersionRequestUrl?.searchParams.get('entryIds')).toBe('301,302');

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await bookSection.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });

  test('makes a book from a saved search, in one chapter', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      savedSearches: [
        savedSearch(1, 'Family', { tags: ['family'] }),
        savedSearch(2, 'Calm moments', { search: 'calm', searchMode: 'semantic' }),
      ],
    });

    await page.goto('/import-export?diary=1&section=book');
    const bookSection = page.locator('#book-section');
    await bookSection.getByLabel('Entries from').selectOption('savedSearch');
    await expect(bookSection.getByRole('option', { name: 'Calm moments (meaning search, not available)' })).toBeDisabled();
    await expect(bookSection.getByRole('button', { name: 'Preview Chapters' })).toBeDisabled();

    await bookSection.getByLabel('Saved search').selectOption({ label: 'Family' });
    await bookSection.getByLabel('Chapter type').selectOption('single');
    await bookSection.getByRole('button', { name: 'Preview Chapters' }).click();

    const outline = bookSection.locator('.preview-box');
    await expect(outline.locator('.book-chapter-list li')).toHaveCount(1);
    await expect(outline.locator('.book-chapter-list li')).toContainText('Family');
    await expect(outline.locator('.book-chapter-list li')).toContainText('2024-05-02 → 2024-07-01');
    await expect.poll(() => state.lastBookPreviewRequestUrl?.searchParams.get('savedSearchId')).toBe('1');
    await expect.poll(() => state.lastBookPreviewRequestUrl?.searchParams.has('diaryId')).toBe(false);

    await bookSection.getByRole('button', { name: 'Save First Version' }).click();
    await expect(bookSection.getByText('From the saved search Family')).toBeVisible();
  });

  test('deletes the book versions of a saved search with it, after saying how many go', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      savedSearches: [savedSearch(1, 'Family', { tags: ['family'] }), savedSearch(2, 'Work', { tags: ['work'] })],
    });

    await page.goto('/import-export?diary=1&section=book');
    const bookSection = page.locator('#book-section');
    await bookSection.getByLabel('Entries from').selectOption('savedSearch');
    await bookSection.getByLabel('Saved search').selectOption({ label: 'Family' });
    await bookSection.getByRole('button', { name: 'Save First Version' }).click();
    await bookSection.getByRole('button', { name: 'Create New Version' }).click();
    await expect(bookSection.getByText('From the saved search Family')).toHaveCount(2);
    await bookSection.getByLabel('Saved search').selectOption({ label: 'Work' });
    await bookSection.getByRole('button', { name: 'Save First Version' }).click();
    await expect(bookSection.getByText('From the saved search Work')).toBeVisible();

    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Saved searches' }).click();
    const dialog = page.getByRole('dialog', { name: 'Saved searches' });
    await dialog.getByRole('button', { name: 'Delete Family' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Delete saved search?' });
    await expect(confirm).toContainText('“Family” will be removed from your saved searches, along with 2 book versions saved from it.');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog.getByRole('status')).toHaveText('Deleted “Family”.');
    expect(state.bookVersions.map((version) => version.source)).toEqual([
      { kind: 'savedSearch', savedSearchId: 2, savedSearchName: 'Work' },
    ]);

    await dialog.getByRole('button', { name: 'Delete Work' }).click();
    await expect(confirm).toContainText('along with 1 book version saved from it. To keep it, download it first in Import/Export › Book.');
  });

  test('flags in French a picked entry that went to the recycle bin', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: ENTRIES });

    await page.goto('/journal?diary=all');
    await page.getByRole('button', { name: 'Sélectionner' }).click();
    await page.locator('#entry-304 input[type="checkbox"]').check();
    await page.locator('#entry-301 input[type="checkbox"]').check();
    // Deleted elsewhere while it is picked
    state.entries = state.entries.filter((entry) => entry.id !== 304);
    await page.getByRole('button', { name: 'Faire un livre' }).click();

    const bookSection = page.locator('#book-section');
    await expect(bookSection.getByText('2 entrées choisies')).toBeVisible();
    await expect(bookSection.getByText('Entrée n° 304')).toBeVisible();
    await expect(bookSection.getByText('N\'est plus disponible (supprimée ou dans la corbeille)')).toBeVisible();

    await bookSection.getByRole('button', { name: 'Aperçu des chapitres' }).click();
    await expect(page.getByText('Certaines entrées choisies n’existent plus ou sont dans la corbeille. Retirez-les et réessayez.')).toBeVisible();

    await bookSection.getByRole('button', { name: 'Retirer Entrée n° 304 du livre' }).click();
    await expect(bookSection.getByText('1 entrée choisie')).toBeVisible();
    await bookSection.getByRole('button', { name: 'Aperçu des chapitres' }).click();
    await expect(bookSection.locator('.book-chapter-list li')).toContainText('family');
  });
});
