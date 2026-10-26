import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const savedTemplates = (config: Record<string, unknown>) =>
  JSON.parse(String(config.entryTemplates ?? '[]')) as Array<{ name: string; content: string }>;

test.describe('Entry templates', () => {
  test('saves the draft under a typed name, refuses an empty name, and cancels', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    const entryCount = state.entries.length;

    const form = page.locator('form').first();
    await form.locator('textarea').fill('Three things that went well:');
    const saveTemplate = form.getByRole('button', { name: 'Save template' });

    await saveTemplate.click();
    const dialog = page.getByRole('dialog', { name: 'Save as a template' });
    const name = dialog.getByRole('textbox', { name: 'Template name' });
    await expect(name).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(saveTemplate).toBeFocused();

    await saveTemplate.click();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(savedTemplates(state.config)).toEqual([]);

    await saveTemplate.click();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('alert')).toHaveText('Enter a name for the template.');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toBeFocused();
    expect(savedTemplates(state.config)).toEqual([]);

    await name.fill('Evening wins');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => savedTemplates(state.config)).toEqual([
      expect.objectContaining({ name: 'Evening wins', content: 'Three things that went well:' }),
    ]);
    await expect(form.getByRole('combobox', { name: 'Entry template' }).getByRole('option', { name: 'Evening wins' })).toHaveCount(1);
    await expect(form.locator('textarea')).toHaveValue('Three things that went well:');
    expect(state.entries).toHaveLength(entryCount);
  });

  test('asks for the name in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/journal');

    const form = page.locator('form').first();
    await form.locator('textarea').fill('Brouillon');
    await form.getByRole('button', { name: 'Enregistrer le modèle' }).click();

    const dialog = page.getByRole('dialog', { name: 'Enregistrer comme modèle' });
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Saisissez un nom pour le modèle.');
    await expect(dialog.getByRole('textbox', { name: 'Nom du modèle' })).toBeFocused();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`passes an accessibility scan with the name error in the ${theme} theme`, async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true, config: { theme } });
      await page.goto('/journal');
      const form = page.locator('form').first();
      await form.locator('textarea').fill('Draft');
      await form.getByRole('button', { name: 'Save template' }).click();
      const dialog = page.getByRole('dialog', { name: 'Save as a template' });
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog.getByRole('alert')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('[role="dialog"]')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }
});
