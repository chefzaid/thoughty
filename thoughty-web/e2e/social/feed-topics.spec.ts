import type { Page } from '@playwright/test';

import AxeBuilder from '../support/axe';
import { expect, test } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const publicEntry = (id: number, userId: number, authorUsername: string, content: string, tags: string[]): MockEntry => ({
  id,
  userId,
  authorUsername,
  date: `2026-07-${String(10 + id).padStart(2, '0')}`,
  index: 1,
  content,
  format: 'plain',
  tags,
  visibility: 'public',
});

const ENTRIES = [
  publicEntry(1, 2, 'Maya', 'Thankful for the river walk', ['Gratitude', 'walks']),
  publicEntry(2, 3, 'Sam', 'A quiet morning of thanks', ['gratitude']),
  publicEntry(3, 3, 'Sam', 'Rain over the harbour', ['weather']),
  publicEntry(4, 1, 'TestUser', 'My own grateful note', ['gratitude']),
];

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('.feed-page')
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('feed topics and search', () => {
  test('opens a tag’s topic, follows it into the Following tab and unfollows it there', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/feed');
    const cards = page.locator('.feed-entry');
    await expect(cards).toHaveCount(3);

    await cards.filter({ hasText: 'Thankful for the river walk' }).getByRole('button', { name: '#Gratitude' }).click();
    await expect(page).toHaveURL(/\/feed\?tag=Gratitude$/);
    await expect(page.getByRole('heading', { name: '#Gratitude' })).toBeVisible();
    // The topic is the tag ignoring case, and the community tab leaves the reader's own entries out
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: 'Rain over the harbour' })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Follow the topic #Gratitude' }).click();
    const follow = page.getByRole('button', { name: 'Following the topic #Gratitude' });
    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => state.followedTopics).toEqual(['gratitude']);

    await page.getByRole('button', { name: 'Show every topic' }).click();
    await expect(page).toHaveURL(/\/feed$/);
    await expect(cards).toHaveCount(3);

    // Neither Maya nor Sam is followed: the topic alone brings their entries carrying it
    await page.getByRole('button', { name: 'Following', exact: true }).click();
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: 'My own grateful note' })).toHaveCount(0);
    const topics = page.getByRole('list', { name: 'Topics you follow' });
    await expect(topics.getByText('#gratitude')).toBeVisible();
    await expectNoAxeViolations(page);

    await topics.getByRole('button', { name: 'Unfollow the topic gratitude' }).click();
    await expect(topics).toHaveCount(0);
    await expect.poll(() => state.followedTopics).toEqual([]);
    await page.getByRole('button', { name: 'Community' }).click();
    await page.getByRole('button', { name: 'Following', exact: true }).click();
    await expect(page.getByText('No public entries from people or topics you follow yet.', { exact: false })).toBeVisible();
  });

  test('searches the public entries by their words, kept in the address, and Back returns to the feed', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
    await page.goto('/feed');
    const cards = page.locator('.feed-entry');
    await expect(cards).toHaveCount(3);

    const box = page.getByRole('searchbox', { name: 'Search public entries' });
    await box.fill('harbour');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/feed\?search=harbour$/);
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Rain over the harbour');

    await box.fill('nothing like this');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('No public entries in this view match this topic or search.')).toBeVisible();

    await page.getByRole('button', { name: 'Clear the search' }).click();
    await expect(page).toHaveURL(/\/feed$/);
    await expect(box).toHaveValue('');
    await expect(cards).toHaveCount(3);

    await page.goBack();
    await expect(page).toHaveURL(/search=nothing\+like\+this/);
    await expect(box).toHaveValue('nothing like this');
  });

  test('opens a topic from its address in French, and fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, config: { language: 'fr' } });
    await page.goto('/feed?tag=gratitude&search=thanks');

    await expect(page.getByText('Sujet', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '#gratitude' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suivre le sujet #gratitude' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Rechercher dans les entrées publiques' })).toHaveValue('thanks');
    await expect(page.locator('.feed-entry')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
