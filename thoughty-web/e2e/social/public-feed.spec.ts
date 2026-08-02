import { expect, test } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

const communityEntries = Array.from({ length: 11 }, (_, index) => ({
  id: index + 10,
  userId: 2,
  authorUsername: 'CommunityWriter',
  date: `2026-07-${String(20 - index).padStart(2, '0')}`,
  index: 1,
  content: `Community public entry ${index + 1}`,
  tags: ['community'],
  visibility: 'public' as const,
  createdAt: `2026-07-${String(20 - index).padStart(2, '0')}T12:00:00.000Z`,
}));

test.describe('public feed', () => {
  test('shows eligible community entries with pagination and previews own public entries', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        ...communityEntries,
        {
          id: 30,
          userId: 1,
          authorUsername: 'TestUser',
          date: '2026-07-21',
          index: 1,
          content: 'My visible public entry',
          tags: ['mine'],
          visibility: 'public',
        },
        {
          id: 31,
          userId: 2,
          authorUsername: 'HiddenWriter',
          date: '2026-07-22',
          index: 1,
          content: 'Moderated content must stay hidden',
          tags: [],
          visibility: 'public',
          moderationStatus: 'hidden',
        },
        {
          id: 32,
          userId: 2,
          authorUsername: 'PrivateWriter',
          date: '2026-07-23',
          index: 1,
          content: 'Private content must stay hidden',
          tags: [],
          visibility: 'private',
        },
      ],
    });

    await page.goto('/feed');

    await expect(page.getByRole('heading', { name: 'Feed' })).toBeVisible();
    await expect(page.getByText('Community public entry 1', { exact: true })).toBeVisible();
    await expect(page.getByText('My visible public entry')).toHaveCount(0);
    await expect(page.getByText('Moderated content must stay hidden')).toHaveCount(0);
    await expect(page.getByText('Private content must stay hidden')).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText('Community public entry 11', { exact: true })).toBeVisible();
    await expect(page.getByText('Showing 11 of 11')).toBeVisible();

    await page.getByRole('button', { name: 'My public entries' }).click();
    await expect(page.getByText('My visible public entry')).toBeVisible();
    await expect(page.getByText('Community public entry 1', { exact: true })).toHaveCount(0);
  });

  test('fits the feed controls and entries on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await setupMockApp(page, { startAuthenticated: true, initialEntries: communityEntries.slice(0, 1) });
    await page.goto('/feed');

    await expect(page.getByText('Community public entry 1', { exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
});
