import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

// 10:30 UTC on 31 October 2026: already 00:30 on 1 November in Kiritimati (UTC+14), still 23:30 on 30 October in Pago Pago (UTC-11)
const NOW = new Date('2026-10-31T10:30:00Z');

const entry = (id: number, date: string, content: string): MockEntry => ({
  id, date, index: 1, content, tags: [], visibility: 'private', diaryId: 1,
});

const ENTRIES = [
  entry(1, '2025-11-01', 'Lanterns along the lagoon'),
  entry(2, '2025-10-31', 'Market morning in the rain'),
  entry(3, '2025-10-30', 'Storm over the harbor'),
];

/** The `today` the next request to `pathname` sends once `action` runs. */
async function todaySentBy(page: Page, pathname: string, action: () => Promise<unknown>): Promise<string | null> {
  const [request] = await Promise.all([
    page.waitForRequest((candidate) => new URL(candidate.url()).pathname === pathname),
    action(),
  ]);
  return new URL(request.url()).searchParams.get('today');
}

async function openHighlights(page: Page) {
  await page.clock.setFixedTime(NOW);
  await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });
  await page.goto('/journal?diary=all');
  const today = await todaySentBy(page, '/api/entries/highlights', () => page.getByRole('button', { name: 'Highlights' }).click());
  return { today, onThisDay: page.getByRole('dialog', { name: 'Highlights' }).locator('.on-this-day') };
}

test.describe('The writer’s day far from UTC', () => {
  test.describe('in Kiritimati, a day ahead of UTC', () => {
    test.use({ timezoneId: 'Pacific/Kiritimati' });

    test('shows On This Day for 1 November while it is still 31 October in UTC', async ({ page }) => {
      const { today, onThisDay } = await openHighlights(page);

      expect(today).toBe('2026-11-01');
      await expect(onThisDay).toContainText('Lanterns along the lagoon');
      await expect(onThisDay).not.toContainText('Market morning in the rain');
    });

    test('measures the stats and names the export and the book after 1 November', async ({ page }) => {
      await page.clock.setFixedTime(NOW);
      await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES });

      expect(await todaySentBy(page, '/api/stats', () => page.goto('/stats?diary=all'))).toBe('2026-11-01');

      await page.goto('/import-export?diary=all&section=export');
      const exportDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download', exact: true }).click();
      expect((await exportDownload).suggestedFilename()).toBe('thoughty_export_2026-11-01.txt');

      await page.goto('/import-export?diary=1&section=book');
      const bookSection = page.locator('#book-section');
      await bookSection.getByLabel('Title').fill('Island Days');
      await bookSection.getByLabel('Weave thoughts into flowing prose with AI').uncheck();
      await bookSection.getByLabel('Format').selectOption('md');
      const bookDownload = page.waitForEvent('download');
      await bookSection.getByRole('button', { name: 'Download Book' }).click();
      expect((await bookDownload).suggestedFilename()).toBe('thoughty_book_Island_Days_2026-11-01.md');
    });
  });

  test.describe('in Pago Pago, a day behind UTC', () => {
    test.use({ timezoneId: 'Pacific/Pago_Pago' });

    test('shows On This Day for 30 October while it is already 31 October in UTC', async ({ page }) => {
      const { today, onThisDay } = await openHighlights(page);

      expect(today).toBe('2026-10-30');
      await expect(onThisDay).toContainText('Storm over the harbor');
      await expect(onThisDay).not.toContainText('Market morning in the rain');
    });
  });
});
