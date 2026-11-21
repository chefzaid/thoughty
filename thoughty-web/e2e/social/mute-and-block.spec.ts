import AxeBuilder from '../support/axe';
import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const publicEntry = (id: number, userId: number, authorUsername: string, content: string): MockEntry => ({
  id,
  userId,
  authorUsername,
  date: `2026-07-${String(10 + id).padStart(2, '0')}`,
  index: 1,
  content,
  format: 'plain',
  tags: ['community'],
  visibility: 'public',
});

const follower = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-07-01T12:00:00.000Z' });

const axeViolations = async (page: import('@playwright/test').Page, selector: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
};

test.describe('muting and blocking writers', () => {
  test('mutes a writer from the feed, blocks another after asking, and undoes both in Profile › Privacy', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      followedUserIds: [3],
      followerCount: 1,
      writers: { followers: [follower(3, 'Sam')] },
      savedEntryIds: [2],
      initialEntries: [
        publicEntry(1, 2, 'Maya', 'Maya writes about mornings'),
        publicEntry(2, 3, 'Sam', 'Sam writes about running'),
        publicEntry(3, 4, 'Lin', 'Lin writes about tea'),
      ],
      comments: [{ id: 50, entryId: 3, userId: 2, username: 'Maya', content: 'Maya likes tea too', createdAt: '2026-07-14T10:00:00.000Z' }],
    });
    await page.goto('/feed');

    // Mute: Maya's entry leaves the feed, and her comment under Lin's entry with it
    const menuButton = page.getByRole('button', { name: 'More for Maya' });
    await menuButton.click();
    const menu = page.getByRole('menu', { name: 'More for Maya' });
    await expect(menu.getByRole('menuitem', { name: 'Mute Maya' })).toBeFocused();
    expect(await axeViolations(page, '.feed-page')).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(page.getByText('Maya writes about mornings')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'You muted Maya' })).toBeVisible();
    await expect.poll(() => state.writers.muted).toEqual([2]);
    await page.getByRole('button', { name: 'Comments (0)' }).click();
    await expect(page.getByText('No comments yet')).toBeVisible();

    // Block asks first and says the other writer is not told
    await page.getByRole('button', { name: 'More for Sam' }).click();
    await page.getByRole('menuitem', { name: 'Block Sam' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Block Sam?' });
    await expect(dialog).toContainText('Sam is not told.');
    expect(await axeViolations(page, '[role="alertdialog"]')).toEqual([]);
    await dialog.getByRole('button', { name: 'Block', exact: true }).click();
    await expect(page.getByText('Sam writes about running')).toHaveCount(0);
    await expect.poll(() => ({ blocked: state.writers.blocked, follows: state.followedUserIds, saved: state.savedEntryIds }))
      .toEqual({ blocked: [3], follows: [], saved: [] });
    await page.getByRole('button', { name: 'Following', exact: true }).click();
    await expect(page.getByText('Nobody follows you yet.')).toBeVisible();

    // Profile › Privacy lists both, each to undo
    await page.goto('/profile');
    const muted = page.getByRole('list', { name: 'Muted' });
    const blocked = page.getByRole('list', { name: 'Blocked' });
    await expect(muted).toContainText('Maya');
    await expect(blocked).toContainText('Sam');
    expect(await axeViolations(page, '.hidden-writers')).toEqual([]);
    await muted.getByRole('button', { name: 'Unmute Maya' }).click();
    await blocked.getByRole('button', { name: 'Unblock Sam' }).click();
    await expect(page.getByText('You have not muted or blocked anyone.')).toBeVisible();

    await page.goto('/feed');
    await expect(page.getByText('Maya writes about mornings')).toBeVisible();
    await expect(page.getByText('Sam writes about running')).toBeVisible();
  });

  test('removes a follower quietly from the Following tab, in French', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      followerCount: 2,
      writers: { followers: [follower(5, 'Zed'), follower(6, 'Ana')] },
    });
    await page.goto('/feed');

    await page.getByRole('button', { name: 'Abonnements', exact: true }).click();
    const list = page.getByRole('list', { name: 'Vos abonnés' });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await list.getByRole('button', { name: 'Retirer Zed de vos abonnés' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByText('Abonnés : 1')).toBeVisible();
    expect(state.writers.followers.map((user) => user.username)).toEqual(['Ana']);
  });
});
