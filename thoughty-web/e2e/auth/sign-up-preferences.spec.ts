import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_SIGN_UP_TOKEN } from '../support/mockApp.sign-up';

const preferences = (page: Page) => page.getByRole('group', { name: /^(Language and theme|Langue et thème)$/ });

async function expectLook(page: Page, language: 'en' | 'fr', theme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.locator('body')).toHaveClass(new RegExp(`(^|\\s)${theme}-mode(\\s|$)`));
}

async function fillFrenchSignUpForm(page: Page) {
  await page.locator('#username').fill('Camille');
  await page.locator('#email').fill('camille@example.com');
  await page.locator('#password').fill('Ecrire123!');
  await page.locator('#confirmPassword').fill('Ecrire123!');
  await page.getByRole('button', { name: "S'inscrire", exact: true }).click();
}

test.describe('A visitor’s language and theme carried into the account they create', () => {
  test('a visitor reading /fr/ in the light theme signs up, and the account opens in French and light', async ({ page }) => {
    // An English browser on a dark system: only the address and the switch say French and light
    const { state } = await setupMockApp(page);
    await page.goto('/fr/about');
    await preferences(page).getByRole('button', { name: 'Utiliser le thème clair' }).click();
    await expectLook(page, 'fr', 'light');

    await page.getByRole('button', { name: "S'inscrire" }).first().click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByText('Créez votre compte')).toBeVisible();
    await fillFrenchSignUpForm(page);

    await expect(page.getByText('Le lien vous demandera le mot de passe que vous venez de choisir.')).toBeVisible();
    expect(state.signUp.lastRegisterPayload).toMatchObject({ email: 'camille@example.com', language: 'fr', theme: 'light' });
    expect(state.authenticated).toBe(false);

    // The emailed link, opened later: the account it creates starts in the language and theme sent
    await page.goto(`/complete-sign-up?token=${MOCK_SIGN_UP_TOKEN}`);
    await page.getByRole('textbox', { name: /^(Password|Mot de passe)$/ }).fill('Ecrire123!');
    await page.getByRole('button', { name: /^(Create my account|Créer mon compte)$/ }).click();

    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Bienvenue sur Thoughty' })).toBeVisible();
    await expectLook(page, 'fr', 'light');
    expect(state.config).toMatchObject({ language: 'fr', theme: 'light' });
  });

  test.describe('in a French browser on a light system', () => {
    test.use({ locale: 'fr-FR', colorScheme: 'light' });

    test('signs up where the server signs in at once, and lands on the welcome page in French and light', async ({ page }) => {
      const { state } = await setupMockApp(page, { signUp: { instant: true } });
      await page.goto('/register');
      await expectLook(page, 'fr', 'light');

      await fillFrenchSignUpForm(page);

      await expect(page).toHaveURL(/\/welcome$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Bienvenue sur Thoughty' })).toBeVisible();
      await expectLook(page, 'fr', 'light');
      expect(state.signUp.lastRegisterPayload).toMatchObject({ language: 'fr', theme: 'light' });

      // The account keeps them once the visitor's own look no longer applies
      await page.getByRole('button', { name: 'Passer et ouvrir mon journal' }).click();
      await expect(page).toHaveURL(/\/journal/);
      await expectLook(page, 'fr', 'light');
    });
  });

  test('an English visitor signs up into the account defaults, English and dark', async ({ page }) => {
    const { state } = await setupMockApp(page, { signUp: { instant: true } });
    await page.goto('/register');
    await page.locator('#username').fill('NewWriter');
    await page.locator('#email').fill('newwriter@example.com');
    await page.locator('#password').fill('Writer123!');
    await page.locator('#confirmPassword').fill('Writer123!');
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Thoughty' })).toBeVisible();
    await expectLook(page, 'en', 'dark');
    expect(state.signUp.lastRegisterPayload).toMatchObject({ language: 'en', theme: 'dark' });
  });
});
