import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_SIGN_UP_TOKEN } from '../support/mockApp.sign-up';

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

async function fillSignUpForm(page: Page) {
  await page.locator('#username').fill('NewWriter');
  await page.locator('#email').fill('newwriter@example.com');
  await page.locator('#password').fill('Writer123!');
  await page.locator('#confirmPassword').fill('Writer123!');
  await page.getByRole('button', { name: 'Sign Up' }).click();
}

test.describe('Verify-first sign-up', () => {
  test('emails a link instead of signing in, then creates the account from it with the chosen password', async ({ page }) => {
    // Taken in another case: usernames are unique ignoring case
    const { state } = await setupMockApp(page, { signUp: { takenUsernames: ['newwriter'] } });
    await page.clock.install();
    await page.goto('/register');
    await fillSignUpForm(page);

    // The same words for every address: the page cannot tell whether it already has an account
    await expect(page.getByText('We sent an email to newwriter@example.com.')).toBeVisible();
    await expect(page.getByText('The link asks for the password you just chose.')).toBeVisible();
    expect(state.authenticated).toBe(false);
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);

    // Asking again waits for the minute the server spaces emails by
    const resend = page.getByRole('button', { name: /Send the email again in \d+ s/ });
    await expect(resend).toBeDisabled();
    await page.clock.runFor(61_000);
    await page.getByRole('button', { name: 'Send the email again', exact: true }).click();
    await expect(page.getByText('If a new email was due, it is on its way.')).toBeVisible();
    await expect.poll(() => state.signUp.registerCount).toBe(2);
    expect(state.signUp.lastRegisterPayload).toMatchObject({ email: 'newwriter@example.com', username: 'NewWriter', password: 'Writer123!' });

    // The emailed link: its token leaves the address and the history entry at once. (The requests the
    // page makes while it loads are sent without a referrer by the production NGINX, which the Vite
    // server here does not mirror: securityHeaders.test.js checks that header.)
    await page.goto(`/complete-sign-up?token=${MOCK_SIGN_UP_TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Finish creating your account' })).toBeVisible();
    await expect(page).toHaveURL(/\/complete-sign-up$/);
    await expectNoAccessibilityViolations(page);
    await page.getByRole('textbox', { name: 'Password' }).fill('Wrong123!');
    await page.getByRole('button', { name: 'Create my account' }).click();
    await expect(page.getByText('Incorrect password.')).toBeVisible();

    await page.getByRole('textbox', { name: 'Password' }).fill('Writer123!');
    const completeRequest = page.waitForRequest('**/api/auth/register/complete');
    await page.getByRole('button', { name: 'Create my account' }).click();
    expect((await completeRequest).headers()['referer'] ?? '').not.toContain(MOCK_SIGN_UP_TOKEN);
    await expect(page.getByText('That username is already taken. Choose another one to finish.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Username' }).fill('NewWriter2');
    await page.getByRole('button', { name: 'Create my account' }).click();

    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(page).toHaveURL(/\/journal/);
    expect(state.signUp.lastCompletePayload).toEqual({ token: MOCK_SIGN_UP_TOKEN, password: 'Writer123!', username: 'NewWriter2' });
    expect(state.user).toMatchObject({ username: 'NewWriter2', emailVerified: true });
  });

  test('goes back to the form to use another email', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/register');
    await fillSignUpForm(page);

    await page.getByRole('button', { name: 'Use another email' }).click();

    await expect(page.locator('#email')).toHaveValue('newwriter@example.com');
    await expect(page.getByText('Create your account')).toBeVisible();
  });

  test('offers to sign up again when the link was already used or has expired', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/complete-sign-up?token=expired-token');

    await page.getByRole('textbox', { name: 'Password' }).fill('Writer123!');
    await page.getByRole('button', { name: 'Create my account' }).click();

    await expect(page.getByText('This sign-up link is invalid, has expired, or was already used.')).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole('button', { name: 'Sign up again' }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('asks to open the link again once a reload has taken its token', async ({ page }) => {
    await setupMockApp(page);
    await page.goto(`/complete-sign-up?token=${MOCK_SIGN_UP_TOKEN}`);
    await expect(page).toHaveURL(/\/complete-sign-up$/);

    await page.reload();
    await expect(page.getByText('This sign-up link is incomplete. Open the link from your email again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign up again' })).toBeVisible();
  });

  test('explains a link that lost its token', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/complete-sign-up');

    await expect(page.getByText('This sign-up link is incomplete. Open the link from your email again.')).toBeVisible();
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('speaks French on the link page, in the light theme, and fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    // The language and theme come from the profile settings, which only a signed-in visitor has
    // (TODO.md › Needs Input: which language signed-out pages use)
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'light' } });
    state.signUp.lastRegisterPayload = { email: 'nouvelle@example.com', password: 'Ecrire123!', username: 'Nouvelle' };
    await page.goto(`/complete-sign-up?token=${MOCK_SIGN_UP_TOKEN}`);

    await expect(page.getByRole('heading', { name: 'Terminez la création de votre compte' })).toBeVisible();
    await expect(page.getByText('Saisissez le mot de passe choisi lors de votre inscription.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expectNoAccessibilityViolations(page);

    await page.getByRole('textbox', { name: 'Mot de passe' }).fill('Mauvais123!');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText('Mot de passe incorrect.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill('Ecrire123!');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(/\/journal/);
    expect(state.user).toMatchObject({ username: 'Nouvelle', email: 'nouvelle@example.com', emailVerified: true });
  });
});
