import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const ENTRIES = [
  { id: 1, date: '2024-05-01', index: 1, content: 'An idea for the garden', tags: ['ideas'], visibility: 'private' as const, diaryId: 1 },
  { id: 2, date: '2024-06-02', index: 1, content: 'Planning the week', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
];

async function openBookConverter(page: Page, quietMode = false, language: 'en' | 'fr' = 'en') {
  const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { quietMode, language } });
  await page.clock.setFixedTime(new Date('2026-08-01T12:00:00'));
  await page.goto('/import-export?diary=1&section=book');
  const bookSection = page.locator('#book-section');
  await bookSection.getByLabel(language === 'fr' ? "Tisser les pensées en prose fluide avec l'IA" : 'Weave thoughts into flowing prose with AI').uncheck();
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
    await expect(text).toContainText('Entries from May 1, 2024 to June 2, 2024');
    await expect(text).toContainText('2 entries');
    await expect(text).toContainText('Made with Thoughty on August 1, 2026');
  });

  test('writes a French writer’s book in French, its chapters, contents and closing page', async ({ page }) => {
    const { bookSection } = await openBookConverter(page, false, 'fr');
    await bookSection.getByLabel('Type de chapitre').selectOption('month');
    await bookSection.getByRole('checkbox', { name: /À propos de ce livre/ }).check();

    await bookSection.getByRole('button', { name: 'Aperçu du livre' }).click();
    const dialog = page.getByRole('dialog', { name: 'Aperçu du livre' });
    const status = dialog.getByRole('toolbar').getByRole('status');
    await expect(status).toHaveText('Page 1 sur 5');
    const text = dialog.getByTestId('book-preview-page-text');
    await expect(text).toContainText('par testuser');

    const jump = dialog.getByLabel('Aller à');
    await expect(jump.locator('option')).toHaveText([
      'Page de titre',
      'Table des matières',
      'Chapitre 1 : Mai 2024 (page 3)',
      'Chapitre 2 : Juin 2024 (page 4)',
      'À propos de ce livre',
    ]);
    await jump.selectOption({ label: 'Table des matières' });
    await expect(text).toContainText('Table des matières');
    await expect(text).toContainText('1. Mai 2024');
    await jump.selectOption({ label: 'Chapitre 2 : Juin 2024 (page 4)' });
    await expect(text).toContainText('Chapitre 2');
    await jump.selectOption({ label: 'À propos de ce livre' });
    await expect(text).toContainText('Entrées du 1 mai 2024 au 2 juin 2024');
    await expect(text).toContainText('2 entrées');
    await expect(text).toContainText('Fait avec Thoughty le 1 août 2026');
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
