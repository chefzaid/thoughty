import type { Page } from '@playwright/test';

import AxeBuilder from '../support/axe';
import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry, SetupMockAppOptions } from '../support/mockApp.shared';

const MINE: MockEntry = {
  id: 10,
  userId: 1,
  date: '2026-11-20',
  index: 1,
  title: 'Morning walk',
  content: 'The river was quiet today',
  format: 'plain',
  tags: [],
  visibility: 'public',
};
const THEIRS: MockEntry = {
  id: 11,
  userId: 2,
  authorUsername: 'Maya',
  date: '2026-11-19',
  index: 1,
  content: 'Rain over the harbour',
  format: 'plain',
  tags: [],
  visibility: 'public',
};

const NOTIFICATIONS: NonNullable<SetupMockAppOptions['notifications']> = [
  {
    id: 'comment:5',
    type: 'comment',
    createdAt: '2026-11-21T09:00:00.000Z',
    unread: true,
    actor: { id: 2, username: 'Maya', avatarUrl: null },
    entry: { id: 10, date: '2026-11-20', index: 1, title: 'Morning walk' },
    comment: { id: 5, excerpt: 'What a lovely walk' },
  },
  {
    id: 'entryLike:10:3',
    type: 'entryLike',
    createdAt: '2026-11-21T08:00:00.000Z',
    unread: true,
    actor: { id: 3, username: 'Sam', avatarUrl: null },
    entry: { id: 10, date: '2026-11-20', index: 1, title: 'Morning walk' },
    comment: null,
  },
  {
    id: 'follow:4',
    type: 'follow',
    createdAt: '2026-11-18T08:00:00.000Z',
    unread: false,
    actor: { id: 4, username: 'Lee', avatarUrl: null },
    entry: null,
    comment: null,
  },
];

const setup = (page: Page, config: SetupMockAppOptions['config'] = {}) =>
  setupMockApp(page, {
    startAuthenticated: true,
    initialEntries: [MINE, THEIRS],
    comments: [{ id: 5, entryId: 10, userId: 2, username: 'Maya', content: 'What a lovely walk', createdAt: '2026-11-21T09:00:00.000Z' }],
    notifications: NOTIFICATIONS,
    config,
  });

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('notifications', () => {
  test('lists comments, likes and followers from the bell, marks them read and opens an entry in the feed', async ({ page }) => {
    const { state } = await setup(page);
    await page.goto('/journal');

    const bell = page.getByRole('button', { name: 'Notifications, 2 new' });
    await expect(bell.locator('.nav-notifications-badge')).toHaveText('2');
    await bell.click();

    const panel = page.getByRole('region', { name: 'Notifications', exact: true });
    await expect(panel.getByRole('listitem')).toHaveCount(3);
    await expect(panel.getByRole('button', { name: /Maya commented on “Morning walk”/ })).toContainText('What a lovely walk');
    await expect(panel.getByRole('button', { name: /Sam liked “Morning walk”/ })).toBeVisible();
    await expect(panel.getByText('Lee started following you')).toBeVisible();
    await expect.poll(() => state.notifications.some((notification) => notification.unread)).toBe(false);
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations(page, '.nav-notifications');

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeFocused();

    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await panel.getByRole('button', { name: /Maya commented/ }).click();
    await expect(page).toHaveURL(/\/feed\?entry=10$/);
    await expect(panel).toBeHidden();
    const cards = page.locator('.feed-entry');
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('The river was quiet today');
    await expect(page.getByText('One entry, from your notifications')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Feed view' })).toHaveCount(0);
    // The thread is open on the comment the notification was about
    await expect(cards.locator('.feed-comment-list')).toContainText('What a lovely walk');
    await expectNoAxeViolations(page, '.feed-page');

    await page.getByRole('button', { name: 'Show the whole feed' }).click();
    await expect(page).toHaveURL(/\/feed$/);
    await expect(page.getByRole('group', { name: 'Feed view' })).toBeVisible();
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Rain over the harbour');
  });

  test('says only that something is new in quiet mode, readable in the light theme', async ({ page }) => {
    await setup(page, { theme: 'light', quietMode: true });
    await page.goto('/journal');

    const bell = page.getByRole('button', { name: 'Notifications, some new' });
    await expect(bell).toBeVisible();
    await expect(bell.locator('.nav-notifications-badge')).toHaveText('');
    await bell.click();
    await expect(page.getByRole('region', { name: 'Notifications', exact: true }).getByRole('listitem')).toHaveCount(3);
    await expectNoAxeViolations(page, '.nav-notifications');
  });

  test('says when an entry a notification led to is no longer in the feed', async ({ page }) => {
    await setup(page);
    await page.goto('/feed?entry=99');

    await expect(page.getByText('This entry is no longer in the feed.')).toBeVisible();
  });
});
