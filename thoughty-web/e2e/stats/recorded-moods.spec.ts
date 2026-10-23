import { expect, test } from '@playwright/test';

import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

const entry = (id: number, date: string, overrides: Partial<MockEntry> = {}): MockEntry => ({
  id,
  date,
  index: 1,
  content: `Entry ${id}`,
  tags: ['days'],
  visibility: 'private',
  diaryId: 1,
  ...overrides,
});

const entries: MockEntry[] = [
  // 2025-03-03 is a Monday, 2025-03-08 a Saturday
  entry(701, '2025-03-03', { mood: 2, feelings: ['tired', 'calm'] }),
  entry(702, '2025-03-08', { mood: 4, feelings: ['calm'] }),
  entry(703, '2025-04-12', { mood: 5, feelings: ['joyful'], diaryId: 2 }),
  entry(704, '2025-05-01'),
];

test.describe('Recorded moods', () => {
  test('sums up recorded moods in stats, scoped to the diary', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/stats?diary=all');

    const panel = page.getByRole('region', { name: 'Recorded moods' });
    await expect(panel.getByText('No AI is involved', { exact: false })).toBeVisible();
    await expect(panel.locator('.tone-mood-highlight', { hasText: 'Average mood' })).toContainText('3.7 out of 5 · Good');
    await expect(panel.locator('.tone-mood-highlight', { hasText: 'Entries with a mood' })).toContainText('3');
    await expect(panel.getByRole('img', { name: /March 2025: average 3\.0 out of 5 \(Okay\) from 2 entries; April 2025: average 5\.0/ })).toBeVisible();
    await expect(panel.getByText('Monday: average 2.0 out of 5 from 1 entries')).toBeAttached();
    await expect(panel.getByText('calm: 2 entries')).toBeAttached();

    await page.goto('/stats?diary=2');
    await expect(page.getByRole('region', { name: 'Recorded moods' }).locator('.tone-mood-highlight', { hasText: 'Entries with a mood' })).toContainText('1');
    await expect(page.getByRole('region', { name: 'Recorded moods' }).getByText('joyful: 1 entries')).toBeAttached();
  });

  test('draws the year in review mood arc from recorded moods, without AI', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/review?year=2025');

    const mood = page.getByRole('region', { name: 'The mood of your year' });
    await expect(mood.getByText('From the moods you recorded, without AI')).toBeVisible();
    await expect(mood.getByText('Your average mood was 3.7 out of 5 (Good), across 3 entries with a mood.')).toBeVisible();
    await expect(mood.getByRole('img', { name: /March: Okay, April: Very good/ })).toBeVisible();
    await expect(mood.getByText('Feelings you named most: calm, joyful, tired')).toBeVisible();
    await expect(mood.getByRole('button')).toHaveCount(0);
    expect(state.review.moodRequests).toEqual([]);
  });

  test('keeps the AI reading, labelled as such, for a year without recorded moods', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries.map(({ mood: _mood, feelings: _feelings, ...rest }) => rest) });
    await page.goto('/review?year=2025');

    const mood = page.getByRole('region', { name: 'The mood of your year' });
    await expect(mood.getByRole('button', { name: 'Read the mood of my year' })).toBeVisible();
    await expect(mood.getByText(/Choose a mood when you write/)).toBeVisible();
    await mood.getByRole('button', { name: 'Read the mood of my year' }).click();
    await expect(mood.getByText('AI reading of a sample of your entries')).toBeVisible();
  });
});
