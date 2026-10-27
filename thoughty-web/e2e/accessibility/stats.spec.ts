import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';

import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

const THEMES = ['dark', 'light'] as const;

const ENTRIES: MockEntry[] = [
  { id: 71, date: '2025-03-02', index: 1, content: 'A walk along the canal.', tags: ['walks', 'city'], visibility: 'private', mood: 4, diaryId: 1 },
  { id: 72, date: '2025-11-14', index: 1, content: 'Notes from the book club.', tags: ['books'], visibility: 'private', diaryId: 1 },
  { id: 73, date: '2026-01-05', index: 1, content: 'New year, new notebook.', tags: ['books', 'plans'], visibility: 'private', diaryId: 1 },
  { id: 74, date: '2026-01-06', index: 1, content: 'Snow on the balcony.', tags: ['walks'], visibility: 'private', mood: 3, diaryId: 2 },
  { id: 75, date: '2026-01-06', index: 2, content: 'Soup for dinner.', tags: [], visibility: 'private', diaryId: 2 },
];

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations.map(({ id, nodes }) => ({
    id,
    nodes: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));

  expect(violations).toEqual([]);
}

test.describe('stats accessibility with entries', () => {
  test.setTimeout(60_000);

  for (const theme of THEMES) {
    for (const highContrast of [false, true]) {
      const mode = `${theme}${highContrast ? ' high contrast' : ''}`;

      test(`${mode} charts, their data tables, and the activity map`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, config: { theme, highContrast }, initialEntries: ENTRIES });
        await page.goto('/stats?diary=all');
        await expect(page.getByRole('img', { name: 'Entries per Year' })).toBeVisible();
        await expectNoAccessibilityViolations(page);

        for (const title of ['Entries per Year', 'Entries per Month', 'Top Tags']) {
          const card = page.locator('.chart-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
          await card.getByRole('button', { name: 'Show as table' }).click();
          await expect(card.getByRole('table', { name: title })).toBeVisible();
        }
        await page.getByRole('grid', { name: 'Journal Activity by Day' }).focus();
        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('.heatmap-active-day')).toHaveText('0 entries on Dec 30, 2025');
        await expectNoAccessibilityViolations(page);
      });
    }
  }
});

test.describe('stats charts and activity map for assistive technology', () => {
  test('name and describe each chart, show its values as a table, and move through the days by keyboard', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/stats?diary=all');

    const perYear = page.getByRole('img', { name: 'Entries per Year' });
    await expect(perYear).toHaveAccessibleDescription('2025: 2 entries; 2026: 3 entries');
    await expect(page.getByRole('img', { name: 'Top Tags' })).toHaveAccessibleDescription('walks: 2 entries; books: 2 entries; plans: 1 entry; city: 1 entry');

    const yearCard = page.locator('.chart-card').filter({ has: page.getByRole('heading', { name: 'Entries per Year', exact: true }) });
    const toggle = yearCard.getByRole('button', { name: 'Show as table' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const table = yearCard.getByRole('table', { name: 'Entries per Year' });
    await expect(table.getByRole('row')).toHaveCount(3);
    await expect(table.getByRole('row', { name: '2026 3' })).toBeVisible();
    await expect(perYear).toHaveCount(0);
    await toggle.click();
    await expect(perYear).toBeVisible();

    // One tab stop for the year of days; the arrows move the active day, Enter opens it
    const grid = page.getByRole('grid', { name: 'Journal Activity by Day' });
    await expect(grid).toHaveAccessibleDescription(/Arrow keys move by a day or a week/);
    await grid.focus();
    const activeDay = async () => page.locator(`[id="${await grid.getAttribute('aria-activedescendant')}"]`);
    await expect(await activeDay()).toHaveAccessibleName('2 entries on Jan 6, 2026');
    await page.keyboard.press('ArrowUp');
    await expect(await activeDay()).toHaveAccessibleName('1 entry on Jan 5, 2026');
    await page.keyboard.press('ArrowLeft');
    await expect(await activeDay()).toHaveAccessibleName('0 entries on Dec 29, 2025');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(await activeDay()).toHaveAccessibleName('2 entries on Jan 6, 2026');
    await page.keyboard.press('Control+Home');
    await expect(await activeDay()).toHaveAccessibleName('0 entries on Jan 6, 2025');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await expect(await activeDay()).toHaveAccessibleName('0 entries on Mar 6, 2025');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Home');
    await expect(await activeDay()).toHaveAccessibleName('0 entries on Feb 24, 2025');
    await page.keyboard.press('End');
    await expect(await activeDay()).toHaveAccessibleName('1 entry on Mar 2, 2025');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.getByText('A walk along the canal.')).toBeVisible();
  });

  test('speak French in the charts and the activity map', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { language: 'fr' } });
    await page.goto('/stats?diary=all');

    await expect(page.getByRole('img', { name: 'Entrées par mois' })).toHaveAccessibleDescription(
      'mars 2025 : 1 entrée; nov. 2025 : 1 entrée; janv. 2026 : 3 entrées',
    );
    const monthCard = page.locator('.chart-card').filter({ has: page.getByRole('heading', { name: 'Entrées par mois', exact: true }) });
    await monthCard.getByRole('button', { name: 'Afficher en tableau' }).click();
    await expect(monthCard.getByRole('columnheader', { name: 'Mois' })).toBeVisible();
    await expect(monthCard.getByRole('columnheader', { name: 'Entrées' })).toBeVisible();
    await expect(page.getByRole('grid', { name: 'Activité du journal par jour' })).toHaveAccessibleDescription(/Entrée ouvre le jour/);
  });
});
