import AxeBuilder from '../support/axe';
import { expect, test, type Locator, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const entry = (id: number, date: string, content: string, fields: Partial<MockEntry> = {}): MockEntry => ({
  id, date, index: 1, content, tags: [], visibility: 'private', diaryId: 1, ...fields,
});
const picture = { id: 77, original_filename: 'boat.png', stored_filename: 'stored-boat', mimetype: 'image/png', size: 68 };

const ENTRIES: MockEntry[] = [
  entry(806, '2026-09-28', 'Late September rain.'),
  entry(801, '2026-10-01', 'First walk of October.', { is_favorite: true }),
  entry(802, '2026-10-05', '**Harbor** at dawn\n\n![Old boat](attachment:77)', { format: 'markdown', title: 'Harbor', attachments: [picture] }),
  entry(803, '2026-10-05', 'Errands in town.', { index: 2, time_of_day: '18:00' }),
  entry(804, '2026-10-12', 'Letter to my future self.', {
    capsule: { openAt: '2031-01-01T09:00:00.000Z', sealedAt: '2026-10-12T09:00:00.000Z', openedAt: null },
  }),
  entry(805, '2026-10-20', 'Evening by the lake.', { is_favorite: true }),
];

const reader = (page: Page, name = 'Reader') => page.getByRole('dialog', { name });
const readButton = (page: Page, name = 'Read like a book') => page.locator('.journal-filter-controls').getByRole('button', { name });
const status = (dialog: Locator) => dialog.locator('[aria-live="polite"]');
const filterOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).filter);

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('.entry-reader')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

/** Waits for the reader request a step sends, and gives its query. */
async function readRequest(page: Page, step: () => Promise<void>): Promise<URLSearchParams> {
  const request = page.waitForRequest((candidate) => new URL(candidate.url()).pathname === '/api/entries/reader');
  await step();
  return new URL((await request).url()).searchParams;
}

test.describe('Read like a book', () => {
  test('reads the journal oldest first, past a sealed capsule, by buttons and arrows, and stays on its entry after a reload', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    await expect(page.locator('#entry-805')).toBeVisible();

    await readButton(page).click();
    const dialog = reader(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription('Left and right arrows turn the page. Esc closes.');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('September 28, 2026');
    await expect(dialog.getByText('Late September rain.')).toBeVisible();
    await expect(status(dialog)).toHaveText('Entry 1 of 5, September 28, 2026.');
    await expect(page).toHaveURL(/[?&]read=806(&|$)/);
    await expect(dialog.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true');

    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByText('First walk of October.')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    // The text as the journal renders it, its picture in place, and no tags, counts or edit controls
    await expect(dialog.getByRole('heading', { level: 3, name: 'Harbor' })).toBeVisible();
    await expect(dialog.locator('strong')).toHaveText('Harbor');
    await expect(dialog.getByRole('button', { name: 'Open the picture Old boat' }).getByRole('img')).toHaveAttribute('src', /^blob:/);
    await expect(dialog.getByRole('button', { name: /Edit|Delete|More actions/ })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);

    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(/^October 5, 2026, 6:00\sPM$/);
    // The sealed capsule is left out of the reading altogether
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByText('Evening by the lake.')).toBeVisible();
    await expect(status(dialog)).toHaveText('Entry 5 of 5, October 20, 2026.');
    await expect(dialog.getByText('Letter to my future self.')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(status(dialog)).toHaveText('This is the last entry.');
    await expect(page).toHaveURL(/[?&]read=805(&|$)/);

    // The privacy blur blurs the text being read
    await page.keyboard.press('Control+Shift+E');
    await expect.poll(() => filterOf(dialog.locator('.entry-reader-text'))).toMatch(/^blur\(/);
    await page.keyboard.press('Control+Shift+E');

    await page.reload();
    await expect(reader(page).getByText('Evening by the lake.')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(reader(page).getByText('Errands in town.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(reader(page)).toBeHidden();
    await expect(page).toHaveURL(/\/journal\?diary=all$/);
    // Nothing opened it after the reload, so focus goes to the journal's Read button
    await expect(readButton(page)).toBeFocused();
  });

  test('reads only the entries of the current filters, and a month from the calendar', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.clock.setFixedTime(new Date('2026-10-22T09:00:00'));
    await page.goto('/journal?diary=all');
    await page.getByTitle('Show favorites only').click();
    await expect(page.locator('#entry-806')).toHaveCount(0);

    const first = await readRequest(page, () => readButton(page).click());
    expect(first.get('favorites')).toBe('true');
    expect(first.has('page')).toBe(false);
    expect(first.has('limit')).toBe(false);
    const dialog = reader(page);
    await expect(dialog.getByText('First walk of October.')).toBeVisible();
    await expect(status(dialog)).toHaveText('Entry 1 of 2, October 1, 2026.');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByText('Evening by the lake.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');

    // A reload reads the same filters, though the journal behind starts afresh
    await page.reload();
    await expect(reader(page).getByText('Evening by the lake.')).toBeVisible();
    await expect(status(reader(page))).toHaveText('Entry 2 of 2, October 20, 2026.');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page.getByRole('grid', { name: 'October 2026' })).toBeVisible();
    const readMonth = page.getByRole('button', { name: 'Read this month' });
    const month = await readRequest(page, () => readMonth.click());
    expect(month.get('month')).toBe('2026-10');
    await expect(reader(page).getByText('First walk of October.')).toBeVisible();
    await expect(status(reader(page))).toHaveText('Entry 1 of 4, October 1, 2026.');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(reader(page)).toBeHidden();
    await expect(readMonth).toBeFocused();

    await page.getByRole('button', { name: 'Previous month', exact: true }).click();
    await page.getByRole('button', { name: 'Previous month', exact: true }).click();
    await expect(page.getByRole('grid', { name: 'August 2026' })).toBeVisible();
    await expect(readMonth).toHaveAttribute('aria-disabled', 'true');
  });

  test('never opens a sealed capsule from a link, and starts over from the first entry', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all&read=804');

    const dialog = reader(page);
    await expect(dialog.getByRole('alert')).toHaveText(/This entry is not among the entries being read any more\./);
    await expect(dialog.getByText('Letter to my future self.')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Start from the first entry' }).click();
    await expect(dialog.getByText('Late September rain.')).toBeVisible();
    await expect(page).toHaveURL(/[?&]read=806(&|$)/);
  });

  test('reads in French, and gives no counts in quiet mode', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', quietMode: true }, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');

    const open = readButton(page, 'Lire comme un livre');
    await expect(open).toHaveText('Lire');
    await open.click();
    const dialog = reader(page, 'Lecture');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('28 septembre 2026');
    await expect(status(dialog)).toHaveText('28 septembre 2026.');
    await dialog.getByRole('button', { name: 'Suivante' }).click();
    await expect(status(dialog)).toHaveText('1 octobre 2026.');
    await expect(dialog.getByRole('button', { name: 'Fermer' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
  });
});
