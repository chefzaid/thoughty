import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

const ownEntries = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  userId: 1,
  date: `2026-07-${String(10 + index).padStart(2, '0')}`,
  index: 1,
  content: `Day ${index + 1}`,
  tags: [],
  visibility: index === 0 ? 'public' as const : 'private' as const,
  likeCount: index === 0 ? 6 : 0,
}));

test.describe('achievements', () => {
  test('shows karma, stats, and badges on the profile', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      followerCount: 3,
      initialEntries: ownEntries,
      comments: [{ id: 1, entryId: 1, userId: 2, username: 'Maya', content: 'Nice', createdAt: '2026-07-20T09:00:00.000Z' }],
    });

    await page.goto('/profile');
    const section = page.getByRole('region', { name: 'Achievements' });

    await expect(section.getByText('10', { exact: true })).toBeVisible();
    await expect(section.getByText('Karma', { exact: true })).toBeVisible();
    const earned = section.getByRole('listitem').filter({ hasText: 'Week-long streak' });
    await expect(earned).toContainText('Earned');
    const locked = section.getByRole('listitem').filter({ hasText: 'Well liked' });
    await expect(locked).toContainText('Receive 10 likes.');
    await expect(locked.getByRole('progressbar', { name: 'Progress: 6 of 10' })).toBeVisible();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`keeps the achievements section accessible in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, config: { theme }, initialEntries: ownEntries });
      await page.goto('/profile');
      await expect(page.getByRole('region', { name: 'Achievements' }).getByText('Earned').first()).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.achievements-section')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }
});
