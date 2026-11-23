import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';
import { goToView } from '../support/navigation';

const TODAY = '2026-11-21';
const AI_OFF_NOTE = 'AI is off for this diary: no AI feature reads its entries.';
const LEFT_OUT = 'Diaries with AI off are left out.';
const diaries = [
  mockDiary({ id: 1, name: 'Work', icon: '💼', isDefault: true }),
  mockDiary({ id: 2, name: 'Health', icon: '🩺', aiMode: 'off' }),
];
const initialEntries = [
  { id: 201, date: '2026-11-18', index: 1, content: 'A plan for the launch', tags: ['work', 'semantic-match'], visibility: 'private' as const, diaryId: 1 },
  { id: 202, date: '2026-11-19', index: 1, content: 'A visit to the clinic', tags: ['health'], visibility: 'private' as const, diaryId: 2 },
];
const axeViolations = async (page: Page, selector: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
};

test.describe('Journal-wide AI actions and a diary with AI off', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`leave the diary out of the journal, Highlights and Stats, saying so, in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, config: { theme }, diaries, initialEntries });
      await page.goto('/journal?diary=2');
      await expect(page.locator('#entry-202')).toContainText('A visit to the clinic');

      // The small AI buttons are not offered for the diary
      await expect(page.getByRole('button', { name: 'Discuss', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Find duplicates' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Meaning', exact: true })).toHaveCount(0);

      // The weekly reflection says why in its place
      await page.getByRole('button', { name: 'Highlights' }).click();
      const week = page.getByRole('dialog', { name: 'Highlights' }).getByRole('region', { name: 'Your week' });
      await expect(week.getByRole('note')).toHaveText(AI_OFF_NOTE);
      await expect(week.getByRole('button')).toHaveCount(0);
      expect(await axeViolations(page, '.weekly-reflection')).toEqual([]);
      await page.keyboard.press('Escape');

      // So do the AI readings of Stats
      await goToView(page, 'Stats');
      const toneMood = page.getByRole('region', { name: 'Tone and Mood' });
      await expect(toneMood.getByRole('note')).toHaveText(AI_OFF_NOTE);
      await expect(page.getByRole('region', { name: 'Subjects Discussed' }).getByRole('note')).toHaveText(AI_OFF_NOTE);
      const tendencies = page.getByRole('region', { name: 'Writing Tendencies' });
      await expect(tendencies.getByRole('note')).toHaveText(AI_OFF_NOTE);
      await expect(tendencies.getByRole('button', { name: 'Analyze' })).toHaveCount(0);
      expect(await axeViolations(page, '.tone-mood-card')).toEqual([]);
      expect(await axeViolations(page, '.personality-panel')).toEqual([]);
    });
  }

  test('offer every action for all diaries, saying the diaries with AI off were left out', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries, initialEntries });
    await page.goto('/journal?diary=all');
    await expect(page.locator('#entry-201')).toContainText('A plan for the launch');
    await expect(page.getByRole('button', { name: 'Discuss', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find duplicates' })).toBeVisible();

    await page.getByRole('button', { name: 'Meaning', exact: true }).click();
    await page.getByPlaceholder('Search by meaning or idea...').fill('the launch');
    await page.getByRole('button', { name: 'Search by meaning' }).click();
    await expect(page.locator('.semantic-search-control[aria-live="polite"]')).toContainText(LEFT_OUT);
    expect(state.lastAiSemanticSearchPayload).toEqual({ query: 'the launch' });

    await page.getByRole('button', { name: 'Highlights' }).click();
    const week = page.getByRole('dialog', { name: 'Highlights' }).getByRole('region', { name: 'Your week' });
    await expect(week.getByText(LEFT_OUT, { exact: false })).toBeVisible();
    await expect(week.getByRole('button', { name: 'Reflect on my week' })).toBeVisible();

    // A diary with AI on says nothing of the others
    await page.keyboard.press('Escape');
    await page.getByTitle('Work', { exact: true }).click();
    await page.getByRole('button', { name: 'Highlights' }).click();
    const workWeek = page.getByRole('dialog', { name: 'Highlights' }).getByRole('region', { name: 'Your week' });
    await expect(workWeek.getByRole('button', { name: 'Reflect on my week' })).toBeVisible();
    await expect(workWeek.getByText(LEFT_OUT, { exact: false })).toHaveCount(0);
  });

  test('offer no AI mood reading of the year for the diary, and say all diaries leave it out', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, diaries, initialEntries });
    await page.goto('/review?year=2026&diary=2');
    const mood = page.getByRole('region', { name: 'The mood of your year' });
    await expect(mood.getByRole('note')).toHaveText(AI_OFF_NOTE);
    await expect(mood.getByRole('button', { name: 'Read the mood of my year' })).toHaveCount(0);
    expect(await axeViolations(page, '.review-mood')).toEqual([]);

    await page.getByRole('combobox', { name: /^Diaries/ }).selectOption({ label: 'All Diaries' });
    await expect(mood.getByRole('button', { name: 'Read the mood of my year' })).toBeVisible();
    await expect(mood.getByText(LEFT_OUT, { exact: false })).toBeVisible();
  });
});
