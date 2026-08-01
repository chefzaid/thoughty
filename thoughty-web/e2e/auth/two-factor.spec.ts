import { expect, test } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Email two-factor authentication', () => {
  test('enables two-factor authentication from profile security settings', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    state.user.emailVerified = true;

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Enable two-factor authentication' }).click();
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button', { name: 'Confirm and enable' }).click();

    await expect(page.getByText('Two-factor authentication is enabled.')).toBeVisible();
    await expect.poll(() => state.user.twoFactorEnabled).toBe(true);
    expect(state.lastTwoFactorCode).toBe('123456');
  });

  test('requires the emailed code before completing password login', async ({ page }) => {
    const { state } = await setupMockApp(page);
    state.user.emailVerified = true;
    state.user.twoFactorEnabled = true;

    await page.goto('/login');
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Enter the code sent to your email')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button', { name: 'Verify and sign in' }).click();

    await expect(page).toHaveURL(/\/journal$/);
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    expect(state.lastTwoFactorCode).toBe('123456');
  });
});
