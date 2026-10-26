import { test, expect, type Page } from '@playwright/test';
import { setupMockApp } from '../support/mockApp';

const savedTemplates = (config: Record<string, unknown>) =>
  JSON.parse(String(config.entryTemplates ?? '[]')) as Array<{ name: string }>;

/** Makes every settings save fail the way the API or the network can, while reading settings still works. */
async function failSettingsSaves(page: Page, failure: 'status' | 'network') {
  await page.route('http://localhost:5173/api/config', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (failure === 'network') {
      await route.abort('connectionrefused');
      return;
    }
    await route.fulfill({ status: 400, json: { statusCode: 400, message: ['theme must be light or dark'], error: 'Bad Request' } });
  });
}

test.describe('Settings that could not be saved', () => {
  test('says so on the profile, puts the previous theme back, and shows no saved message', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { theme: 'dark' } });
    await failSettingsSaves(page, 'status');
    await page.goto('/profile');

    const toggle = page.getByRole('button', { name: 'Toggle theme' });
    await toggle.click();
    await expect(toggle).toHaveClass(/light/);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByRole('alert')).toHaveText('Your settings could not be saved, so the previous ones are back. Try again.');
    await expect(page.locator('body')).toHaveClass(/dark-mode/);
    await expect(toggle).toHaveClass(/dark/);
    await expect(page.getByText('Settings saved successfully')).toHaveCount(0);
    expect(state.config.theme).toBe('dark');
  });

  test('says so in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'dark' } });
    await failSettingsSaves(page, 'network');
    await page.goto('/profile');

    await page.getByRole('button', { name: 'Changer de thème' }).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText("Vos paramètres n'ont pas pu être enregistrés : les précédents sont rétablis. Réessayez.");
    await expect(page.locator('body')).toHaveClass(/dark-mode/);
  });

  test('keeps the template name dialog open when the template could not be saved, then saves on a retry', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await failSettingsSaves(page, 'network');
    await page.goto('/journal');

    const form = page.locator('form').first();
    await form.locator('textarea').fill('Three things that went well:');
    await form.getByRole('button', { name: 'Save template' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save as a template' });
    const name = dialog.getByRole('textbox', { name: 'Template name' });
    await name.fill('Evening wins');
    await page.keyboard.press('Enter');

    await expect(dialog.getByRole('alert')).toHaveText('The template could not be saved. Try again.');
    await expect(name).toHaveValue('Evening wins');
    await expect(name).toBeFocused();
    const templateOption = form.getByRole('combobox', { name: 'Entry template' }).getByRole('option', { name: 'Evening wins' });
    await expect(templateOption).toHaveCount(0);
    expect(savedTemplates(state.config)).toEqual([]);

    await page.unroute('http://localhost:5173/api/config');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(templateOption).toHaveCount(1);
    await expect.poll(() => savedTemplates(state.config)).toEqual([expect.objectContaining({ name: 'Evening wins' })]);
  });
});
