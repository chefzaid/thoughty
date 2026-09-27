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
  tags: [],
  visibility: 'public' as const,
});

const mayaComment = {
  id: 1,
  entryId: 2,
  userId: 2,
  username: 'Maya',
  content: 'Lovely morning note',
  createdAt: '2026-07-20T09:00:00.000Z',
};

test.describe('comments on public entries', () => {
  test('reads and posts comments on a community entry', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [publicEntry(1, 2, 'Maya', 'Maya writes about mornings')],
      comments: [{ ...mayaComment, entryId: 1 }],
    });

    await page.goto('/feed');
    const card = page.locator('.feed-entry', { hasText: 'Maya writes about mornings' });
    await card.getByRole('button', { name: 'Comments (1)' }).click();

    await expect(card.getByText('Lovely morning note')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Delete the comment by Maya' })).toHaveCount(0);

    await card.getByLabel('Write a comment').fill('  Thanks for sharing  ');
    await card.getByRole('button', { name: 'Post' }).click();

    await expect(card.getByText('Thanks for sharing')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Comments (2)' })).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => state.comments.map((comment) => comment.content)).toEqual([
      'Lovely morning note',
      'Thanks for sharing',
    ]);
  });

  test('lets the entry owner remove a comment from their public entry', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [publicEntry(2, 1, 'TestUser', 'My public thought')],
      comments: [mayaComment],
    });

    await page.goto('/feed');
    await page.getByRole('button', { name: 'My public entries' }).click();
    const card = page.locator('.feed-entry', { hasText: 'My public thought' });
    await card.getByRole('button', { name: 'Comments (1)' }).click();

    await card.getByRole('button', { name: 'Delete the comment by Maya' }).click();
    await expect(page.getByRole('heading', { name: 'Delete comment' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(card.getByText('No comments yet. Start the conversation.')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Comments (0)' })).toBeVisible();
    await expect.poll(() => state.comments).toEqual([]);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`keeps an open thread accessible in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [publicEntry(2, 1, 'TestUser', 'My public thought')],
        comments: [mayaComment],
      });

      await page.goto('/feed');
      await page.getByRole('button', { name: 'My public entries' }).click();
      await page.getByRole('button', { name: 'Comments (1)' }).click();
      await expect(page.getByText('Lovely morning note')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.feed-page')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }
});
