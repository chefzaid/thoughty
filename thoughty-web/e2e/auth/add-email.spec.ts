import AxeBuilder from '../support/axe';
import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_ADD_EMAIL_TOKEN } from '../support/mockApp.account-email';

const PLACEHOLDER = 'user-1@invalid';

test.describe('An account without an email address', () => {
  test('is asked for one at sign-in, confirms it from the emailed link, then opens the journal', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      user: { email: PLACEHOLDER, emailMissing: true },
      config: { theme: 'light' },
    });

    await page.goto('/journal');
    await expect(page.getByRole('heading', { name: 'Add your email address' })).toBeVisible();
    await expect(page.getByText(PLACEHOLDER)).toHaveCount(0);
    await expect(page.getByPlaceholder("What's on your mind?")).toHaveCount(0);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    const address = page.getByRole('textbox', { name: 'Email' });
    await address.fill('ada@mail.invalid');
    await page.getByRole('button', { name: 'Send the confirmation link' }).click();
    await expect(page.getByRole('alert')).toHaveText('No email can reach this address. Enter an address you can read.');

    await address.fill('Ada@Example.com');
    await page.getByRole('button', { name: 'Send the confirmation link' }).click();
    await expect(page.getByText('We sent a link to ada@example.com.')).toBeVisible();
    expect(state.user.pendingEmail).toBe('ada@example.com');

    // Not opened yet: the page says so
    await page.getByRole('button', { name: 'I opened the link' }).click();
    await expect(page.getByRole('status')).toHaveText('This address is not confirmed yet. Open the link in the email we sent.');

    await page.goto(`/verify-email?token=${MOCK_ADD_EMAIL_TOKEN}`);
    await expect(page.getByText('Your email is verified.')).toBeVisible();
    await page.getByRole('button', { name: 'Continue to Thoughty' }).click();

    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add your email address' })).toHaveCount(0);
    expect(state.user).toMatchObject({ email: 'ada@example.com', emailMissing: false, emailVerified: true });
  });

  test('is asked in French too, and can sign out instead', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      user: { email: PLACEHOLDER, emailMissing: true },
      config: { language: 'fr' },
    });

    await page.goto('/journal');
    await expect(page.getByRole('heading', { name: 'Ajoutez votre adresse e-mail' })).toBeVisible();
    await page.getByRole('button', { name: 'Déconnexion' }).click();

    await expect.poll(() => state.authenticated).toBe(false);
  });
});
