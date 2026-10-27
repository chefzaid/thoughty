import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const LONG_TRIP = Array.from({ length: 70 }, (_, index) => `Day ${index + 1} on the coast road, with notes about the light.`).join(' ');

// Chapters by tag, alphabetical: ideas (page 3), travel (pages 4-5), work (page 6), after the title page and contents.
const ENTRIES = [
  { id: 1, date: '2024-05-01', index: 1, content: 'An idea for the garden', tags: ['ideas'], visibility: 'private' as const, diaryId: 1 },
  { id: 2, date: '2024-05-02', index: 1, content: 'Planning the week', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
  { id: 3, date: '2024-05-03', index: 1, content: LONG_TRIP, tags: ['travel'], visibility: 'private' as const, diaryId: 1 },
];

async function openBookConverter(page: Page) {
  const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
  await page.goto('/import-export?diary=1&section=book');
  const bookSection = page.locator('#book-section');
  await bookSection.getByLabel('Title').fill('Summer Notes');
  return { state, bookSection };
}

test.describe('Book page preview', () => {
  test('shows the generated PDF page by page, jumps to chapters, and downloads what it showed', async ({ page }) => {
    const { state, bookSection } = await openBookConverter(page);
    const previewButton = bookSection.getByRole('button', { name: 'Preview Book' });

    // AI weaving is on by default: the preview says it spends tokens, once
    await expect(previewButton).toHaveAccessibleDescription(/uses AI tokens/);
    await bookSection.getByLabel('Weave thoughts into flowing prose with AI').uncheck();
    await expect(bookSection.getByText(/uses AI tokens/)).toBeHidden();

    await previewButton.click();
    const dialog = page.getByRole('dialog', { name: 'Book preview' });
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    const status = dialog.getByRole('toolbar').getByRole('status');
    await expect(status).toHaveText('Page 1 of 6');
    await expect(dialog.getByTestId('book-preview-page-text')).toContainText('Summer Notes');
    expect(await dialog.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width > 0 && canvas.height > 0)).toBe(true);
    expect(state.bookExportRequestUrls).toHaveLength(1);
    expect(state.bookExportRequestUrls[0]!.searchParams.get('narrative')).toBe('false');
    expect(state.bookExportRequestUrls[0]!.searchParams.has('format')).toBe(false);

    await dialog.getByRole('button', { name: 'Next page' }).click();
    await expect(status).toHaveText('Page 2 of 6');
    await expect(dialog.getByTestId('book-preview-page-text')).toContainText('Table of Contents');
    await expect(dialog.getByRole('button', { name: 'Previous page' })).toBeEnabled();

    // The jump list is the book's own contents, with the pages the PDF prints
    const jump = dialog.getByLabel('Go to');
    await expect(jump.locator('option')).toHaveText([
      'Title page',
      'Table of contents',
      'Chapter 1: ideas (page 3)',
      'Chapter 2: travel (page 4)',
      'Chapter 3: work (page 6)',
    ]);
    await jump.selectOption({ label: 'Chapter 2: travel (page 4)' });
    await expect(status).toHaveText('Page 4 of 6');
    await expect(dialog.getByTestId('book-preview-page-text')).toContainText('Day 1 on the coast road');

    // Keyboard: arrows turn pages, End and Home go to the ends, the jump list follows
    await dialog.getByRole('region', { name: 'Page 4 of 6' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(status).toHaveText('Page 5 of 6');
    await expect(jump).toHaveValue('3');
    await page.keyboard.press('End');
    await expect(status).toHaveText('Page 6 of 6');
    await expect(dialog.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await page.keyboard.press('ArrowLeft');
    await expect(status).toHaveText('Page 5 of 6');
    await page.keyboard.press('Home');
    await expect(status).toHaveText('Page 1 of 6');

    // Zoom
    const width = () => dialog.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getBoundingClientRect().width);
    const fitWidth = await width();
    await dialog.getByRole('button', { name: 'Zoom in' }).click();
    await expect(dialog.getByText('125%')).toBeVisible();
    await expect.poll(width).toBeGreaterThan(fitWidth * 1.2);
    await page.keyboard.press('-');
    await expect(dialog.getByText('100%')).toBeVisible();
    await dialog.getByRole('button', { name: 'Zoom out' }).click();
    await expect(dialog.getByText('75%')).toBeVisible();
    await dialog.getByRole('button', { name: 'Fit page' }).click();
    await expect(dialog.getByText('100%')).toBeVisible();

    // Download from the preview saves the PDF it showed, without generating it again
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download PDF' }).click();
    expect((await download).suggestedFilename()).toBe('thoughty_book_Summer_Notes_2026-08-01.pdf');
    expect(state.bookExportRequestUrls).toHaveLength(1);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(previewButton).toBeFocused();

    // Same settings: Download Book and a second preview reuse that PDF
    const secondDownload = page.waitForEvent('download');
    await bookSection.getByRole('button', { name: 'Download Book' }).click();
    expect((await secondDownload).suggestedFilename()).toBe('thoughty_book_Summer_Notes_2026-08-01.pdf');
    await previewButton.click();
    await expect(page.getByRole('dialog', { name: 'Book preview' }).getByRole('toolbar').getByRole('status')).toHaveText('Page 1 of 6');
    expect(state.bookExportRequestUrls).toHaveLength(1);
    await page.getByRole('dialog', { name: 'Book preview' }).getByRole('button', { name: 'Close' }).click();

    // Changed settings generate a new book
    await bookSection.getByLabel('Include table of contents').uncheck();
    await previewButton.click();
    await expect(page.getByRole('dialog', { name: 'Book preview' }).getByRole('toolbar').getByRole('status')).toHaveText('Page 1 of 5');
    expect(state.bookExportRequestUrls).toHaveLength(2);
  });

  test('passes axe and fits a phone, and says another format downloads separately', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { bookSection } = await openBookConverter(page);
    await bookSection.getByLabel('Format').selectOption('epub');
    await bookSection.getByRole('button', { name: 'Preview Book' }).click();

    const dialog = page.getByRole('dialog', { name: 'Book preview' });
    await expect(dialog.getByRole('toolbar').getByRole('status')).toHaveText('Page 1 of 6');
    await expect(dialog.getByText(/The preview shows the PDF edition.*EPUB \(\.epub\) edition/)).toBeVisible();
    for (const name of ['Previous page', 'Next page', 'Zoom in', 'Download PDF', 'Close']) {
      await expect(dialog.getByRole('button', { name })).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const canvasBox = await dialog.locator('canvas').boundingBox();
    expect(canvasBox!.width).toBeLessThanOrEqual(390);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  });

  test('passes axe in the light theme on a desktop', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { theme: 'light' } });
    await page.goto('/import-export?diary=1&section=book');
    await page.locator('#book-section').getByRole('button', { name: 'Preview Book' }).click();
    const dialog = page.getByRole('dialog', { name: 'Book preview' });
    await expect(dialog.getByRole('toolbar').getByRole('status')).toHaveText('Page 1 of 6');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  });
});
