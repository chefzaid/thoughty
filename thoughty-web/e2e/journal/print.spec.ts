import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const axe = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
};

const harbourDay: MockEntry = {
  id: 951,
  date: '2026-10-20',
  index: 1,
  title: 'Harbour day',
  time_of_day: '08:30',
  mood: 4,
  feelings: ['calm'],
  format: 'markdown',
  content: 'Walked with @Marie along the quay.\n\n- [x] Coffee\n- [ ] Call grandma\n\n![The old pier](attachment:61)',
  tags: ['sea'],
  visibility: 'private',
  diaryId: 1,
  attachments: [
    { id: 61, original_filename: 'pier.png', stored_filename: 'stored-pier', mimetype: 'image/png', size: 68 },
    { id: 62, original_filename: 'boats.png', stored_filename: 'stored-boats', mimetype: 'image/png', size: 68 },
    { id: 63, original_filename: 'waves.webm', stored_filename: 'stored-waves', mimetype: 'video/webm', size: 900, poster_filename: 'poster-waves.jpg' },
    { id: 64, original_filename: 'gulls.mp3', stored_filename: 'stored-gulls', mimetype: 'audio/mpeg', size: 400 },
  ],
};

const evening: MockEntry = { id: 952, date: '2026-10-20', index: 2, content: 'Tea by the window.', tags: [], visibility: 'private', diaryId: 1 };

const capsule: MockEntry = {
  id: 953,
  date: '2026-10-20',
  index: 3,
  title: 'Dear future me',
  content: 'Remember the lighthouse.',
  tags: [],
  visibility: 'private',
  diaryId: 1,
  capsule: { openAt: `${new Date().getFullYear() + 2}-01-01T08:00:00.000Z`, sealedAt: '2026-10-20T10:00:00.000Z', openedAt: null },
};

/** Counts the calls to `window.print`, which would otherwise open the browser's dialog. */
async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    const counted = window as unknown as { printCalls: number };
    counted.printCalls = 0;
    window.print = () => {
      counted.printCalls += 1;
    };
  });
}

const printCalls = (page: Page) => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls);

test.describe('Print an entry or a day', () => {
  test('prints an entry with its pictures on a clean page, and restores the app afterwards', async ({ page }) => {
    await stubPrint(page);
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [harbourDay, evening] });
    await page.goto('/journal');

    const card = page.locator('#entry-951');
    await card.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Print' }).click();

    const dialog = page.getByRole('dialog', { name: 'Print this entry' });
    await expect(dialog).toContainText('October 20, 2026 · Harbour day');
    await expect(dialog.getByRole('button', { name: 'Print' })).toBeFocused();
    expect(await axe(page)).toEqual([]);
    await dialog.getByRole('checkbox', { name: 'Mood and feelings' }).uncheck();
    await dialog.getByRole('button', { name: 'Print' }).click();
    await expect(dialog.getByRole('status')).toHaveText('Preparing the pages…');
    await expect.poll(() => printCalls(page)).toBe(1);

    // On screen the print view stays out of sight
    const sheet = page.locator('.print-sheet');
    await expect(sheet).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(sheet).toBeVisible();
    await expect(page.locator('#root')).toBeHidden();
    await expect(sheet.getByRole('heading', { level: 1 })).toHaveText('October 20, 2026');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Harbour day');
    await expect(sheet.locator('time').first()).toHaveText('October 20, 2026');
    await expect(sheet.getByText('8:30 AM')).toBeVisible();
    await expect(sheet).toContainText('Walked with @Marie along the quay.');
    await expect(sheet.getByRole('link')).toHaveCount(0);
    await expect(sheet.getByRole('checkbox', { name: 'Coffee' })).toBeChecked();
    await expect(sheet.getByRole('checkbox', { name: 'Call grandma' })).toBeDisabled();
    // Pictures come from the files loaded with the session, and have all loaded
    for (const name of ['The old pier', 'boats.png']) {
      const picture = sheet.getByRole('img', { name });
      await expect(picture).toHaveAttribute('src', /^blob:/);
      expect(await picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    await expect(sheet.getByText('Video: waves.webm')).toBeVisible();
    await expect(sheet.getByText('Attached: gulls.mp3')).toBeVisible();
    await expect(sheet.getByText('Tags: #sea')).toBeVisible();
    await expect(sheet).not.toContainText('Mood');
    await expect(sheet).not.toContainText('Tea by the window.');
    // Black on white, whatever the theme
    expect(await sheet.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(0, 0, 0)');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');

    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(sheet).toHaveCount(0);
    await expect(dialog).toBeHidden();
    await expect(card.getByLabel('More actions')).toBeFocused();
    await expect(page.locator('html')).not.toHaveClass(/print-sheet-active/);
  });

  test('prints a day from its heading, leaving out the sealed time capsule', async ({ page }) => {
    await stubPrint(page);
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [harbourDay, evening, capsule] });
    await page.goto('/journal');

    await page.getByRole('button', { name: 'Print this day, October 20, 2026' }).click();
    const dialog = page.getByRole('dialog', { name: 'Print this day' });
    await expect(dialog).toContainText('October 20, 2026 · 2 entries');
    await dialog.getByRole('button', { name: 'Print' }).click();
    await expect.poll(() => printCalls(page)).toBe(1);

    await page.emulateMedia({ media: 'print' });
    const sheet = page.locator('.print-sheet');
    await expect(sheet.locator('.print-entry')).toHaveCount(2);
    await expect(sheet).toContainText('Mood: Good · calm');
    await expect(sheet).toContainText('Tea by the window.');
    await expect(sheet).not.toContainText('Dear future me');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(sheet).toHaveCount(0);
  });

  test('prints in French', async ({ page }) => {
    await stubPrint(page);
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'light' }, initialEntries: [evening] });
    await page.goto('/journal');

    await page.locator('#entry-952').getByLabel("Plus d'actions").click();
    await page.getByRole('menuitem', { name: 'Imprimer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Imprimer cette entrée' });
    await dialog.getByRole('button', { name: 'Imprimer' }).click();
    await expect.poll(() => printCalls(page)).toBe(1);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-sheet').getByRole('heading', { level: 1 })).toHaveText('20 octobre 2026');
    await expect(page.locator('.print-sheet')).toHaveAttribute('lang', 'fr');
  });
});
