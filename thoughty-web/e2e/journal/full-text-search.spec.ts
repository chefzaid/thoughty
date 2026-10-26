import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const searchEntries = [
  {
    id: 201,
    date: '2024-05-03',
    index: 1,
    content: 'A morning run by the sea, then a slow swim.',
    tags: ['running'],
    visibility: 'private' as const,
    diaryId: 1,
  },
  {
    id: 202,
    date: '2024-05-02',
    index: 1,
    content: 'Morning run in the rain. The morning was grey, the run was short, and the morning coffee was cold.',
    tags: ['running'],
    visibility: 'private' as const,
    diaryId: 1,
  },
  {
    id: 203,
    date: '2024-05-04',
    index: 1,
    content: 'Journaling at the lake before the run of errands.',
    tags: ['lake'],
    visibility: 'private' as const,
    diaryId: 1,
  },
  {
    id: 204,
    date: '2024-05-01',
    index: 1,
    content: 'A quiet evening at home.',
    tags: ['family'],
    visibility: 'private' as const,
    diaryId: 1,
  },
];

const entryIds = (page: Page) =>
  page.locator('[id^="entry-"]').evaluateAll((cards) => cards.map((card) => card.id));

test.describe('Journal full-text search', () => {
  test('explains the operators, then finds phrases, exclusions, alternatives, and unfinished words', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: searchEntries });
    await page.goto('/journal?diary=all');

    const search = page.getByRole('textbox', { name: 'Search entries' });
    await search.focus();
    await expect(page.getByText(/Put "an exact phrase" in quotes, write -word to leave a word out, and OR between words/)).toBeVisible();

    await search.fill('"morning run" -rain');
    await expect(page.locator('[id^="entry-"]')).toHaveCount(1);
    await expect(page.locator('#entry-201 mark')).toHaveText(['morning run']);

    await search.fill('sea OR lake');
    await expect.poll(() => entryIds(page)).toEqual(['entry-203', 'entry-201']);

    await search.fill('journ');
    await expect.poll(() => entryIds(page)).toEqual(['entry-203']);
    await expect(page.locator('#entry-203 mark')).toHaveText(['Journaling']);

    await search.fill('family');
    await expect.poll(() => entryIds(page)).toEqual(['entry-204']);
    await expect(page.locator('#entry-204 mark')).toHaveCount(0);
  });

  test('lists the best matches first and switches back to date order', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: searchEntries });
    await page.goto('/journal?diary=all');

    await page.getByRole('textbox', { name: 'Search entries' }).fill('morning');
    const order = page.getByRole('group', { name: 'Order of search results' });
    await expect(order.getByRole('button', { name: 'Best match' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => entryIds(page)).toEqual(['entry-202', 'entry-201']);

    await order.getByRole('button', { name: 'Newest first' }).click();
    await expect(order.getByRole('button', { name: 'Newest first' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => entryIds(page)).toEqual(['entry-201', 'entry-202']);

    await page.getByRole('button', { name: 'Reset Filters' }).click();
    await expect(order).toHaveCount(0);
    await expect.poll(() => entryIds(page)).toEqual(['entry-203', 'entry-201', 'entry-202', 'entry-204']);
  });

  test('explains the search in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: searchEntries });
    await page.goto('/journal?diary=all');

    await page.getByRole('textbox', { name: 'Rechercher dans les entrées' }).fill('morning');
    await expect(page.getByText(/Mettez "une expression exacte" entre guillemets, écrivez -mot pour exclure un mot/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Ordre des résultats' }).getByRole('button', { name: 'Pertinence' })).toBeVisible();
  });
});
