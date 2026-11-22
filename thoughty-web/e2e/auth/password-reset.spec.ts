import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_RESET_TOKEN, passwordResetState } from '../support/mockApp.password-reset';

const NEW_PASSWORD = 'NewWriter1!';

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Password reset', () => {
  test('asks for a link, sets a new password from it with the keyboard, then signs in with it', async ({ page }) => {
    const { state } = await setupMockApp(page);
    const reset = passwordResetState(state);
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('testuser@example.com');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    await expect(page.getByRole('status')).toHaveText('If an account exists with this email, a reset link will be sent.');
    expect(reset.forgotEmails).toEqual(['testuser@example.com']);

    // The emailed link: its token leaves the address and the history entry at once. (The requests the
    // page makes while it loads are sent without a referrer by the production NGINX, which the Vite
    // server here does not mirror: securityHeaders.test.js checks that header.)
    await page.goto(`/reset-password?token=${MOCK_RESET_TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByText('Every device signed in to your account will be signed out.')).toBeVisible();
    await expectNoAccessibilityViolations(page);

    const newPassword = page.getByRole('textbox', { name: 'New Password' });
    await expect(newPassword).toHaveAccessibleDescription(/^At least 8 characters, with an uppercase letter/);
    await newPassword.focus();
    await page.keyboard.type('password123');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.type('password123');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('This password is too weak.');
    expect(reset.lastResetPayload).toBeNull();

    await newPassword.fill(NEW_PASSWORD);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(NEW_PASSWORD);
    const resetRequest = page.waitForRequest('**/api/auth/reset-password');
    await page.keyboard.press('Enter');
    expect((await resetRequest).headers()['referer'] ?? '').not.toContain(MOCK_RESET_TOKEN);
    await expect(page.getByRole('status')).toHaveText(
      'Your password has been changed and every device was signed out. Sign in with your new password.',
    );
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeFocused();
    expect(reset.lastResetPayload).toEqual({ token: MOCK_RESET_TOKEN, newPassword: NEW_PASSWORD });
    await expectNoAccessibilityViolations(page);

    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.goForward();
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
    await page.locator('#password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(page).toHaveURL(/\/journal/);
  });

  test('explains a used or expired link and sends a new one', async ({ page }) => {
    const { state } = await setupMockApp(page);
    await page.goto('/reset-password?token=expired-token');
    await page.getByRole('textbox', { name: 'New Password' }).fill(NEW_PASSWORD);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Save the new password' }).click();

    await expect(page.getByRole('alert')).toHaveText('This password reset link is invalid, has expired, or was already used.');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'New Password' })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);

    await page.getByRole('textbox', { name: 'Email' }).fill('testuser@example.com');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    await expect(page.getByRole('status')).toHaveText('If an account exists with this email, a reset link will be sent.');
    expect(passwordResetState(state).forgotEmails).toEqual(['testuser@example.com']);
    await page.getByRole('button', { name: 'Back to Login' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('speaks French in the light theme, fits a phone, and signs a signed-in browser out of it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    // The language and theme come from the profile settings, which only a signed-in visitor has
    // (TODO.md › Needs Input: which language signed-out pages use)
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'light' } });
    await page.goto(`/reset-password?token=${MOCK_RESET_TOKEN}`);

    await expect(page.getByRole('heading', { name: 'Choisissez un nouveau mot de passe' })).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expectNoAccessibilityViolations(page);

    await page.getByRole('textbox', { name: 'Nouveau mot de passe' }).fill(NEW_PASSWORD);
    await page.getByRole('textbox', { name: 'Confirmer le mot de passe' }).fill('Autre123!');
    await page.getByRole('button', { name: 'Enregistrer le nouveau mot de passe' }).click();
    await expect(page.getByRole('alert')).toHaveText('Les mots de passe ne correspondent pas');
    await page.getByRole('textbox', { name: 'Confirmer le mot de passe' }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Enregistrer le nouveau mot de passe' }).click();

    // Signed out, the page drops the writer's settings with the rest: it reads as every signed-out page does
    await expect(page.getByRole('status')).toHaveText(
      'Your password has been changed and every device was signed out. Sign in with your new password.',
    );
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeFocused();
    await expect(page.locator('body')).not.toHaveClass(/light-mode/);
    await expectNoAccessibilityViolations(page);
    expect(state.authenticated).toBe(false);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
