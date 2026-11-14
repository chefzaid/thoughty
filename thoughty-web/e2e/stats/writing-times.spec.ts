import AxeBuilder from '../support/axe';
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
  // Times typed by the writer, on Tuesday 27 October: 9 PM wherever they are
  entry(801, '2026-10-27', { time_of_day: '21:15', createdAt: '2026-10-31T10:30:00.000Z' }),
  entry(802, '2026-10-27', { index: 2, time_of_day: '21:40', createdAt: '2026-10-31T10:30:00.000Z' }),
  // No time: 10:30 UTC on Saturday 31 October is 12 AM on Sunday in Kiritimati, 11 PM on Friday in Pago Pago
  entry(803, '2026-10-31', { createdAt: '2026-10-31T10:30:00.000Z' }),
  // No time, in the Work diary: 03:00 UTC on Monday 26 October is 5 PM that Monday in Kiritimati, 4 PM on Sunday in Pago Pago
  entry(804, '2026-10-26', { createdAt: '2026-10-26T03:00:00.000Z', diaryId: 2 }),
];

/** Opens the stats page and returns the time zone its stats request sent (the profile's own totals send none). */
async function openStats(page: Page, path: string): Promise<string | null> {
  const [request] = await Promise.all([
    page.waitForRequest((candidate) => {
      const url = new URL(candidate.url());
      return url.pathname === '/api/stats' && url.searchParams.has('timeZone');
    }),
    page.goto(path),
  ]);
  return new URL(request.url()).searchParams.get('timeZone');
}

const card = (page: Page, name = 'When you write') => page.getByRole('region', { name });

test.describe('When you write', () => {
  test.describe('in Kiritimati, a day ahead of UTC', () => {
    test.use({ timezoneId: 'Pacific/Kiritimati' });

    test('reads creation times in the writer’s zone and keeps typed times, scoped to the diary', async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });

      expect(await openStats(page, '/stats?diary=all')).toBe('Pacific/Kiritimati');
      const times = card(page);
      await expect(times.getByText('in your time zone (Pacific/Kiritimati)', { exact: false })).toBeVisible();
      await expect(times.getByText('You write most often around 9 PM, and on Tuesday.')).toBeVisible();
      await expect(times.getByRole('img', { name: 'Entries by hour of the day: 12 AM: 1 entry; 5 PM: 1 entry; 9 PM: 2 entries' })).toBeVisible();
      await expect(times.getByText('Sunday: 1 entry')).toBeAttached();
      await expect(times.getByText('Monday: 1 entry')).toBeAttached();

      await times.getByRole('button', { name: 'Show as table' }).click();
      const byWeekday = times.getByRole('table', { name: 'By day of the week' });
      await expect(byWeekday.getByRole('row', { name: 'Tuesday 2' })).toBeVisible();
      await expect(times.getByRole('table', { name: 'By hour of the day' }).getByRole('row', { name: '5 PM 1' })).toBeVisible();

      const axe = await new AxeBuilder({ page }).include('.writing-times-card').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(axe.violations.map(({ id }) => id)).toEqual([]);

      await openStats(page, '/stats?diary=2');
      await expect(card(page).getByText('You write most often around 5 PM, and on Monday.')).toBeVisible();
      await expect(card(page).getByRole('img', { name: 'Entries by hour of the day: 5 PM: 1 entry' })).toBeVisible();
    });
  });

  test.describe('in Pago Pago, a day behind UTC', () => {
    test.use({ timezoneId: 'Pacific/Pago_Pago' });

    test('counts the same creation times on the day before', async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });

      expect(await openStats(page, '/stats?diary=all')).toBe('Pacific/Pago_Pago');
      const times = card(page);
      await expect(times.getByRole('img', { name: 'Entries by hour of the day: 4 PM: 1 entry; 9 PM: 2 entries; 11 PM: 1 entry' })).toBeVisible();
      await expect(times.getByText('Friday: 1 entry')).toBeAttached();
      await expect(times.getByText('Sunday: 1 entry')).toBeAttached();
      await expect(times.getByText('Saturday: 0 entries')).toBeAttached();
    });
  });

  test('keeps its shape in quiet mode, in words without counts', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries, config: { quietMode: true } });

    await page.goto('/stats?diary=all');
    const times = card(page);
    await expect(times.getByText(/You write most often around 9 PM/)).toBeVisible();
    await expect(times.getByRole('img', { name: /9 PM: most often/ })).toBeVisible();
    await expect(times.getByText('Tuesday: most often')).toBeAttached();
    await expect(times.getByText(/\d+ entr/)).toHaveCount(0);
    await expect(times.locator('.writing-times-hour-fill')).toHaveCount(24);

    await times.getByRole('button', { name: 'Show as table' }).click();
    const byHour = times.getByRole('table', { name: 'By hour of the day' });
    await expect(byHour.getByRole('columnheader', { name: 'How often' })).toBeVisible();
    await expect(byHour.getByRole('row', { name: '9 PM most often' })).toBeVisible();
  });

  test('speaks French and invites a new writer to write first', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [], config: { language: 'fr' } });

    await page.goto('/stats?diary=all');
    await expect(card(page, 'Quand vous écrivez').getByText('Après quelques entrées, vous verrez ici les heures et les jours où vous écrivez le plus.')).toBeVisible();
    await expect(card(page, 'Quand vous écrivez').getByRole('button')).toHaveCount(0);
  });
});
