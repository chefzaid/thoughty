import AxeBuilder from '../support/axe';
import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockComment, MockEntry } from '../support/mockApp.shared';

const publicEntry = (id: number, userId: number, authorUsername: string, content: string, extra: Partial<MockEntry> = {}): MockEntry => ({
  id,
  userId,
  authorUsername,
  date: `2026-07-${String(10 + id).padStart(2, '0')}`,
  index: 1,
  content,
  tags: [],
  visibility: 'public',
  ...extra,
});

const comment = (id: number, entryId: number, userId: number, username: string, content: string, extra: Partial<MockComment> = {}): MockComment => ({
  id,
  entryId,
  userId,
  username,
  content,
  createdAt: `2026-07-2${id}T09:00:00.000Z`,
  ...extra,
});

const OWN_ENTRY = publicEntry(2, 1, 'TestUser', 'My public thought');
const OWN_COMMENTS = [
  comment(1, 2, 2, 'Maya', 'Lovely morning note'),
  comment(2, 2, 3, 'Sam', 'Something unkind'),
  comment(3, 2, 4, 'Leo', 'This one is worth reading'),
];

test.describe('comment controls', () => {
  test('lets the writer choose who comments, hide one comment and pin another on top', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [OWN_ENTRY], comments: OWN_COMMENTS });
    await page.goto('/feed');
    await page.getByRole('button', { name: 'My public entries' }).click();
    const card = page.locator('.feed-entry', { hasText: 'My public thought' });
    await card.getByRole('button', { name: 'Comments (3)' }).click();
    const comments = card.locator('.feed-comment-text');
    await expect(comments).toHaveText(['Lovely morning note', 'Something unkind', 'This one is worth reading']);

    await card.getByRole('button', { name: 'Hide the comment by Sam' }).click();
    await expect(card.getByText('Hidden: only you and Sam see it')).toBeVisible();
    await card.getByRole('button', { name: 'Pin the comment by Leo on top' }).click();
    await expect(card.getByRole('button', { name: 'Unpin the comment by Leo' })).toHaveAttribute('aria-pressed', 'true');
    await expect(comments).toHaveText(['This one is worth reading', 'Lovely morning note', 'Something unkind']);
    await expect(card.locator('.feed-comment.pinned')).toContainText('Pinned');
    expect(state.comments.map(({ id, hidden, pinned }) => ({ id, hidden: Boolean(hidden), pinned: Boolean(pinned) }))).toEqual([
      { id: 1, hidden: false, pinned: false },
      { id: 2, hidden: true, pinned: false },
      { id: 3, hidden: false, pinned: true },
    ]);

    const policy = card.getByLabel('Who can comment');
    await expect(policy).toHaveValue('everyone');
    await policy.selectOption('closed');
    await expect(card.getByText('Comments are closed. The ones already here stay readable.')).toBeVisible();
    await expect(card.getByLabel('Write a comment')).toHaveCount(0);
    await expect.poll(() => state.entries[0].commentPolicy).toBe('closed');

    // Reopened, the thread reads the choices back from the API
    await card.getByRole('button', { name: 'Comments (3)' }).click();
    await card.getByRole('button', { name: 'Comments (3)' }).click();
    await expect(card.getByLabel('Who can comment')).toHaveValue('closed');
    await expect(comments).toHaveText(['This one is worth reading', 'Lovely morning note', 'Something unkind']);
  });

  test('tells a reader who may comment, and shows them their own hidden comment', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        publicEntry(1, 2, 'Maya', 'Maya writes for her followers', { commentPolicy: 'followers' }),
        publicEntry(3, 3, 'Sam', 'Sam closed this one', { commentPolicy: 'closed' }),
      ],
      comments: [comment(1, 1, 1, 'TestUser', 'My earlier comment', { hidden: true }), comment(2, 1, 4, 'Leo', 'Hidden from you', { hidden: true })],
    });
    await page.goto('/feed');

    const maya = page.locator('.feed-entry', { hasText: 'Maya writes for her followers' });
    // Leo's hidden comment is not counted for this reader
    await maya.getByRole('button', { name: 'Comments (1)' }).click();
    await expect(maya.getByText("Hidden by the entry's writer: only you and they see it")).toBeVisible();
    await expect(maya.getByText('Hidden from you')).toHaveCount(0);
    await expect(maya.getByText('Only followers of Maya can comment.')).toBeVisible();
    await expect(maya.getByLabel('Write a comment')).toHaveCount(0);
    await expect(maya.getByLabel('Who can comment')).toHaveCount(0);

    await maya.getByRole('button', { name: 'Follow Maya' }).click();
    await expect.poll(() => state.followedUserIds).toEqual([2]);
    await maya.getByRole('button', { name: 'Comments (1)' }).click();
    await maya.getByRole('button', { name: 'Comments (1)' }).click();
    await maya.getByLabel('Write a comment').fill('Now I follow you');
    await maya.getByRole('button', { name: 'Post' }).click();
    await expect(maya.getByText('Now I follow you')).toBeVisible();

    const sam = page.locator('.feed-entry', { hasText: 'Sam closed this one' });
    await sam.getByRole('button', { name: 'Comments (0)' }).click();
    await expect(sam.getByText('Comments are closed. The ones already here stay readable.')).toBeVisible();
  });

  test('sets in Profile who may comment on public entries without a choice of their own', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [OWN_ENTRY] });
    await page.goto('/profile');
    const setting = page.getByRole('combobox', { name: 'Who can comment' });
    await expect(setting).toHaveValue('everyone');
    await setting.selectOption('followers');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => state.config.defaultCommentPolicy).toBe('followers');

    await page.goto('/feed');
    await page.getByRole('button', { name: 'My public entries' }).click();
    await page.getByRole('button', { name: 'Comments (0)' }).click();
    await expect(page.getByLabel('Who can comment')).toHaveValue('followers');
    // The writer may still comment on their own entry
    await expect(page.getByLabel('Write a comment')).toBeVisible();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`keeps pinned and hidden comments and the controls accessible in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [OWN_ENTRY],
        comments: [OWN_COMMENTS[0], { ...OWN_COMMENTS[1], hidden: true }, { ...OWN_COMMENTS[2], pinned: true }],
      });
      await page.goto('/feed');
      await page.getByRole('button', { name: 'My public entries' }).click();
      await page.getByRole('button', { name: 'Comments (3)' }).click();
      await expect(page.getByText('Pinned', { exact: true })).toBeVisible();
      await expect(page.getByText('Hidden: only you and Sam see it')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('.feed-page')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }
});
