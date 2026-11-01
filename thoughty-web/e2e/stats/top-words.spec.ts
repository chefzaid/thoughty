import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '../support/test';

import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

const TODAY = '2025-03-20';

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
  entry(901, '2025-03-02', 'The garden after the rain, with @Marie.'),
  entry(902, '2025-03-09', 'Le jardin sous la pluie ; l’odeur du jardin. Garden again.'),
  entry(903, '2025-03-15', 'Garden, rain and the river.'),
  entry(904, '2025-03-18', 'Meeting notes, then more notes.', { diaryId: 2 }),
  // Last month and a day after today stay out
  entry(905, '2025-02-27', 'Snow snow snow'),
  entry(906, '2025-03-25', 'Later later later'),
];

const filterOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).filter);

test.describe('Words you use most', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  test('ranks this month’s words in the diary, blurs them with the entry text and searches the journal for one', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/stats?diary=all');

    const card = page.getByRole('region', { name: 'Words you use most' });
    await expect(card).toContainText('The words you used most in March');
    const list = card.getByRole('list', { name: 'Words you use most' });
    await expect(list.getByRole('listitem')).toHaveText(['garden3 times', 'jardin2 times', 'notes2 times', 'rain2 times']);
    const results = await new AxeBuilder({ page })
      .include('.top-words-card')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);

    // The words come from entry text, so the privacy blur hides them
    const garden = card.getByRole('button', { name: 'Search the journal for garden' });
    expect(await filterOf(garden)).toBe('none');
    await page.keyboard.press('Control+Shift+E');
    await expect.poll(() => filterOf(garden)).toMatch(/^blur\(/);
    await page.keyboard.press('Control+Shift+E');
    await expect.poll(() => filterOf(garden)).toBe('none');

    await page.goto('/stats?diary=2');
    await expect(list.getByRole('listitem')).toHaveText(['notes2 times']);

    await page.goto('/stats?diary=1');
    await card.getByRole('button', { name: 'Search the journal for rain' }).click();
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.getByRole('textbox', { name: 'Search entries' })).toHaveValue('rain');
    await expect(page.locator('#entry-901')).toBeVisible();
    await expect(page.locator('#entry-903')).toBeVisible();
    await expect(page.locator('#entry-902')).toHaveCount(0);
  });

  test('keeps the words without their counts in quiet mode, and in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, config: { quietMode: true, language: 'fr' } });
    await page.goto('/stats?diary=1');

    const card = page.getByRole('region', { name: 'Les mots que vous employez le plus' });
    await expect(card).toContainText('en mars');
    await expect(card.getByRole('listitem')).toHaveText(['garden', 'jardin', 'rain']);
    await expect(card.getByRole('listitem')).not.toContainText([/\d/]);
    await expect(card.getByRole('button', { name: 'Rechercher « jardin » dans le journal' })).toBeVisible();
  });

  test('says gently that words will show', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [entry(907, '2025-03-19', 'One quiet line.')] });
    await page.goto('/stats?diary=1');

    const card = page.getByRole('region', { name: 'Words you use most' });
    await expect(card).toContainText('The words you use at least twice this month will show here.');
    await expect(card.getByRole('list')).toHaveCount(0);
  });
});
