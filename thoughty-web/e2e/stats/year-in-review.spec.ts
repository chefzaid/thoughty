import { expect, test } from '../support/test';

import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

const entry = (id: number, date: string, content: string, overrides: Partial<MockEntry> = {}): MockEntry => ({
  id,
  date,
  index: 1,
  content,
  tags: [],
  visibility: 'private',
  diaryId: 1,
  ...overrides,
});

const entries: MockEntry[] = [
  entry(501, '2025-01-04', 'A cold walk to the bakery before anyone was awake.', { tags: ['walks'] }),
  entry(502, '2025-03-15', 'Packed for Lisbon and forgot the charger again.', { tags: ['travel'], diaryId: 2 }),
  entry(503, '2025-03-16', 'Tram 28 up the hill, then fish by the river.', { tags: ['travel'], is_favorite: true, diaryId: 2 }),
  entry(504, '2025-12-30', 'Quiet end to the year, a long list of thanks.', { tags: ['walks'] }),
  entry(505, '2024-06-01', 'An older entry from last summer.'),
];

test.describe('Year in review', () => {
  test('opens from the stats page and shows the year in numbers, themes, and moments to reread', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/stats?diary=all');

    await page.getByRole('button', { name: 'Open the year in review' }).click();
    await expect(page).toHaveURL(/\/review/);
    await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2025');

    await expect(page.getByRole('heading', { level: 1, name: 'Your 2025 in review' })).toBeVisible();
    await expect(page.getByText('Your busiest month was March, with 2 entries.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'What filled your pages' }).getByText('travel')).toBeVisible();
    const highlights = page.getByRole('region', { name: 'Moments to reread' });
    await expect(highlights.getByRole('article', { name: 'A favorite' })).toContainText('Tram 28 up the hill');

    await highlights.getByRole('article', { name: 'A favorite' }).getByRole('button', { name: 'Read in journal' }).click();
    await expect(page).toHaveURL(/\/journal\?entry=503/);
  });

  test('narrows the review to one diary and back', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/review?year=2025');

    await page.getByLabel('Diaries').selectOption({ label: 'Personal' });

    await expect(page).toHaveURL(/diary=2/);
    await expect(page.getByText('Your busiest month was March, with 2 entries.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'What filled your pages' }).getByText('walks')).toHaveCount(0);
    await page.getByLabel('Diaries').selectOption({ label: 'All Diaries' });
    await expect(page.getByRole('region', { name: 'What filled your pages' }).getByText('walks')).toBeVisible();
  });

  test('reads the mood of the year on request and keeps it', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/review?year=2025');
    const mood = page.getByRole('region', { name: 'The mood of your year' });

    await expect(mood.getByText(/Only when you ask/)).toBeVisible();
    await mood.getByRole('button', { name: 'Read the mood of my year' }).click();

    await expect(mood.getByText('A hopeful year with a restless middle.')).toBeVisible();
    await expect(mood.getByRole('img', { name: /January: hopeful/ })).toBeVisible();
    expect(state.review.moodRequests).toEqual([{ year: 2025 }]);
    await page.reload();
    await expect(page.getByRole('region', { name: 'The mood of your year' }).getByRole('button', { name: 'Read it again' })).toBeVisible();
  });

  test('shares an edited summary to the public feed', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/review?year=2025');
    const share = page.getByRole('region', { name: 'Share or keep' });

    await share.getByRole('button', { name: 'Share a summary' }).click();
    const text = share.getByLabel('Post text');
    await expect(text).toHaveValue('My 2025 in Thoughty: 4 entries and 38 words over 4 days, with a longest streak of 1 day.');
    await share.getByLabel('Include my top themes').check();
    await expect(text).toHaveValue(/Most on my mind: walks, travel\./);
    await share.getByRole('button', { name: 'Post to the public feed' }).click();

    await expect(share.getByText('Posted to the public feed.')).toBeVisible();
    const posted = state.entries.find((candidate) => candidate.content.startsWith('My 2025 in Thoughty'));
    expect(posted).toEqual(expect.objectContaining({ visibility: 'public', tags: [] }));
  });

  test('shows the review in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, initialEntries: entries });
    await page.goto('/review?year=2025');

    await expect(page.getByRole('heading', { level: 1, name: 'Votre année 2025' })).toBeVisible();
    await expect(page.getByText('Votre mois le plus riche : mars, avec 2 entrées.')).toBeVisible();
  });

  test('fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/review?year=2025');
    await expect(page.getByRole('region', { name: 'Moments to reread' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
