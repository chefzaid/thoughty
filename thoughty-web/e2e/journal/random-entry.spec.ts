import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const entry = (id: number, date: string, content: string, fields: Partial<MockEntry> = {}): MockEntry => ({
  id, date, index: 1, content, tags: [], visibility: 'private', diaryId: 1, ...fields,
});

const ENTRIES: MockEntry[] = [
  entry(701, '2026-10-21', 'Favorite walk by the canal.', { is_favorite: true }),
  entry(702, '2026-10-20', 'Errands in town.'),
  entry(703, '2026-10-19', 'Favorite dinner with Lea.', { is_favorite: true }),
  entry(704, '2026-10-18', 'Rainy afternoon indoors.'),
  entry(705, '2026-10-17', 'Favorite morning swim in the lake.', { is_favorite: true }),
];

const filterTools = (page: Page) => page.locator('.journal-filter-controls');
const randomButton = (page: Page, name: string) => filterTools(page).getByRole('button', { name, exact: true });
const pageInput = (page: Page) => page.getByLabel('Page', { exact: true });

/** The mock API picks with `Math.random`; a value near 1 makes it take the last candidate of the list. */
async function withLastPick(run: () => Promise<void>) {
  const random = Math.random;
  Math.random = () => 0.99;
  try {
    await run();
  } finally {
    Math.random = random;
  }
}

/** Clicks the button and gives the query of the random entry request it sent. */
async function pickRandom(page: Page, name: string): Promise<URLSearchParams> {
  const request = page.waitForRequest((candidate) => new URL(candidate.url()).pathname === '/api/entries/random');
  await randomButton(page, name).click();
  return new URL((await request).url()).searchParams;
}

test.describe('Random entry', () => {
  test('opens an entry picked among the current filters on its page, keeps the filters, and moves on to another one', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { entriesPerPage: 2 }, initialEntries: ENTRIES });
    await page.goto('/journal?diary=all');
    await page.getByTitle('Show favorites only').click();
    await expect(page.locator('#entry-703')).toBeVisible();
    await expect(page.locator('#entry-702')).toHaveCount(0);

    await withLastPick(async () => {
      const first = await pickRandom(page, 'Random entry');
      expect(first.get('favorites')).toBe('true');
      expect(first.get('limit')).toBe('2');
      expect(first.has('page')).toBe(false);
      expect(first.has('excludeId')).toBe(false);

      // The last favorite is on the second page of the filtered list, and the filters stay
      await expect(page.locator('#entry-705')).toHaveClass(/highlight-entry/);
      await expect(pageInput(page)).toHaveValue('2');
      await expect(filterTools(page).getByText('Showing a random entry from Oct 17, 2026.')).toBeAttached();
      await expect(page.locator('#entry-704')).toHaveCount(0);
      await expect(page).toHaveURL(/\/journal\?diary=all$/);

      const second = await pickRandom(page, 'Another one');
      expect(second.get('excludeId')).toBe('705');
      expect(second.get('favorites')).toBe('true');
      await expect(page.locator('#entry-703')).toHaveClass(/highlight-entry/);
      await expect(pageInput(page)).toHaveValue('1');
      await expect(page.locator('#entry-702')).toHaveCount(0);
    });

    const results = await new AxeBuilder({ page })
      .include('.journal-filter-controls')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  });

  test('starts afresh when the filters change, and opens the list from the calendar', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.clock.setFixedTime(new Date('2026-10-22T09:00:00'));
    await page.goto('/journal?diary=all');

    await withLastPick(async () => {
      await pickRandom(page, 'Random entry');
      await expect(page.locator('#entry-705')).toHaveClass(/highlight-entry/);
      await page.getByTitle('Show favorites only').click();
      const fresh = await pickRandom(page, 'Random entry');
      expect(fresh.has('excludeId')).toBe(false);

      await page.getByRole('button', { name: 'Calendar', exact: true }).click();
      await expect(page.getByRole('grid', { name: 'October 2026' })).toBeVisible();
      await pickRandom(page, 'Another one');
      await expect(page).toHaveURL(/\/journal\?diary=all$/);
      await expect(page.locator('#entry-703')).toHaveClass(/highlight-entry/);
      await expect(page.locator('#entry-702')).toHaveCount(0);
    });
  });

  test('explains why there is nothing to pick from, when no entry or only a sealed one matches', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        entry(711, '2026-10-21', 'An ordinary day.'),
        entry(712, '2026-10-20', 'Letter to my future self.', {
          diaryId: 2,
          capsule: { openAt: '2031-01-01T09:00:00.000Z', sealedAt: '2026-10-20T09:00:00.000Z', openedAt: null },
        }),
      ],
    });
    await page.goto('/journal?diary=all');
    await expect(page.locator('#entry-711')).toBeVisible();

    await page.getByTitle('Show favorites only').click();
    await expect(page.getByText('An ordinary day.')).toHaveCount(0);
    const empty = randomButton(page, 'Random entry');
    await expect(empty).toHaveAttribute('aria-disabled', 'true');
    await expect(empty).toHaveAccessibleDescription('No entry matches these filters, so there is nothing to pick from.');
    let asked = false;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/entries/random') asked = true;
    });
    // It stays reachable from the keyboard, so its reason can be heard, but does nothing
    await empty.focus();
    await page.keyboard.press('Enter');
    await page.getByTitle('Show favorites only').click();
    expect(asked).toBe(false);

    // The diary's sealed capsule is listed, but a random pick never opens one
    await page.getByTitle('Personal', { exact: true }).click();
    await expect(page.locator('#entry-712')).toBeVisible();
    await expect(page.locator('#entry-711')).toHaveCount(0);
    await pickRandom(page, 'Random entry');
    await expect(page.getByRole('alert')).toHaveText('No entry matches these filters, so there is nothing to pick from.');
  });
});
