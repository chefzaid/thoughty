import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';
import { mockComposerDraft, seedMockComposerDraft } from '../support/mockApp.routes.composer-draft';

const composer = (page: Page) => page.getByPlaceholder("What's on your mind?");
const walkTemplate = { id: 'custom-1', name: 'Evening walk', content: 'Where I walked:', tags: ['walks'], visibility: 'private', format: 'plain' };
const diaries = [
  mockDiary({ id: 1, name: 'Work', icon: '💼', isDefault: true }),
  mockDiary({ id: 2, name: 'Personal', icon: '🏠' }),
  mockDiary({ id: 3, name: 'Walks', icon: '🥾', defaultTemplateId: 'custom-1' }),
  mockDiary({ id: 4, name: 'Old', icon: '📦', defaultTemplateId: 'custom-deleted' }),
];
const config = { entryTemplates: JSON.stringify([walkTemplate]) };

test.describe('Diary default template', () => {
  test('is chosen in Manage Diaries and starts each new entry of that diary, never over the writer’s words', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries, config });

    await page.goto('/diaries?from=journal&diary=2');
    await page.locator('.diary-card', { hasText: 'Personal' }).getByTitle('Edit').click();
    const editor = page.locator('.diary-card.editing');
    await editor.getByLabel('Default template').selectOption({ label: 'Gratitude journal' });
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.diary-card', { hasText: 'Personal' }).getByText('Template: Gratitude journal')).toBeVisible();
    await expect(page.locator('.diary-card', { hasText: 'Old' }).getByText('Template: Deleted template')).toBeVisible();
    expect(state.diaries.find((diary) => diary.id === 2)).toEqual(expect.objectContaining({ defaultTemplateId: 'builtin-gratitude' }));

    await page.goto('/journal?diary=2');
    await expect(composer(page)).toHaveValue(/^Today I am grateful for:/);
    await expect(page.getByText("Started from this diary's template, Gratitude journal.")).toBeVisible();
    // An untouched template is no draft: nothing is saved for the other devices
    await page.waitForTimeout(2500);
    expect(mockComposerDraft(state)).toBeNull();

    // Untouched, it makes way for the next diary's template, or for none
    await page.getByTitle('Walks', { exact: true }).click();
    await expect(composer(page)).toHaveValue('Where I walked:');
    await page.getByTitle('Work', { exact: true }).click();
    await expect(composer(page)).toHaveValue('');
    await page.getByTitle('Old', { exact: true }).click();
    await expect(composer(page)).toHaveValue('');

    // The writer's own words stay whatever diary is picked
    await page.getByTitle('Walks', { exact: true }).click();
    // `fill` selects the text, then inserts; the template must not arrive in between
    await expect(composer(page)).toHaveValue('Where I walked:');
    await composer(page).fill('Where I walked: along the canal');
    await expect(page.getByText("Started from this diary's template, Evening walk.")).toHaveCount(0);
    await page.getByTitle('Personal', { exact: true }).click();
    await expect(composer(page)).toHaveValue('Where I walked: along the canal');

    // Once saved, the next entry starts from the diary's template again
    await page.getByTitle('Walks', { exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.some((entry) => entry.content === 'Where I walked: along the canal' && entry.diaryId === 3)).toBe(true);
    await expect(composer(page)).toHaveValue('Where I walked:');
  });

  test('lets a draft saved on another device come first', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries, config });
    seedMockComposerDraft(state, { text: 'An old thought', revision: 3 });

    await page.goto('/journal?diary=3');
    const offer = page.getByTestId('composer-draft-offer');
    await expect(offer).toBeVisible();
    await expect(composer(page)).toHaveValue('');

    await offer.getByRole('button', { name: 'Discard' }).click();
    await expect(composer(page)).toHaveValue('Where I walked:');
  });

  test('is offered in French and passes an accessibility scan', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, diaries, config: { ...config, language: 'fr' } });

    await page.goto('/diaries?from=journal&diary=1');
    const field = page.locator('.create-diary-form').getByLabel('Modèle par défaut');
    await expect(field.getByRole('option', { name: 'Aucun modèle' })).toHaveCount(1);
    await expect(field.getByRole('option', { name: 'Evening walk' })).toHaveCount(1);
    await expect(page.locator('.diary-card', { hasText: 'Walks' }).getByText('Modèle : Evening walk')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('.diary-manager')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  });

  test('names and fills the built-in templates in French, by the same ID, and leaves custom ones as saved', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, diaries, config: { ...config, language: 'fr' } });

    await page.goto('/diaries?from=journal&diary=2');
    await page.locator('.diary-card', { hasText: 'Personal' }).getByTitle('Modifier').click();
    const editor = page.locator('.diary-card.editing');
    const field = editor.getByLabel('Modèle par défaut');
    await expect(field.getByRole('option', { name: 'Journal de gratitude' })).toHaveCount(1);
    await expect(field.getByRole('option', { name: 'Gratitude journal' })).toHaveCount(0);
    await field.selectOption({ label: 'Journal de gratitude' });
    await editor.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.diary-card', { hasText: 'Personal' }).getByText('Modèle : Journal de gratitude')).toBeVisible();
    expect(state.diaries.find((diary) => diary.id === 2)).toEqual(expect.objectContaining({ defaultTemplateId: 'builtin-gratitude' }));

    await page.goto('/journal?diary=2');
    const frenchComposer = page.getByPlaceholder("Qu'avez-vous à l'esprit ?");
    await expect(frenchComposer).toHaveValue(/^Aujourd'hui, je dis merci pour :/);
    await expect(page.getByText('Commencé à partir du modèle de ce journal, Journal de gratitude.')).toBeVisible();

    const menu = page.getByRole('combobox', { name: "Modèle d'entrée" });
    await expect(menu.getByRole('option', { name: 'Bilan de la semaine' })).toHaveCount(1);
    await expect(menu.getByRole('option', { name: 'Weekly review' })).toHaveCount(0);
    await menu.selectOption({ label: 'Evening walk' });
    await expect(frenchComposer).toHaveValue('Where I walked:');
    await menu.selectOption({ label: 'Journal de rêves' });
    await expect(frenchComposer).toHaveValue(/^Ce qui s'est passé dans le rêve :/);
  });
});
