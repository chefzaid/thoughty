import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import type { MockEntry, MockEntryRevision } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

const THEMES = ['dark', 'light'] as const;

// Cards with everything a card can show: tags, titles, times, moods, Markdown with a task list
// and a link to another entry, same-day numbers, a favorite, a public entry, and an archived one.
const ENTRIES: MockEntry[] = [
  { id: 61, date: '2026-10-20', index: 1, title: 'Harbor run', time_of_day: '07:30', mood: 4, feelings: ['calm'], content: 'A morning run by the harbor.', tags: ['running'], visibility: 'public', is_favorite: true, diaryId: 1 },
  { id: 62, date: '2026-10-20', index: 2, content: '## Errands\n\n- [x] Buy bread\n- [ ] Call the bank\n\nSee [[2026-10-19]] for the morning plan.', format: 'markdown', tags: ['errands'], visibility: 'private', diaryId: 2 },
  { id: 63, date: '2026-10-19', index: 1, content: 'Morning coffee, then a slow morning.', tags: [], visibility: 'private', mood: 2, diaryId: 1 },
  { id: 64, date: '2026-10-18', index: 1, content: 'Old morning notes, put away.', tags: ['archive'], visibility: 'private', is_archived: true, diaryId: 1 },
];

// Earlier versions of the first card, with everything a revision can show; the other cards have none.
const REVISIONS: Record<number, MockEntryRevision[]> = {
  61: [
    { id: 611, entryId: 61, content: 'A run by the harbor.', title: 'Harbor', timeOfDay: '07:00', mood: 3, feelings: ['tired'], tags: ['running'], date: '2026-10-20', format: 'plain', visibility: 'private', createdAt: '2026-10-20T08:00:00.000Z' },
    { id: 612, entryId: 61, content: 'A short run.', tags: [], date: '2026-10-20', format: 'plain', visibility: 'private', createdAt: '2026-10-20T09:00:00.000Z' },
  ],
};

async function openHistory(page: Page, entryId: number) {
  const entry = page.locator(`#entry-${entryId}`);
  await entry.getByLabel('More actions').click();
  await page.getByRole('menuitem', { name: 'View history' }).click();
  await expect(entry.getByRole('heading', { name: 'History' })).toBeVisible();
  return entry;
}

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations.map(({ help, id, impact, nodes }) => ({
    help,
    id,
    impact,
    // The summary keeps the measured colors and ratio, so a failure says why, not just where.
    nodes: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));

  expect(violations).toEqual([]);
}

test.describe('journal accessibility with entries', () => {
  test.setTimeout(60_000);

  for (const theme of THEMES) {
    for (const highContrast of [false, true]) {
      const mode = `${theme}${highContrast ? ' high contrast' : ''}`;

      test(`${mode} entry cards, search highlights, and every filter set`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, config: { theme, highContrast }, initialEntries: ENTRIES });
        await page.goto('/journal');
        await page.getByRole('button', { name: 'All Diaries' }).click();
        await expect(page.locator('#entry-62').getByRole('checkbox', { name: 'Call the bank' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Back to top' })).toBeVisible();
        await expectNoAccessibilityViolations(page);

        await page.getByRole('textbox', { name: 'Search entries' }).fill('morning');
        await expect(page.locator('#entry-63 mark').first()).toBeVisible();
        await expect(page.getByRole('group', { name: 'Order of search results' })).toBeVisible();
        await expectNoAccessibilityViolations(page);

        await page.getByRole('button', { name: 'Filter archived entries' }).click();
        await expect(page.locator('#entry-64')).toBeVisible();
        await page.getByRole('button', { name: 'Visibility', exact: true }).click();
        await page.getByRole('button', { name: 'Favorites', exact: true }).click();
        await page.getByRole('combobox', { name: 'Filter by mood' }).selectOption({ label: 'With a mood' });
        await expect(page.getByText('No entries found')).toBeVisible();
        await expectNoAccessibilityViolations(page);

        await page.getByRole('button', { name: 'Filter archived entries' }).click();
        await expect(page.locator('#entry-61 mark').first()).toBeVisible();
        await expectNoAccessibilityViolations(page);
      });

      test(`${mode} revision history, empty and with revisions`, async ({ page }) => {
        await setupMockApp(page, {
          startAuthenticated: true,
          config: { theme, highContrast },
          initialEntries: ENTRIES,
          initialRevisions: REVISIONS,
        });
        await page.goto('/journal');
        await page.getByRole('button', { name: 'All Diaries' }).click();

        const emptyHistory = await openHistory(page, 63);
        await expect(emptyHistory.getByText('No previous versions')).toBeVisible();
        await expectNoAccessibilityViolations(page);

        const fullHistory = await openHistory(page, 61);
        await expect(fullHistory.getByText('Revision #2')).toBeVisible();
        await expect(fullHistory.getByText('A short run.')).toBeVisible();
        await expect(fullHistory.getByText('A run by the harbor.')).toBeVisible();
        await expectNoAccessibilityViolations(page);
      });

      test(`${mode} Markdown composer and entry editor`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, config: { theme, highContrast }, initialEntries: ENTRIES });
        await page.goto('/journal');
        await page.getByRole('button', { name: 'All Diaries' }).click();
        await page.getByTitle('Plain text - click to enable Markdown formatting').click();
        const composer = page.locator('form').first();
        await expect(composer.getByRole('button', { name: 'Add bold text (ctrl + b)' })).toBeVisible();
        await composer.getByRole('button', { name: 'Insert a heading' }).click();
        await expect(composer.getByRole('button', { name: 'Insert a level 2 heading (ctrl + 2)' })).toBeVisible();
        await expectNoAccessibilityViolations(page);

        await page.locator('#entry-62').getByRole('button', { name: 'Edit' }).click();
        await expect(page.locator('#entry-62').getByRole('button', { name: 'Add a task list (ctrl + shift + c)' })).toBeVisible();
        await expectNoAccessibilityViolations(page);
      });
    }
  }
});
