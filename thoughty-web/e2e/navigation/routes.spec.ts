import { test, expect } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

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

  test('shows a toast for a missing journal permalink', async ({ page }) => {
    await page.clock.install();
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: statsEntries,
    });
    // Hold the lookups so time can be frozen before the toast's countdown starts. The journal
    // can look the entry up more than once (it repeats the lookup when the profile's page size
    // arrives and drops the earlier answer), so every lookup is held, then all are answered.
    const heldLookups: Array<() => void> = [];
    let lookupsReleased = false;
    let markLookupRequested: () => void = () => undefined;
    const lookupRequested = new Promise<void>((requested) => {
      markLookupRequested = requested;
    });
    await page.route('**/api/entries/by-date?id=999*', async (route) => {
      if (!lookupsReleased) {
        await new Promise<void>((answer) => {
          heldLookups.push(answer);
          markLookupRequested();
        });
      }
      await route.fulfill({ json: { found: false } });
    });

    await page.goto('/journal?entry=999');
    await lookupRequested;
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
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

    await page.getByRole('button', { name: 'Tags' }).click();
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

    await page.locator('.diary-manager-header .back-btn').click();

    await expect(page).toHaveURL(/\/stats\?diary=1$/);
    await expect(page.getByRole('heading', { name: /Stats/i })).toBeVisible();
  });
});
