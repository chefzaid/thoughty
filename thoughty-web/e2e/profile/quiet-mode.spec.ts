import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';

import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

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
  entry(1, '2025-03-15', 'Tram 28 up the hill, then fish by the river.', { tags: ['travel'], is_favorite: true }),
  entry(2, '2025-03-16', 'Packed for Lisbon and forgot the charger again.', { tags: ['travel'], visibility: 'public', likeCount: 6 }),
  entry(3, '2025-04-02', 'Maya writes about mornings.', { userId: 2, authorUsername: 'Maya', visibility: 'public', likeCount: 4 }),
];

/** An entry card's "10 words / 1 min read" line. */
const wordCounts = (page: Page) => page.getByText(/^\d+ words?$/);

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Quiet mode', () => {
  test('is off by default, turns on in the profile, and stays on after a reload', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });

    await page.goto('/journal');
    await expect(page.getByText('Tram 28 up the hill')).toBeVisible();
    await expect(wordCounts(page).first()).toBeVisible();

    await page.goto('/profile');
    const quiet = page.getByRole('switch', { name: 'Quiet mode' });
    await expect(quiet).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('region', { name: 'Achievements' })).toBeVisible();

    await quiet.click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => state.config.quietMode).toBe(true);
    await expect(page.getByRole('region', { name: 'Achievements' })).toHaveCount(0);

    await page.goto('/journal');
    await expect(page.getByText('Tram 28 up the hill')).toBeVisible();
    await expect(wordCounts(page)).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('Tram 28 up the hill')).toBeVisible();
    await expect(wordCounts(page)).toHaveCount(0);
    await page.goto('/profile');
    await expect(page.getByRole('switch', { name: 'Quiet mode' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('region', { name: 'Achievements' })).toHaveCount(0);

    // Turned off again, the numbers come back
    await page.getByRole('switch', { name: 'Quiet mode' }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => state.config.quietMode).toBe(false);
    await expect(page.getByRole('region', { name: 'Achievements' })).toBeVisible();
  });

  test('keeps the stats readings and the year in review without their numbers', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, config: { quietMode: true } });

    await page.goto('/stats?diary=all');
    await expect(page.getByText('Quiet mode is on, so counts and goals are hidden here.')).toBeVisible();
    await expect(page.getByText('Total Entries')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Journal Activity by Day' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Writing goal' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Recorded moods' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your year in review' })).toContainText('Themes, the moments worth rereading');
    await expectNoAccessibilityViolations(page);

    await page.getByRole('button', { name: 'Open the year in review' }).click();
    await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2025');
    await expect(page.getByRole('heading', { level: 1, name: 'Your 2025 in review' })).toBeVisible();
    const themes = page.getByRole('region', { name: 'What filled your pages' });
    await expect(themes.getByText('travel')).toBeVisible();
    await expect(themes).not.toContainText(/\d/);
    await expect(page.getByRole('region', { name: 'Moments to reread' })).toContainText('Tram 28 up the hill');
    await expect(page.getByText(/Your busiest month/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Share a summary' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();
  });

  test('keeps likes, comments and focus mode without counts, and has no leaderboard', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, config: { quietMode: true } });

    await page.goto('/feed');
    const like = page.getByRole('button', { name: 'Like the entry by Maya', exact: true });
    await expect(like).toHaveText('');
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => state.likedEntryIds).toEqual([3]);
    await expect(page.getByRole('button', { name: 'Comments', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leaderboard' })).toHaveCount(0);

    await page.goto('/feed?view=leaderboard');
    await expect(page).toHaveURL(/\/feed$/);
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toHaveCount(0);

    await page.goto('/journal');
    await page.getByRole('button', { name: /Write in focus mode/ }).first().click();
    const focus = page.getByRole('dialog', { name: 'Focus mode' });
    await focus.getByRole('textbox', { name: 'Entry text' }).fill('A few words for the sprint');
    await expect(focus.getByText(/\d+ words?$/)).toHaveCount(0);
    await expect(focus.getByLabel('Session goal in words')).toHaveCount(0);
    await expect(focus.getByLabel('Timed sprint')).toBeVisible();
  });

  test('is named in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });

    await page.goto('/profile');
    await expect(page.getByRole('switch', { name: 'Mode calme' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('Masquer partout les séries, badges, karma')).toBeVisible();
  });
});
