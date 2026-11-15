import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { passwordResetState } from '../support/mockApp.password-reset';

const SYMBOLS = '! @ # $ % ^ & * ( ) , . ? " : { } | < >';

test.describe('The password rule', () => {
  test('is stated on the sign-up form, which refuses a weak password before sending it', async ({ page }) => {
    const { state } = await setupMockApp(page);
    await page.goto('/register');

    const password = page.locator('#password');
    await expect(password).toHaveAccessibleDescription(
      `At least 8 characters, with an uppercase letter, a lowercase letter, a number and one of these symbols: ${SYMBOLS}`,
    );
    await page.locator('#username').fill('NewWriter');
    await page.locator('#email').fill('newwriter@example.com');
    // A dash or an underscore is not one of the symbols the API counts
    await password.fill('password-123');
    await page.locator('#confirmPassword').fill('password-123');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      `This password is too weak. Use at least 8 characters, with an uppercase letter, a lowercase letter, a number and one of these symbols: ${SYMBOLS}`,
    );
    expect(state.signUp.registerCount).toBe(0);

    await password.fill('Password-123!');
    await page.locator('#confirmPassword').fill('Password-123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await expect(page.getByText('We sent an email to newwriter@example.com.')).toBeVisible();
    expect(state.signUp.lastRegisterPayload).toMatchObject({ password: 'Password-123!' });
  });

  test('is stated in French when changing the password from the profile', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    const change = passwordResetState(state);
    await page.goto('/profile');

    const newPassword = page.getByRole('textbox', { name: 'Nouveau mot de passe', exact: true });
    await expect(newPassword).toHaveAccessibleDescription(
      `Au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et l’un de ces symboles : ${SYMBOLS}`,
    );
    await page.getByRole('textbox', { name: 'Mot de passe actuel' }).fill('Writer123!');
    await newPassword.fill('motdepasse1');
    await page.getByRole('textbox', { name: 'Confirmer le nouveau mot de passe' }).fill('motdepasse1');
    await page.getByRole('button', { name: 'Changer le mot de passe' }).click();

    await expect(page.getByText(
      `Ce mot de passe est trop faible. Utilisez au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et l’un de ces symboles : ${SYMBOLS}`,
    )).toBeVisible();
    expect(change.lastChangePayload).toBeNull();

    await newPassword.fill('MotDePasse1!');
    await page.getByRole('textbox', { name: 'Confirmer le nouveau mot de passe' }).fill('MotDePasse1!');
    await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
    await expect(page.getByText('Mot de passe modifié avec succès')).toBeVisible();
    expect(change.lastChangePayload).toEqual({ currentPassword: 'Writer123!', newPassword: 'MotDePasse1!' });
  });
});
