import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';

const entries = [
  { id: 501, date: '2024-04-15', index: 1, content: 'Sprint planning notes', tags: [], visibility: 'private' as const, diaryId: 1 },
  { id: 502, date: '2024-04-17', index: 1, content: 'Retro thoughts', tags: [], visibility: 'private' as const, diaryId: 1 },
  { id: 503, date: '2024-04-22', index: 1, content: 'Monday kickoff', tags: [], visibility: 'private' as const, diaryId: 1 },
  { id: 504, date: '2024-04-23', index: 1, content: 'one two three four five six seven eight nine ten', tags: [], visibility: 'private' as const, diaryId: 2 },
  { id: 505, date: '2024-04-24', index: 1, content: 'a short evening line', tags: [], visibility: 'private' as const, diaryId: 2 },
];

/** Scans the goal panel and the activity map. */
async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('.goal-card')
    .include('.heatmap-card')
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Writing goals', () => {
  test('sets a weekly goal on a diary and follows it on the stats and the activity map', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.clock.setFixedTime(new Date('2024-04-24T21:00:00'));

    await page.goto('/diaries?from=stats&diary=1');
    await page.locator('.diary-card', { hasText: 'Work' }).getByTitle('Edit').click();
    const editor = page.locator('.diary-card.editing');
    await editor.getByLabel('Writing goal').selectOption('entries_per_week');
    await editor.getByRole('spinbutton', { name: 'Goal target' }).fill('2');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('.diary-card', { hasText: 'Work' }).getByText('Goal: 2 entries a week')).toBeVisible();
    expect(state.diaries.find((diary) => diary.id === 1)).toEqual(expect.objectContaining({ goalType: 'entries_per_week', goalTarget: 2 }));

    await page.goto('/stats?diary=1');
    const goal = page.getByRole('region', { name: 'Writing goal' });
    await expect(goal.getByText('2 entries a week')).toBeVisible();
    await expect(goal.getByRole('progressbar', { name: '1 of 2 entries this week' })).toBeVisible();
    await expect(goal.getByText('Streak: 1 week')).toBeVisible();
    await expect(goal.getByText('Best: 1 week')).toBeVisible();

    const map = page.getByRole('grid', { name: 'Journal Activity by Day' });
    await expect(map.getByRole('gridcell', { name: '1 entry on Apr 15, 2024, weekly goal met', exact: true })).toBeVisible();
    await expect(map.getByRole('gridcell', { name: '1 entry on Apr 22, 2024', exact: true })).toBeVisible();
    await expect(page.locator('.heatmap-goal-row .heatmap-goal-week', { hasText: '✓' })).toHaveCount(1);
    await expect(page.getByText('Week that met the goal')).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`marks the days that met a daily goal and lists every diary's goal in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        initialEntries: entries,
        config: { theme },
        diaries: [
          mockDiary({ id: 1, name: 'Work', icon: '💼', isDefault: true, color: '#3B82F6', goalType: 'entries_per_week', goalTarget: 2 }),
          mockDiary({ id: 2, name: 'Personal', icon: '🏠', color: '#A855F7', goalType: 'words_per_day', goalTarget: 10 }),
        ],
      });
      await page.clock.setFixedTime(new Date('2024-04-24T21:00:00'));

      await page.goto('/stats?diary=2');
      const goal = page.getByRole('region', { name: 'Writing goal' });
      await expect(goal.getByRole('progressbar', { name: '4 of 10 words today' })).toBeVisible();
      await expect(goal.getByText('Streak: 1 day')).toBeVisible();
      await expect(page.getByRole('gridcell', { name: '1 entry on Apr 23, 2024, goal met', exact: true })).toHaveClass(/goal-met/);
      await expect(page.getByRole('gridcell', { name: '1 entry on Apr 24, 2024', exact: true })).not.toHaveClass(/goal-met/);
      await expectNoAccessibilityViolations(page);

      await page.goto('/stats?diary=all');
      await expect(goal.getByText(/Writing goals are set per diary/)).toBeVisible();
      await expect(goal.getByRole('listitem')).toHaveCount(2);
      await expect(goal.getByRole('listitem').filter({ hasText: 'Work' }).getByText('1 of 2 entries this week')).toBeVisible();
      await expect(goal.getByRole('listitem').filter({ hasText: 'Personal' }).getByText('4 of 10 words today')).toBeVisible();
      await expect(page.locator('.heatmap-cell.goal-met')).toHaveCount(0);
      await expectNoAccessibilityViolations(page);
    });
  }

  test('speaks French and offers to set a goal for a diary without one', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, config: { language: 'fr' } });

    await page.goto('/stats?diary=2');
    const goal = page.getByRole('region', { name: 'Objectif d’écriture' });
    await expect(goal.getByText('Ce journal n’a pas encore d’objectif d’écriture.')).toBeVisible();
    await goal.getByRole('button', { name: 'Fixer un objectif d’écriture' }).click();
    await expect(page).toHaveURL(/\/diaries/);
  });
});
