import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../support/test';

import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

const entry = (id: number, date: string, tags: string[], mood?: number, overrides: Partial<MockEntry> = {}): MockEntry => ({
  id,
  date,
  index: 1,
  content: `Entry ${id}`,
  tags,
  visibility: 'private',
  diaryId: 1,
  ...(mood ? { mood } : {}),
  ...overrides,
});

const entries: MockEntry[] = [
  entry(801, '2025-03-01', ['garden', 'friends'], 5),
  entry(802, '2025-03-02', ['garden', 'friends'], 4),
  entry(803, '2025-03-03', ['garden', 'solo'], 4),
  entry(804, '2025-03-04', ['work', 'garden'], 2),
  entry(805, '2025-03-05', ['work', 'garden'], 1),
  // An okay mood and no mood count in neither list
  entry(806, '2025-03-06', ['solo'], 3),
  entry(807, '2025-03-07', ['solo']),
  entry(808, '2025-04-01', ['travel'], 5, { diaryId: 2 }),
  entry(809, '2025-04-02', ['travel'], 4, { diaryId: 2 }),
];

test.describe('Tags and moods', () => {
  test('lists the tags on good and low moods, scoped to the diary, and opens the journal on a tag', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    await page.goto('/stats?diary=all');

    const card = page.getByRole('region', { name: 'Tags and moods' });
    const good = card.getByRole('list', { name: 'Good or very good' });
    const low = card.getByRole('list', { name: 'Low or very low' });
    await expect(good.getByRole('listitem')).toHaveText(['garden3 entries', 'friends2 entries', 'travel2 entries']);
    // A tag used on both kinds of entry is in both lists; one on a single good entry (solo) is left out
    await expect(low.getByRole('listitem')).toHaveText(['garden2 entries', 'work2 entries']);
    const results = await new AxeBuilder({ page })
      .include('[aria-labelledby="stats-mood-tags-heading"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(({ id }) => id)).toEqual([]);

    await page.goto('/stats?diary=2');
    await expect(good.getByRole('listitem')).toHaveText(['travel2 entries']);
    await expect(card.getByText('No tag on two of these entries yet.')).toBeVisible();

    await page.goto('/stats?diary=1');
    await low.getByRole('button', { name: 'Show entries tagged work' }).click();
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.getByText('Entry 804')).toBeVisible();
    await expect(page.getByText('Entry 805')).toBeVisible();
    await expect(page.getByText('Entry 801')).toHaveCount(0);
  });

  test('keeps the tags without their counts in quiet mode, and in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, config: { quietMode: true, language: 'fr' } });
    await page.goto('/stats?diary=all');

    const card = page.getByRole('region', { name: 'Tags et humeurs' });
    await expect(card.getByRole('list', { name: 'Bonne ou très bonne' }).getByRole('listitem')).toHaveText(['garden', 'friends', 'travel']);
    await expect(card.getByRole('list', { name: 'Basse ou très basse' }).getByRole('listitem')).toHaveText(['garden', 'work']);
    await expect(card).not.toContainText(/\d/);
  });

  test('says gently that nothing shows yet', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries.slice(5) });
    await page.goto('/stats?diary=1');

    await expect(page.getByRole('region', { name: 'Tags and moods' })).toContainText('When a tag comes back on a few entries with a good or a low mood');
  });

  test('stays hidden without moods', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [entry(810, '2025-05-01', ['solo'])] });
    await page.goto('/stats?diary=1');
    await expect(page.getByRole('region', { name: 'Recorded moods' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tags and moods' })).toHaveCount(0);
  });
});
