import { expect, test, type Locator } from '../support/test';

import { setupMockApp } from '../support/mockApp';

const SEALED = { openAt: '2030-01-01T09:00:00.000Z', sealedAt: '2025-08-01T09:00:00.000Z', openedAt: null };
const ENTRIES = [
  { id: 501, date: '2024-03-10', index: 1, content: 'Picnic with @Marie in the park', tags: ['family'], visibility: 'private' as const, diaryId: 1 },
  { id: 502, date: '2024-11-02', index: 1, content: 'Paul fixed the bike', tags: ['home'], visibility: 'private' as const, diaryId: 1 },
  { id: 503, date: '2025-05-20', index: 1, content: 'Birthday call with @Marie', tags: [], visibility: 'private' as const, diaryId: 2, is_archived: true },
  { id: 504, date: '2025-08-01', index: 1, content: 'A letter for @Marie to open later', tags: [], visibility: 'private' as const, diaryId: 1, capsule: SEALED },
  { id: 505, date: '2025-09-09', index: 1, content: 'Work notes, nothing about family', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
];
const TRASHED = [
  { id: 506, date: '2025-02-02', index: 1, content: 'Old draft about @Marie', tags: [], visibility: 'private' as const, diaryId: 1, deletedAt: '2026-10-01T09:00:00.000Z' },
];

/** The text of every page of the open book preview, page by page. */
async function readEveryPage(dialog: Locator): Promise<string[]> {
  const status = dialog.getByRole('toolbar').getByRole('status');
  await expect(status).toHaveText(/^Page 1 of \d+$/);
  const total = Number((await status.textContent())!.split(' of ')[1]);
  const pages: string[] = [];
  for (let page = 1; page <= total; page += 1) {
    await expect(status).toHaveText(`Page ${page} of ${total}`);
    pages.push(await dialog.getByTestId('book-preview-page-text').innerText());
    if (page < total) await dialog.getByRole('button', { name: 'Next page' }).click();
  }
  return pages;
}

test.describe('A book about someone', () => {
  test("makes a book of every entry that mentions a person, from their view", async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, initialTrash: TRASHED });
    const marie = state.people.find((person) => person.name === 'Marie')!;

    await page.goto(`/journal?diary=all&person=${marie.id}`);
    const banner = page.getByRole('region', { name: 'Entries that mention Marie' });
    await banner.getByRole('button', { name: 'Make a book about Marie' }).click();

    // The person's view is kept as a saved search, so the book has its own history
    await expect(page).toHaveURL(/\/import-export\?diary=all&section=book/);
    expect(state.savedSearches).toHaveLength(1);
    const [saved] = state.savedSearches;
    expect(saved).toEqual(expect.objectContaining({ name: 'Marie', diaryId: null }));
    expect(saved!.filters).toEqual(expect.objectContaining({ personId: marie.id, archiveStatus: 'all', tags: [], search: '' }));

    const bookSection = page.locator('#book-section');
    await expect(bookSection.getByLabel('Entries from')).toHaveValue('savedSearch');
    await expect(bookSection.getByLabel('Saved search')).toHaveValue(String(saved!.id));
    await expect(bookSection.getByText(/Every entry that mentions Marie, from your saved search “Marie”/)).toBeVisible();
    await expect(bookSection.getByLabel('Title')).toHaveValue('Marie');
    await expect(bookSection.getByRole('group', { name: 'Book pages' }).getByLabel('Dedication')).toHaveValue('For Marie');
    await expect(bookSection.getByLabel('Chapter type')).toHaveValue('year');
    await bookSection.getByLabel('Weave thoughts into flowing prose with AI').uncheck();

    await bookSection.getByRole('button', { name: 'Preview Chapters' }).click();
    const chapters = bookSection.locator('.preview-box .book-chapter-list li');
    await expect(chapters).toHaveCount(2);
    await expect(chapters.nth(0)).toContainText('2024');
    await expect(chapters.nth(1)).toContainText('2025');

    await bookSection.getByRole('button', { name: 'Preview Book' }).click();
    const dialog = page.getByRole('dialog', { name: 'Book preview' });
    const book = (await readEveryPage(dialog)).join('\n');
    expect(book).toContain('For Marie');
    expect(book).toContain('Picnic with @Marie in the park');
    // Archived entries mention her too; sealed capsules, the recycle bin and everyone else stay out
    expect(book).toContain('Birthday call with @Marie');
    for (const text of ['Paul fixed the bike', 'A letter for @Marie', 'Old draft about @Marie', 'Work notes']) {
      expect(book).not.toContain(text);
    }
    const sent = state.bookExportRequestUrls.at(-1)!.searchParams;
    expect(sent.get('savedSearchId')).toBe(String(saved!.id));
    expect(sent.get('title')).toBe('Marie');
    expect(sent.get('dedication')).toBe('For Marie');
    expect(sent.get('chapterMode')).toBe('year');
    await dialog.getByRole('button', { name: 'Close' }).click();

    // The suggestions are the writer's to change: no dedication, chapters by month
    await bookSection.getByRole('group', { name: 'Book pages' }).getByLabel('Dedication').fill('');
    await bookSection.getByLabel('Chapter type').selectOption('month');
    await bookSection.getByRole('button', { name: 'Preview Book' }).click();
    await expect(dialog.getByRole('toolbar').getByRole('status')).toHaveText(/^Page 1 of \d+$/);
    const edited = state.bookExportRequestUrls.at(-1)!.searchParams;
    expect(edited.has('dedication')).toBe(false);
    expect(edited.get('chapterMode')).toBe('month');
    await dialog.getByRole('button', { name: 'Close' }).click();

    // A second book about her reuses the same saved search
    await page.goto(`/journal?diary=all&person=${marie.id}`);
    await banner.getByRole('button', { name: 'Make a book about Marie' }).click();
    await expect(bookSection.getByLabel('Saved search')).toHaveValue(String(saved!.id));
    expect(state.savedSearches).toHaveLength(1);
  });

  test('says why when no search can be saved for the book, and stays on the person', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: ENTRIES,
      config: { language: 'fr' },
    });
    const marie = state.people.find((person) => person.name === 'Marie')!;
    state.savedSearches = Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      name: `Recherche ${index + 1}`,
      diaryId: null,
      filters: {
        search: '', searchMode: 'keyword' as const, sort: 'relevance' as const, tags: [`t${index}`], date: null,
        visibility: 'all' as const, archiveStatus: 'active' as const, favorites: false, mood: '',
      },
      createdAt: '2026-10-27T09:00:00.000Z',
      updatedAt: '2026-10-27T09:00:00.000Z',
    }));

    await page.goto(`/journal?diary=all&person=${marie.id}`);
    await page.getByRole('button', { name: 'Faire un livre sur Marie' }).click();
    await expect(page.getByText('Vous avez atteint la limite de recherches enregistrées. Supprimez-en une d’abord.')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/journal\\?diary=all&person=${marie.id}$`));
  });
});
