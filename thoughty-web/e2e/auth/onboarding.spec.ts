import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Authentication onboarding', () => {
  // A server without email (outside production) signs in at once; sign-up.spec.ts has the verify-first flow
  test('signs up from the public intro page and lands on the welcome page when the server cannot send email', async ({ page }) => {
    const { state } = await setupMockApp(page, { signUp: { instant: true } });

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign Up' }).first().click();

    await page.locator('#username').fill('NewWriter');
    await page.locator('#email').fill('newwriter@example.com');
    await page.locator('#password').fill('Writer123!');
    await page.locator('#confirmPassword').fill('Writer123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await expect.poll(() => state.signUp.lastRegisterPayload?.username).toBe('NewWriter');
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Thoughty' })).toBeVisible();
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test('logs in with a username and lands on the journal route', async ({ page }) => {
    const { state } = await setupMockApp(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect.poll(() => state.lastLoginPayload?.identifier).toBe('TestUser');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(page).toHaveURL(/\/journal$/);
  });

  test('verifies an email from the public link, which leaves the address at once and stays verified on a reload', async ({ page }) => {
    const { state } = await setupMockApp(page);

    // The requests the page makes while it loads are sent without a referrer by the production
    // NGINX, which the Vite server here does not mirror: securityHeaders.test.js checks that header
    const verifyRequest = page.waitForRequest('**/api/auth/verify-email');
    await page.goto('/verify-email?token=email-token');
    expect((await verifyRequest).headers()['referer'] ?? '').not.toContain('email-token');

    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await expect(page.getByText('Your email is verified.')).toBeVisible();
    await expect(page).toHaveURL(/\/verify-email$/);
    await expect.poll(() => state.lastVerificationToken).toBe('email-token');

    state.lastVerificationToken = null;
    await page.reload();
    await expect(page.getByText('Your email is verified.')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(state.lastVerificationToken).toBeNull();
  });

  test('asks to open a verification link again once a reload has taken its token', async ({ page }) => {
    await setupMockApp(page);

    await page.goto('/verify-email?token=expired-token');
    await expect(page.getByRole('alert')).toHaveText('This verification link is invalid or has expired.');
    await expect(page).toHaveURL(/\/verify-email$/);

    await page.reload();
    await expect(page.getByRole('alert')).toHaveText('This verification link is incomplete. Open the link from your email again.');
  });

  test('resends verification from an unverified local profile', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Resend verification email' }).click();

    await expect(page.getByText('Verification email sent.')).toBeVisible();
    await expect.poll(() => state.verificationResendCount).toBe(1);
  });

  test('restores the session from the cookie alone and deletes tokens an older version stored', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'stale-access');
      localStorage.setItem('refreshToken', 'stale-refresh');
    });
    const refreshBodies: Array<string | null> = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/auth/refresh') refreshBodies.push(request.postData());
    });

    await page.reload();

    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    expect(await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('refreshToken')]))
      .toEqual([null, null]);
    expect(refreshBodies.length).toBeGreaterThan(0);
    expect(refreshBodies.every((body) => !body)).toBe(true);
  });
});
