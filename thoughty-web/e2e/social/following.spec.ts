import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

const publicEntry = (id: number, userId: number, authorUsername: string, content: string) => ({
  id,
  userId,
  authorUsername,
  date: `2026-07-${String(10 + id).padStart(2, '0')}`,
  index: 1,
  content,
  tags: ['community'],
  visibility: 'public' as const,
});

test.describe('following authors', () => {
  test('follows an author from the community feed and reads them in the Following view', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      followerCount: 3,
      initialEntries: [
        publicEntry(1, 2, 'Maya', 'Maya writes about mornings'),
        publicEntry(2, 3, 'Sam', 'Sam writes about running'),
        publicEntry(3, 2, 'Maya', 'Maya writes about evenings'),
      ],
    });

    await page.goto('/feed');
    await expect(page.getByText('Maya writes about mornings')).toBeVisible();

    await page.locator('.feed-entry', { hasText: 'Maya writes about mornings' })
      .getByRole('button', { name: 'Follow Maya' })
      .click();

    await expect(page.getByRole('button', { name: 'Following Maya' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Follow Sam' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => state.followedUserIds).toEqual([2]);

    await page.getByRole('button', { name: 'Following', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'People you follow' })).toBeVisible();
    await expect(page.getByText('Following: 1')).toBeVisible();
    await expect(page.getByText('Followers: 3')).toBeVisible();
    await expect(page.getByText('Maya writes about evenings')).toBeVisible();
    await expect(page.getByText('Sam writes about running')).toHaveCount(0);
  });

  test('unfollows from the following list and shows the empty state', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      followedUserIds: [2],
      initialEntries: [publicEntry(1, 2, 'Maya', 'Maya writes about mornings')],
    });

    await page.goto('/feed');
    await page.getByRole('button', { name: 'Following', exact: true }).click();
    await expect(page.getByText('Maya writes about mornings')).toBeVisible();

    await page.getByRole('button', { name: 'Unfollow Maya' }).click();

    await expect(page.getByText('You are not following anyone yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow Maya' })).toBeVisible();
    await expect.poll(() => state.followedUserIds).toEqual([]);
  });

  test('never offers to follow your own public entries', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [publicEntry(1, 1, 'TestUser', 'My own public thought')],
    });

    await page.goto('/feed');
    await page.getByRole('button', { name: 'My public entries' }).click();

    await expect(page.getByText('My own public thought')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Follow(ing)? TestUser$/ })).toHaveCount(0);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`keeps follow controls accessible in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        followedUserIds: [2],
        initialEntries: [
          publicEntry(1, 2, 'Maya', 'Maya writes about mornings'),
          publicEntry(2, 3, 'Sam', 'Sam writes about running'),
        ],
      });

      await page.goto('/feed');
      await expect(page.getByRole('button', { name: 'Follow Sam' })).toBeVisible();
      await page.getByRole('button', { name: 'Following', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Unfollow Maya' })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.feed-page')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }
});
