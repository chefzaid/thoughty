import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockAccessTokens } from '../support/mockApp.routes.access-tokens';

/** Scans the access tokens section. */
async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('.access-tokens')
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Access tokens', () => {
  test('makes a token shown once to copy, lists it, revokes it, and records both in the account activity', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/profile');

    const section = page.getByRole('region', { name: 'Access tokens' });
    await expect(section.getByText('You have no access tokens.')).toBeVisible();
    await expect(section).toContainText(`${new URL(page.url()).origin}/api/v1`);
    await section.getByRole('textbox', { name: 'Name' }).fill('iPhone Shortcut');
    await section.getByRole('checkbox', { name: 'Read entries' }).check();
    await section.getByRole('combobox', { name: 'Expires' }).selectOption({ label: 'In a year' });
    await section.getByRole('button', { name: 'Create token' }).click();

    const secret = section.getByRole('textbox', { name: 'Your new access token' });
    const [made] = mockAccessTokens(state);
    await expect(secret).toHaveValue(made!.token);
    expect(made).toMatchObject({ name: 'iPhone Shortcut', scopes: ['entries:read', 'entries:write'], timeZone: expect.any(String) });
    await expectNoAccessibilityViolations(page);
    await section.getByRole('button', { name: 'Copy' }).click();
    await expect(section.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(made!.token);
    await section.getByRole('button', { name: 'Done' }).click();
    await expect(secret).toHaveCount(0);

    const list = section.getByRole('list', { name: 'Access tokens' });
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(list).toContainText(`iPhone Shortcut ${made!.hint}…`);
    await expect(list).toContainText('Read entries · Write new entries');
    await expect(list).toContainText('Never used');

    // Reloaded, the list holds the token but never its secret
    await page.reload();
    await expect(list).toContainText('iPhone Shortcut');
    await expect(page.getByText(made!.token)).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Account activity' }).getByRole('row').nth(1)).toContainText('Access token created');

    await list.getByRole('button', { name: 'Revoke iPhone Shortcut' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Revoke this token?' });
    await expect(dialog).toContainText('“iPhone Shortcut” stops working at once.');
    await dialog.getByRole('button', { name: 'Revoke' }).click();
    await expect(section.getByText('You have no access tokens.')).toBeVisible();
    expect(mockAccessTokens(state)).toEqual([]);
    await page.reload();
    await expect(page.getByRole('table', { name: 'Account activity' }).getByRole('row').nth(1)).toContainText('Access token revoked');
  });

  test('asks for a scope, and stops at the limit, in French and the dark theme', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'dark' } });
    await page.goto('/profile');

    const section = page.getByRole('region', { name: 'Jetons d’accès' });
    await section.getByRole('textbox', { name: 'Nom' }).fill('Zapier');
    await section.getByRole('checkbox', { name: 'Écrire de nouvelles entrées' }).uncheck();
    await section.getByRole('button', { name: 'Créer le jeton' }).click();
    await expect(section.getByRole('alert')).toHaveText('Choisissez au moins une chose que le jeton peut faire.');
    expect(mockAccessTokens(state)).toEqual([]);

    for (let made = 1; made <= 10; made += 1) {
      await section.getByRole('textbox', { name: 'Nom' }).fill(`Script ${made}`);
      await section.getByRole('checkbox', { name: 'Lire les entrées' }).check();
      await section.getByRole('button', { name: 'Créer le jeton' }).click();
      await expect(section.getByText(`${made} sur 10`)).toBeVisible();
    }
    await expect(section.getByText('Vous détenez 10 jetons, le maximum. Révoquez-en un pour en créer un autre.')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Créer le jeton' })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });
});
