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
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: statsEntries,
    });

    await page.goto('/journal?entry=999');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Entry not found')).toBeVisible();
    await expect(page.getByText('This entry may have been deleted, or the link is no longer valid.')).toBeVisible();
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
    await expect(page.getByText('Thoughty gives you structured diaries, fast import and export')).toBeVisible();
  });

  test('supports authenticated deep links and browser history across app views', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: statsEntries,
    });

    await page.goto('/stats');
    await expect(page).toHaveURL(/\/stats$/);
    await expect(page.getByRole('heading', { name: /Stats/i })).toBeVisible();
    await expect(page.getByText(/Total Entries/i)).toBeVisible();

    await page.getByRole('button', { name: 'Tags' }).click();
    await expect(page).toHaveURL(/\/tags$/);
    await expect(page.getByRole('heading', { name: /Tags/i })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/stats$/);
    await expect(page.getByRole('heading', { name: /Stats/i })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/tags$/);
    await expect(page.getByRole('heading', { name: /Tags/i })).toBeVisible();
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
