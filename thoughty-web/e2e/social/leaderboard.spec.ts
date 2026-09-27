import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

const entries = [
  { id: 1, userId: 2, authorUsername: 'Maya', date: '2026-07-11', index: 1, content: 'Maya on mornings', tags: [], visibility: 'public' as const, likeCount: 5 },
  { id: 2, userId: 2, authorUsername: 'Maya', date: '2026-07-12', index: 1, content: 'Maya on evenings', tags: [], visibility: 'public' as const, likeCount: 1 },
  { id: 3, userId: 3, authorUsername: 'Sam', date: '2026-07-13', index: 1, content: 'Sam on running', tags: [], visibility: 'public' as const },
];
const comments = [
  { id: 1, entryId: 3, userId: 2, username: 'Maya', content: 'Keep going', createdAt: '2026-07-20T09:00:00.000Z' },
];

test.describe('leaderboard', () => {
  test('opens from the feed, switches periods, and returns to the feed', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, comments });

    await page.goto('/feed');
    await page.getByRole('button', { name: 'Leaderboard' }).click();

    await expect(page).toHaveURL(/\/feed\?view=leaderboard$/);
    await expect(page.getByRole('heading', { name: 'Leaderboard', level: 1 })).toBeVisible();
    const active = page.getByRole('region', { name: 'Most active writers' });
    await expect(active.getByRole('listitem').first()).toContainText('Maya');
    await expect(active.getByRole('listitem').first()).toContainText('Public entries: 2');
    const liked = page.getByRole('region', { name: 'Most liked entries' });
    await expect(liked.getByRole('listitem').first()).toContainText('Maya on mornings');
    await expect(liked.getByRole('listitem').first()).toContainText('Likes: 5');
    const commented = page.getByRole('region', { name: 'Most commented entries' });
    await expect(commented.getByRole('listitem')).toHaveCount(1);
    await expect(commented).toContainText('Sam on running');

    const allTime = page.waitForRequest((request) => request.url().includes('/api/leaderboard?period=all'));
    await page.getByRole('button', { name: 'All time' }).click();
    await allTime;
    await expect(page.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Back to the feed' }).click();
    await expect(page).toHaveURL(/\/feed$/);
    await expect(page.getByRole('heading', { name: 'Feed' })).toBeVisible();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`is accessible and fits a phone in the ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await setupMockApp(page, { startAuthenticated: true, config: { theme }, initialEntries: entries, comments });
      await page.goto('/feed?view=leaderboard');
      await expect(page.getByRole('region', { name: 'Most liked entries' })).toContainText('Maya on mornings');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.leaderboard-page')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    });
  }
});
