import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const signIn = (id: number) => ({
  id,
  kind: 'sign_in' as const,
  browser: 'Safari',
  system: 'iOS',
  createdAt: '2024-04-01T08:00:00.000Z',
});

test.describe('Account activity', () => {
  test('lists the account’s sign-ins and security changes, a new one after a reload, and turns the email off', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      accountActivity: {
        events: [
          { id: 2, kind: 'sign_in_refused', browser: null, system: null, createdAt: '2024-04-21T08:00:00.000Z' },
          { id: 1, kind: 'sign_in', browser: 'Firefox', system: 'Windows', createdAt: '2024-04-20T08:00:00.000Z' },
        ],
      },
    });
    await page.goto('/profile');

    const activity = page.getByRole('table', { name: 'Account activity' });
    await expect(activity.getByRole('row')).toHaveCount(3);
    await expect(activity.getByRole('row').nth(1)).toContainText('Sign-in refused (wrong password or code)');
    await expect(activity.getByRole('row').nth(1)).toContainText('Unknown browser on unknown system');
    await expect(activity.getByRole('row').nth(2)).toContainText('Firefox on Windows');

    await page.getByRole('textbox', { name: 'Current Password' }).fill('Writer123!');
    await page.getByRole('textbox', { name: 'New Password', exact: true }).fill('Writer456!');
    await page.getByRole('textbox', { name: 'Confirm New Password' }).fill('Writer456!');
    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page.getByText('Password changed successfully')).toBeVisible();

    const toggle = page.getByRole('switch', { name: 'Email me about a sign-in from a new browser' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(state.accountActivity.newBrowserEmail).toBe(false);

    await page.reload();
    await expect(activity.getByRole('row').nth(1)).toContainText('Password changed');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('shows older activity a page at a time, in French', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      accountActivity: { events: Array.from({ length: 55 }, (_, index) => signIn(60 - index)) },
    });
    await page.goto('/profile');

    const activity = page.getByRole('table', { name: 'Activité du compte' });
    await expect(activity.getByRole('row')).toHaveCount(51);
    await expect(activity.getByRole('row').nth(1)).toContainText('Safari sous iOS');
    await page.getByRole('button', { name: 'Afficher l’activité plus ancienne' }).click();
    await expect(activity.getByRole('row')).toHaveCount(56);
    await expect(page.getByRole('button', { name: 'Afficher l’activité plus ancienne' })).toHaveCount(0);
  });
});
