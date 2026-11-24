import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const ENGLISH_TITLE = 'A private journal that becomes your life story.';
const FRENCH_TITLE = 'Un journal privé qui devient l’histoire de votre vie.';

const preferences = (page: Page) => page.getByRole('group', { name: /^(Language and theme|Langue et thème)$/ });

async function expectLook(page: Page, language: 'en' | 'fr', theme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.locator('body')).toHaveClass(new RegExp(`(^|\\s)${theme}-mode(\\s|$)`));
}

test.describe('A visitor’s language and theme', () => {
  test.describe('in a French browser', () => {
    test.use({ locale: 'fr-FR' });

    test('read in French, the sign-in form included', async ({ page }) => {
      await setupMockApp(page);
      await page.goto('/');

      await expect(page.getByRole('heading', { level: 1, name: FRENCH_TITLE })).toBeVisible();
      await expectLook(page, 'fr', 'dark');
      await expect(preferences(page).getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');

      await page.getByRole('button', { name: 'Se connecter' }).first().click();
      await expect(page.getByText('Bon retour')).toBeVisible();
    });

    test('give way to the writer’s settings once signed in, and come back after signing out', async ({ page }) => {
      await setupMockApp(page, { config: { language: 'en', theme: 'dark' } });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/login');
      await expect(page.getByText('Bon retour')).toBeVisible();
      await expectLook(page, 'fr', 'light');

      await page.locator('#identifier').fill('writer');
      await page.locator('#password').fill('password123');
      await page.getByRole('button', { name: 'Se connecter', exact: true }).click();

      await expect(page).toHaveURL(/\/journal/);
      await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
      await expectLook(page, 'en', 'dark');

      // A public page shows the writer's settings too, with no visitor switch
      await page.goto('/about');
      await expect(page.getByRole('heading', { name: 'A quieter home for the thoughts worth keeping.' })).toBeVisible();
      await expectLook(page, 'en', 'dark');
      await expect(preferences(page)).toHaveCount(0);

      await page.goto('/journal');
      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page.getByRole('heading', { level: 1, name: FRENCH_TITLE })).toBeVisible();
      await expectLook(page, 'fr', 'light');
    });
  });

  test('follow the system theme, light or dark', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: ENGLISH_TITLE })).toBeVisible();
    await expectLook(page, 'en', 'dark');

    await page.emulateMedia({ colorScheme: 'light' });
    await expectLook(page, 'en', 'light');
    await expect(page.locator('.landing-page')).toHaveClass(/\blight\b/);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expectLook(page, 'en', 'dark');
  });

  test('switch on the public pages and stay switched after a reload and on other pages', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: ENGLISH_TITLE })).toBeVisible();

    await preferences(page).getByRole('button', { name: 'Français' }).click();
    await expect(page.getByRole('heading', { level: 1, name: FRENCH_TITLE })).toBeVisible();
    await preferences(page).getByRole('button', { name: 'Utiliser le thème clair' }).click();
    await expectLook(page, 'fr', 'light');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: FRENCH_TITLE })).toBeVisible();
    await expectLook(page, 'fr', 'light');

    // The switch wins over the system too
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/register');
    await expect(page.getByText('Créez votre compte')).toBeVisible();
    await expectLook(page, 'fr', 'light');
    await expect(page.locator('.auth-page')).toHaveClass(/\blight\b/);

    await preferences(page).getByRole('button', { name: 'English' }).click();
    await preferences(page).getByRole('button', { name: 'Use the dark theme' }).click();
    await expect(page.getByText('Create your account')).toBeVisible();
    await expectLook(page, 'en', 'dark');
  });
});
