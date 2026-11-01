import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const ENTRIES = [
  { id: 1, date: '2024-05-01', index: 1, content: 'An idea for the garden', tags: ['ideas'], visibility: 'private' as const, diaryId: 1 },
  { id: 2, date: '2024-06-02', index: 1, content: 'Planning the week', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
];

async function openBookConverter(page: Page, quietMode = false) {
  const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { quietMode } });
  await page.clock.setFixedTime(new Date('2026-08-01T12:00:00'));
  await page.goto('/import-export?diary=1&section=book');
  const bookSection = page.locator('#book-section');
  await bookSection.getByLabel('Weave thoughts into flowing prose with AI').uncheck();
  return { state, bookSection };
}

test.describe('Book pages', () => {
  test('puts the dedication and epigraph after the title page, and the preview finds them', async ({ page }) => {
    const { state, bookSection } = await openBookConverter(page);
    const pages = bookSection.getByRole('group', { name: 'Book pages' });
    await expect(pages.getByLabel('Dedication')).toHaveAttribute('maxlength', '300');
    await pages.getByLabel('Dedication').fill('  For Marie,\nwho listened.  ');
    await pages.getByLabel('Epigraph').fill('We remember moments.\n— Pavese');

    await bookSection.getByRole('button', { name: 'Preview Book' }).click();
    const dialog = page.getByRole('dialog', { name: 'Book preview' });
    const status = dialog.getByRole('toolbar').getByRole('status');
    await expect(status).toHaveText('Page 1 of 6');
    const sent = state.bookExportRequestUrls[0]!.searchParams;
    expect(sent.get('dedication')).toBe('For Marie,\nwho listened.');
    expect(sent.get('epigraph')).toBe('We remember moments.\n— Pavese');

    const jump = dialog.getByLabel('Go to');
    await expect(jump.locator('option')).toHaveText([
      'Title page',
      'Dedication',
      'Epigraph',
      'Table of contents',
      'Chapter 1: ideas (page 5)',
      'Chapter 2: work (page 6)',
    ]);
    await jump.selectOption({ label: 'Dedication' });
    await expect(status).toHaveText('Page 2 of 6');
    await expect(dialog.getByTestId('book-preview-page-text')).toContainText('who listened.');
    await dialog.getByRole('button', { name: 'Next page' }).click();
    await expect(dialog.getByTestId('book-preview-page-text')).toContainText('Pavese');
    await expect(jump).toHaveValue('2');
    await dialog.getByRole('button', { name: 'Close' }).click();

    // Cleared, the pages and their jump entries go
    await pages.getByLabel('Dedication').fill('');
    await pages.getByLabel('Epigraph').fill('');
    await bookSection.getByRole('button', { name: 'Preview Book' }).click();
    await expect(status).toHaveText('Page 1 of 4');
    await expect(jump.locator('option')).toHaveText(['Title page', 'Table of contents', 'Chapter 1: ideas (page 3)', 'Chapter 2: work (page 4)']);
    expect(state.bookExportRequestUrls[1]!.searchParams.has('dedication')).toBe(false);
  });

  test('ends the book with its closing page, entry count included in quiet mode', async ({ page }) => {
    const { state, bookSection } = await openBookConverter(page, true);
    await bookSection.getByRole('checkbox', { name: /About this book/ }).check();

    await bookSection.getByRole('button', { name: 'Preview Book' }).click();
    const dialog = page.getByRole('dialog', { name: 'Book preview' });
    const status = dialog.getByRole('toolbar').getByRole('status');
    await expect(status).toHaveText('Page 1 of 5');
    expect(state.bookExportRequestUrls[0]!.searchParams.get('closingPage')).toBe('true');
    expect(state.bookExportRequestUrls[0]!.searchParams.get('today')).toBe('2026-08-01');

    const jump = dialog.getByLabel('Go to');
    await expect(jump.locator('option')).toHaveText([
      'Title page',
      'Table of contents',
      'Chapter 1: ideas (page 3)',
      'Chapter 2: work (page 4)',
      'About this book',
    ]);
    await jump.selectOption({ label: 'About this book' });
    await expect(status).toHaveText('Page 5 of 5');
    const text = dialog.getByTestId('book-preview-page-text');
    await expect(text).toContainText('Entries from 2024-05-01 to 2024-06-02');
    await expect(text).toContainText('2 entries');
    await expect(text).toContainText('Made with Thoughty on 2026-08-01');
  });

  test('sends the pages with a download in another format', async ({ page }) => {
    const { state, bookSection } = await openBookConverter(page);
    await bookSection.getByLabel('Epigraph').fill('« Les jours passent »');
    await bookSection.getByLabel('Format').selectOption('md');

    const download = page.waitForEvent('download');
    await bookSection.getByRole('button', { name: 'Download Book' }).click();
    await download;
    expect(state.bookExportRequestUrls.at(-1)!.searchParams.get('epigraph')).toBe('« Les jours passent »');
    expect(state.bookExportRequestUrls.at(-1)!.searchParams.get('format')).toBe('md');
  });
});
