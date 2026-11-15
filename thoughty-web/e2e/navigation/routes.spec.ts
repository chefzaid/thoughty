import { test, expect } from '../support/test';
import { pauseClock } from '../support/clock';
import { setupMockApp } from '../support/mockApp';
import { goToView } from '../support/navigation';

const statsEntries = [
  {
    id: 1,
    date: '2024-01-15',
    index: 1,
    content: 'Deep link entry',
    tags: ['focus', 'review'],
    visibility: 'private' as const,
    diaryId: 1,
  },
];

test.describe('Route navigation', () => {
  test('supports direct journal permalinks for entries', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 7,
          date: '2024-01-20',
          index: 1,
          content: 'Permalink target entry',
          tags: ['focus'],
          visibility: 'private',
          diaryId: 1,
        },
      ],
    });

    await page.goto('/journal?entry=7');

    await expect(page).toHaveURL(/\/journal\?entry=7&diary=all$/);
    await expect(page.getByText('Permalink target entry')).toBeVisible();
    await page.getByLabel('More actions').first().click();
    await expect(page.getByLabel('Open entry permalink')).toHaveAttribute('href', /\/journal\?entry=7$/);
  });

  test('lands a permalink on its entry with one request around it, and no lookup', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: Array.from({ length: 30 }, (_, day) => ({
        id: 100 + day,
        date: `2024-03-${String(30 - day).padStart(2, '0')}`,
        index: 1,
        content: day === 25 ? 'Old permalink entry' : `Entry of day ${30 - day}`,
        tags: [],
        visibility: 'private' as const,
        diaryId: 1,
      })),
    });
    const lookups: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/entries/by-date')) lookups.push(request.url());
    });

    await page.goto('/journal?entry=125');

    await expect(page.locator('#entry-125')).toHaveClass(/highlight-entry/);
    await expect(page.locator('#entry-125')).toBeInViewport();
    // The window holds the entries around it, the newest ones load on demand
    await expect(page.getByText('Entry of day 30', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show newer entries' })).toBeVisible();
    expect(lookups).toEqual([]);
  });

  test('shows a toast for a missing journal permalink', async ({ page }) => {
    await page.clock.install();
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: statsEntries,
    });
    // Hold the list request around the entry so time can be frozen before the toast's countdown starts.
    // The journal sends one, but every one is held and then answered so a repeat could never hang.
    const heldLookups: Array<() => void> = [];
    let lookupsReleased = false;
    let markLookupRequested: () => void = () => undefined;
    const lookupRequested = new Promise<void>((requested) => {
      markLookupRequested = requested;
    });
    await page.route(/\/api\/entries\?.*around=999/, async (route) => {
      if (!lookupsReleased) {
        await new Promise<void>((answer) => {
          heldLookups.push(answer);
          markLookupRequested();
        });
      }
      await route.fallback();
    });

    await page.goto('/journal?entry=999');
    await lookupRequested;
    await pauseClock(page);
    lookupsReleased = true;
    heldLookups.forEach((answer) => answer());

    const toast = page.getByRole('alert');
    await expect(toast).toContainText('Entry not found');
    await expect(toast).toContainText('This entry may have been deleted, or the link is no longer valid.');

    await page.clock.runFor(4000);
    await expect(toast).toHaveCount(0);
  });

  test('supports public auth deep links and browser history', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.locator('#identifier')).toBeVisible();

    await page.getByRole('button', { name: 'Sign Up' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByText('Create your account')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByText('Create your account')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })).toBeVisible();
  });

  test('supports authenticated deep links and browser history across app views', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: statsEntries,
    });

    // The router renders a route change as a transition, so the URL can update while the
    // previous view is still on screen: wait for each page's own title, not any heading
    // that mentions it (Stats also has "Top Tags" headings).
    const statsTitle = page.getByRole('heading', { level: 1, name: 'Stats', exact: true });
    const tagsTitle = page.getByRole('heading', { level: 1, name: 'Tags', exact: true });

    await page.goto('/stats');
    await expect(page).toHaveURL(/\/stats$/);
    await expect(statsTitle).toBeVisible();
    await expect(page.getByText(/Total Entries/i)).toBeVisible();

    await goToView(page, 'Tags');
    await expect(page).toHaveURL(/\/tags$/);
    await expect(tagsTitle).toBeVisible();
    await expect(statsTitle).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/stats$/);
    await expect(statsTitle).toBeVisible();
    await expect(tagsTitle).toHaveCount(0);

    await page.goForward();
    await expect(page).toHaveURL(/\/tags$/);
    await expect(tagsTitle).toBeVisible();
    await expect(statsTitle).toHaveCount(0);
  });

  test('preserves the return route when opening diary management from a scoped view', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: statsEntries,
    });

    await page.goto('/stats?diary=1');
    await page.getByRole('button', { name: 'Manage Diaries' }).click();

    await expect(page).toHaveURL(/\/diaries\?from=stats&diary=1|\/diaries\?diary=1&from=stats/);

    await page.locator('.diary-manager .page-back').click();

    await expect(page).toHaveURL(/\/stats\?diary=1$/);
    await expect(page.getByRole('heading', { name: /Stats/i })).toBeVisible();
  });
});
