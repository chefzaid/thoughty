import { expect, test } from '../support/test';
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

test.describe('Two-factor errors from the API', () => {
  for (const { language, enable, codeLabel, confirm, shown, hidden } of [
    {
      language: 'fr' as const,
      enable: "Activer l'authentification à deux facteurs",
      codeLabel: 'Code de vérification',
      confirm: 'Confirmer et activer',
      shown: 'Code de vérification invalide ou expiré.',
      hidden: 'Invalid or expired verification code.',
    },
    {
      language: 'en' as const,
      enable: 'Enable two-factor authentication',
      codeLabel: 'Verification code',
      confirm: 'Confirm and enable',
      shown: 'Invalid or expired verification code.',
      hidden: 'Code de vérification invalide ou expiré.',
    },
  ]) {
    test(`shows a wrong setup code in the profile language (${language})`, async ({ page }) => {
      const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language } });
      state.user.emailVerified = true;

      await page.goto('/profile');
      await page.getByRole('button', { name: enable }).click();
      await page.getByLabel(codeLabel).fill('000000');
      await page.getByRole('button', { name: confirm }).click();

      await expect(page.getByText(shown)).toBeVisible();
      await expect(page.getByText(hidden)).toHaveCount(0);
      expect(state.user.twoFactorEnabled).toBeFalsy();
    });
  }
});
