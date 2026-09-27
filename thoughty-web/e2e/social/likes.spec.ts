import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

const publicEntry = (id: number, userId: number, authorUsername: string, content: string, likeCount = 0) => ({
  id,
  userId,
  authorUsername,
  date: `2026-07-${String(10 + id).padStart(2, '0')}`,
  index: 1,
  content,
  tags: [],
  visibility: 'public' as const,
  likeCount,
});

test.describe('likes', () => {
  test('likes and unlikes a community entry', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [publicEntry(1, 2, 'Maya', 'Maya writes about mornings', 2)],
    });

    await page.goto('/feed');
    const like = page.getByRole('button', { name: 'Like the entry by Maya, Likes: 2' });
    await expect(like).toHaveAttribute('aria-pressed', 'false');

    await like.click();
    const liked = page.getByRole('button', { name: 'Like the entry by Maya, Likes: 3' });
    await expect(liked).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => state.likedEntryIds).toEqual([1]);

    await liked.click();
    await expect(page.getByRole('button', { name: 'Like the entry by Maya, Likes: 2' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => state.likedEntryIds).toEqual([]);
  });

  test('likes a comment by someone else but not your own content', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [publicEntry(2, 1, 'TestUser', 'My public thought', 4)],
      comments: [
        { id: 1, entryId: 2, userId: 2, username: 'Maya', content: 'Lovely morning note', createdAt: '2026-07-20T09:00:00.000Z' },
        { id: 2, entryId: 2, userId: 1, username: 'TestUser', content: 'Thank you!', createdAt: '2026-07-21T09:00:00.000Z', likeCount: 1 },
      ],
    });

    await page.goto('/feed');
    await page.getByRole('button', { name: 'My public entries' }).click();
    const card = page.locator('.feed-entry', { hasText: 'My public thought' });
    await expect(card.getByTitle('Likes').first()).toContainText('4');
    await expect(card.getByRole('button', { name: /Like the entry/ })).toHaveCount(0);

    await card.getByRole('button', { name: 'Comments (2)' }).click();
    await expect(card.getByText('Thank you!')).toBeVisible();
    await expect(card.getByRole('button', { name: /Like the comment by TestUser/ })).toHaveCount(0);

    await card.getByRole('button', { name: 'Like the comment by Maya, Likes: 0' }).click();

    await expect(card.getByRole('button', { name: 'Like the comment by Maya, Likes: 1' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => state.likedCommentIds).toEqual([1]);
  });
});
