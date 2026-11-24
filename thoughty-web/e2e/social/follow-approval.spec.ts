import AxeBuilder from '../support/axe';
import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const publicEntry = (id: number, userId: number, authorUsername: string, content: string, title?: string): MockEntry => ({
  id,
  userId,
  authorUsername,
  date: `2026-07-${String(10 + id).padStart(2, '0')}`,
  index: 1,
  title,
  content,
  format: 'plain',
  tags: ['family'],
  visibility: 'public',
});

const writer = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-07-01T12:00:00.000Z' });

const axeViolations = async (page: import('@playwright/test').Page, selector: string) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).include(selector).analyze())
    .violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));

const SECRET = 'A letter only my approved followers read';

test.describe('followers by approval', () => {
  test('shows a teaser of an approving writer’s entry until they approve the request to follow', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      followApproval: { approvingAuthorIds: [2] },
      initialEntries: [
        publicEntry(1, 2, 'Noor', SECRET, 'Letters to my sister'),
        publicEntry(2, 3, 'Sam', 'Sam writes about running'),
      ],
    });
    await page.goto('/feed');

    const teaser = page.locator('.feed-teaser', { hasText: 'Letters to my sister' });
    await expect(teaser).toContainText('Only the followers Noor approves can read this entry. Ask to follow to read it.');
    await expect(page.getByText(SECRET)).toHaveCount(0);
    await expect(teaser.getByRole('button', { name: /like|comment|save|listen/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Follow Sam' })).toBeVisible();
    // A topic or a search never lists it, as its tags and text are not shown
    await page.locator('.feed-entry', { hasText: 'Sam writes about running' }).getByRole('button', { name: '#family' }).click();
    await expect(page.getByText('Sam writes about running')).toBeVisible();
    await expect(page.locator('.feed-teaser')).toHaveCount(0);
    await page.goto('/feed');

    await teaser.getByRole('button', { name: 'Ask to follow Noor' }).click();
    await expect(teaser.getByRole('button', { name: 'Requested Noor' })).toHaveAttribute('aria-pressed', 'true');
    await expect(teaser).toContainText('You asked to follow Noor. This entry opens once they approve.');
    await expect.poll(() => state.followApproval.requestedUserIds).toEqual([2]);
    expect(state.followedUserIds).toEqual([]);

    await page.getByRole('button', { name: 'Following', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Waiting for approval' })).toContainText('Noor');
    await expect(page.getByText(SECRET)).toHaveCount(0);

    // Noor approves: the entry opens, with its text
    state.followApproval.requestedUserIds = [];
    state.followedUserIds = [2];
    await page.reload();
    await expect(page.getByText(SECRET)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Following Noor' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.feed-teaser')).toHaveCount(0);
  });

  test('withdraws a request still waiting from the teaser', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      followApproval: { approvingAuthorIds: [2], requestedUserIds: [2] },
      initialEntries: [publicEntry(1, 2, 'Noor', SECRET, 'Letters to my sister')],
    });
    await page.goto('/feed');

    await page.getByRole('button', { name: 'Requested Noor' }).click();
    await expect(page.getByRole('button', { name: 'Ask to follow Noor' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => state.followApproval.requestedUserIds).toEqual([]);
  });

  test('approves and declines the requests to follow you in the Following tab, in French', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      followerCount: 1,
      writers: { followers: [writer(5, 'Lee')] },
      followApproval: { required: true, requests: [writer(6, 'Pia'), writer(7, 'Omar')] },
    });
    await page.goto('/feed');

    await page.getByRole('button', { name: 'Abonnements', exact: true }).click();
    const requests = page.getByRole('list', { name: 'Demandent à vous suivre' });
    await expect(requests.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByText('Demandes : 2')).toBeVisible();
    await requests.getByRole('button', { name: 'Approuver Pia' }).click();
    await expect(page.getByRole('list', { name: 'Vos abonnés' })).toContainText('Pia');
    await expect(page.getByText('Abonnés : 2')).toBeVisible();
    await requests.getByRole('button', { name: 'Refuser Omar' }).click();
    await expect(page.getByRole('list', { name: 'Demandent à vous suivre' })).toHaveCount(0);
    expect(state.followApproval.requests).toEqual([]);
    expect(state.writers.followers.map((user) => user.username)).toEqual(['Lee', 'Pia']);
  });

  test('turns the switch on in Profile, and asks before turning it off with requests waiting', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/profile');

    const toggle = page.getByRole('switch', { name: 'Followers by approval' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => state.followApproval.required).toBe(true);

    // Two writers asked meanwhile
    state.followApproval.requests = [writer(6, 'Pia'), writer(7, 'Omar')];
    await page.reload();
    await toggle.click();
    const dialog = page.getByRole('alertdialog', { name: 'Turn off followers by approval?' });
    await expect(dialog).toContainText('The 2 requests still waiting will be approved');
    expect(await axeViolations(page, '[role="alertdialog"]')).toEqual([]);
    await dialog.getByRole('button', { name: 'Turn off and approve' }).click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('status').filter({ hasText: '2 waiting requests were approved' })).toBeAttached();
    expect(state.followApproval.required).toBe(false);
    expect(state.writers.followers.map((user) => user.username)).toEqual(['Pia', 'Omar']);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`keeps the teaser and the requests accessible in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        followApproval: { approvingAuthorIds: [2], requestedUserIds: [3], requests: [writer(6, 'Pia')] },
        initialEntries: [
          publicEntry(1, 2, 'Noor', SECRET, 'Letters to my sister'),
          publicEntry(2, 3, 'Sam', 'Sam writes about running'),
        ],
      });
      await page.goto('/feed');
      await expect(page.getByRole('button', { name: 'Ask to follow Noor' })).toBeVisible();
      expect(await axeViolations(page, '.feed-page')).toEqual([]);

      await page.getByRole('button', { name: 'Following', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Approve Pia' })).toBeVisible();
      expect(await axeViolations(page, '.feed-page')).toEqual([]);
    });
  }
});
