import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';

import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';

const entry = (id: number, date: string, overrides: Partial<MockEntry> = {}): MockEntry => ({
  id,
  date,
  index: 1,
  content: `Entry ${id}`,
  tags: [],
  visibility: 'private',
  diaryId: 1,
  ...overrides,
});

const entries: MockEntry[] = [
  entry(901, '2026-10-20', { content: 'Where it began', time_of_day: '08:00' }),
  // No time: 03:00 UTC is 5 PM in Kiritimati, 4 PM the day before in Pago Pago
  entry(902, '2026-10-26', { content: 'A long record of a day that had a lot to say', createdAt: '2026-10-26T03:00:00.000Z' }),
  entry(903, '2026-10-27', { content: 'Typed evening', time_of_day: '21:15' }),
  entry(904, '2026-10-27', { index: 2, content: 'Typed morning', time_of_day: '06:45' }),
  // No time: 10:30 UTC is 12:30 AM in Kiritimati, 11:30 PM the day before in Pago Pago
  entry(905, '2026-10-28', { content: 'Late or early', createdAt: '2026-10-31T10:30:00.000Z' }),
  entry(906, '2026-10-29', { content: 'Personal dawn', time_of_day: '05:00', diaryId: 2 }),
];
// In the recycle bin: earlier, longer and earlier in the day than any other, so it holds no record
const trashed = { ...entry(907, '2026-01-01', { content: 'word '.repeat(40), time_of_day: '00:01' }), deletedAt: '2026-10-30T10:00:00.000Z' };

const card = (page: Page, name = 'Personal records') => page.getByRole('region', { name });

async function openStats(page: Page, path: string) {
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/stats' && url.searchParams.has('timeZone');
    }),
    page.goto(path),
  ]);
}

test.describe('Personal records', () => {
  test.describe('in Kiritimati, a day ahead of UTC', () => {
    test.use({ timezoneId: 'Pacific/Kiritimati' });

    test('shows each record and opens the entry or the day that set it', async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, initialTrash: [trashed] });

      await openStats(page, '/stats?diary=all');
      const records = card(page);
      await expect(records.getByText('12 words')).toBeVisible();
      await expect(records.getByText('2 entries')).toBeVisible();
      await expect(records.getByText('4 days in a row')).toBeVisible();
      await expect(records.getByText('12:30 AM')).toBeVisible();
      await expect(records.getByText('9:15 PM')).toBeVisible();
      await expect(records.getByText('October 20, 2026', { exact: true })).toBeVisible();
      await expect(records.getByRole('button', { name: 'Earliest hour October 28, 2026 · #1' })).toBeVisible();
      await expect(records.getByRole('button', { name: 'Latest hour October 27, 2026 · #1' })).toBeVisible();

      const axe = await new AxeBuilder({ page }).include('.records-card').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(axe.violations.map(({ id }) => id)).toEqual([]);

      await records.getByRole('button', { name: 'Longest entry October 26, 2026 · #1' }).click();
      await expect(page).toHaveURL(/\/journal\?(?:.*&)?entry=902/);
      await expect(page.getByText('A long record of a day that had a lot to say')).toBeVisible();

      // The streak opens on its first day
      await openStats(page, '/stats?diary=all');
      await card(page).getByRole('button', { name: /^Longest streak October 26/ }).click();
      await expect(page).toHaveURL(/\/journal/);
      await expect(page.getByText('A long record of a day that had a lot to say')).toBeVisible();
      await expect(page.getByText('Typed evening')).toHaveCount(0);

      await openStats(page, '/stats?diary=all');
      await card(page).getByRole('button', { name: 'Busiest day October 27, 2026' }).click();
      await expect(page.getByText('Typed evening')).toBeVisible();
      await expect(page.getByText('Typed morning')).toBeVisible();
      await expect(page.getByText('Where it began')).toHaveCount(0);

      await openStats(page, '/stats?diary=all');
      await card(page).getByRole('button', { name: 'Where it all began Read it again' }).click();
      await expect(page).toHaveURL(/entry=901/);
      await expect(page.getByText('Where it began')).toBeVisible();
    });
  });

  test.describe('in Pago Pago, a day behind UTC', () => {
    test.use({ timezoneId: 'Pacific/Pago_Pago' });

    test('reads the same creation time as the latest hour, and keeps to the diary', async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, initialTrash: [trashed] });

      await openStats(page, '/stats?diary=all');
      await expect(card(page).getByRole('button', { name: 'Earliest hour October 29, 2026 · #1' })).toBeVisible();
      await expect(card(page).getByText('5:00 AM')).toBeVisible();
      await expect(card(page).getByRole('button', { name: 'Latest hour October 28, 2026 · #1' })).toBeVisible();
      await expect(card(page).getByText('11:30 PM')).toBeVisible();

      await openStats(page, '/stats?diary=1');
      await expect(card(page).getByRole('button', { name: 'Earliest hour October 27, 2026 · #2' })).toBeVisible();
      await expect(card(page).getByText('6:45 AM')).toBeVisible();
      await expect(card(page).getByText('3 days in a row')).toBeVisible();
    });
  });

  test('keeps only the hours and the first entry in quiet mode', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, config: { quietMode: true } });

    await openStats(page, '/stats?diary=all');
    const records = card(page);
    await expect(records.getByRole('heading', { level: 3 })).toHaveText(['Earliest hour', 'Latest hour', 'Where it all began']);
    await expect(records.getByText(/words|entries|in a row/)).toHaveCount(0);
    await records.getByRole('button', { name: /^Earliest hour/ }).click();
    await expect(page).toHaveURL(/entry=\d+/);
  });

  test('speaks French and invites a new writer to write first', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [], config: { language: 'fr' } });

    await openStats(page, '/stats?diary=all');
    await expect(card(page, 'Records personnels').getByText(/Votre première entrée ouvre les records/)).toBeVisible();
    await expect(card(page, 'Records personnels').getByRole('button')).toHaveCount(0);
  });
});
