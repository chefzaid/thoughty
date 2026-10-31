import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const entry = (id: number, date: string, content: string, overrides: Partial<MockEntry> = {}): MockEntry => ({
  id,
  date,
  index: 1,
  content,
  tags: [],
  visibility: 'private',
  diaryId: 1,
  ...overrides,
});

const entries: MockEntry[] = [
  entry(701, '2025-03-16', 'Tram 28 up the hill, then fish by the river.', { tags: ['travel'], is_favorite: true }),
  entry(702, '2025-12-30', 'Quiet end to the year, a long list of thanks.', { tags: ['walks'] }),
];

/** The size of each printed page, in points, as the browser lays the page out for paper. */
async function printedPageSizes(page: Page): Promise<string[]> {
  const pdf = await page.pdf({ preferCSSPageSize: true });
  return [...pdf.toString('latin1').matchAll(/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(([, width, height]) => `${Math.round(Number(width))}x${Math.round(Number(height))}`);
}

const A5 = '420x595';

/** Keeps `window.print` from opening the browser's dialog. */
async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
}

test.describe('What each page prints', () => {
  test('a plain print of the journal shows the journal, even after the year in review was open', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/review?year=2025');
    await page.getByRole('region', { name: 'Moments to reread' }).getByRole('button', { name: 'Read in journal' }).first().click();
    await expect(page).toHaveURL(/\/journal\?entry=/);
    await expect(page.locator('html')).not.toHaveClass(/year-review-active/);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#entry-701')).toContainText('Tram 28 up the hill');
    await expect(page.locator('#entry-701').getByText('Tram 28 up the hill')).toBeVisible();
    await expect(page.locator('#entry-702').getByText('Quiet end to the year')).toBeVisible();
    // The browser's own paper size, not the review's booklet
    const sizes = await printedPageSizes(page);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes).not.toContain(A5);
  });

  test('the year in review prints as an A5 booklet without the app around it', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/review?year=2025');
    await expect(page.getByRole('region', { name: 'Moments to reread' })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/year-review-active/);

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('heading', { level: 1, name: 'Your 2025 in review' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Moments to reread' })).toContainText('Tram 28 up the hill');
    await expect(page.getByRole('region', { name: 'Share or keep' })).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toBeHidden();
    await expect(page.getByRole('navigation').first()).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
    const sizes = await printedPageSizes(page);
    expect(sizes.length).toBeGreaterThan(0);
    expect(new Set(sizes)).toEqual(new Set([A5]));
  });

  test('the print view of an entry prints only the entry, on its own pages', async ({ page }) => {
    await stubPrint(page);
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/review?year=2025');
    await page.getByRole('region', { name: 'Moments to reread' }).getByRole('button', { name: 'Read in journal' }).first().click();
    await expect(page).toHaveURL(/\/journal/);

    await page.locator('#entry-702').getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Print' }).click();
    const dialog = page.getByRole('dialog', { name: 'Print this entry' });
    await dialog.getByRole('button', { name: 'Print' }).click();
    await expect(dialog.getByRole('status')).toHaveText('Preparing the pages…');

    await page.emulateMedia({ media: 'print' });
    const sheet = page.locator('.print-sheet');
    await expect(sheet).toContainText('Quiet end to the year, a long list of thanks.');
    await expect(sheet).not.toContainText('Tram 28');
    await expect(page.locator('#root')).toBeHidden();
    const sizes = await printedPageSizes(page);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes).not.toContain(A5);
  });
});
