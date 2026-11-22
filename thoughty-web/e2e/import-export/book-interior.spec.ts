import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const ENTRIES = [
  { id: 1, date: '2024-05-01', index: 1, content: 'An idea for the garden', tags: ['ideas'], visibility: 'private' as const, diaryId: 1 },
  { id: 2, date: '2024-06-02', index: 1, content: 'Planning the week', tags: ['work'], visibility: 'private' as const, diaryId: 1 },
];

async function openBookConverter(page: Page, language: 'en' | 'fr' = 'en') {
  const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { language } });
  await page.clock.setFixedTime(new Date('2026-08-01T12:00:00'));
  await page.goto('/import-export?diary=1&section=book');
  const bookSection = page.locator('#book-section');
  await bookSection.getByLabel(language === 'fr' ? "Tisser les pensées en prose fluide avec l'IA" : 'Weave thoughts into flowing prose with AI').uncheck();
  return { state, bookSection };
}

test.describe('Book interior themes', () => {
  test('previews and downloads the book in the chosen interior theme', async ({ page }) => {
    const { state, bookSection } = await openBookConverter(page);
    const themes = bookSection.getByRole('radiogroup', { name: 'Interior theme' });
    await expect(themes.getByRole('radio')).toHaveCount(3);
    await expect(themes.getByRole('radio', { name: 'Standard' })).toBeChecked();
    await expect(themes.getByRole('radio', { name: 'Large print' }))
      .toHaveAccessibleDescription('Larger type with more space between lines, text aligned left, larger photos');

    await themes.getByText('Large print').click();
    await expect(themes.getByRole('radio', { name: 'Large print' })).toBeChecked();
    await bookSection.getByRole('button', { name: 'Preview Book' }).click();
    const dialog = page.getByRole('dialog', { name: 'Book preview' });
    await expect(dialog.getByRole('toolbar').getByRole('status')).toHaveText(/^Page 1 of \d+$/);
    await dialog.getByRole('button', { name: 'Close' }).click();

    // The keyboard moves between themes like any radio group
    await themes.getByRole('radio', { name: 'Large print' }).press('ArrowLeft');
    await expect(themes.getByRole('radio', { name: 'Elegant' })).toBeChecked();
    await bookSection.getByLabel('Format').selectOption('epub');
    const download = page.waitForEvent('download');
    await bookSection.getByRole('button', { name: 'Download Book' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.epub$/);

    await themes.getByText('Standard').click();
    await bookSection.getByRole('button', { name: 'Preview Book' }).click();
    await expect(dialog.getByRole('toolbar').getByRole('status')).toHaveText(/^Page 1 of \d+$/);

    expect(state.bookExportRequestUrls.map((url) => url.searchParams.get('interiorTheme'))).toEqual(['large-print', 'elegant', null]);
  });

  test('names the themes in French', async ({ page }) => {
    const { bookSection } = await openBookConverter(page, 'fr');
    const themes = bookSection.getByRole('radiogroup', { name: 'Thème de l’intérieur' });

    await expect(bookSection.getByRole('group', { name: 'Intérieur' })).toBeVisible();
    await expect(themes.getByRole('radio', { name: 'Standard' })).toBeChecked();
    await expect(themes.getByRole('radio', { name: 'Élégant' })).toBeVisible();
    await expect(themes.getByRole('radio', { name: 'Gros caractères' }))
      .toHaveAccessibleDescription('Texte plus grand et plus aéré, aligné à gauche, photos plus grandes');
  });
});
