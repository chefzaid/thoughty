import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Journal Markdown authoring', () => {
  test('creates a backdated Markdown entry with tags', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/journal');

    const entryForm = page.locator('form').first();
    await page.getByTitle('Plain text - click to enable Markdown formatting').click();
    await page.getByPlaceholder("What's on your mind?").fill('## Markdown memory\n\nA **bold** backdated note.');
    await entryForm.locator('.react-datepicker__input-container input').fill('2024-02-20');
    await entryForm.locator('.react-datepicker__input-container input').press('Tab');
    await entryForm.locator('input[placeholder="tags..."]').fill('markdown');
    await entryForm.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Markdown memory' })).toBeVisible();
    await expect(page.locator('[id^="entry-"]').first().getByText('#markdown')).toBeVisible();
    expect(state.entries[0]).toMatchObject({
      date: '2024-02-20',
      content: '## Markdown memory\n\nA **bold** backdated note.',
      tags: ['markdown'],
      visibility: 'private',
      format: 'markdown',
    });
  });

  test('names every toolbar button in French, in the composer and the entry editor', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      initialEntries: [{ id: 801, date: '2024-02-20', index: 1, content: '## Notes', format: 'markdown', tags: [], visibility: 'private', diaryId: 1 }],
    });
    await page.goto('/journal');

    const composer = page.locator('form').first();
    await page.getByTitle('Texte brut - cliquez pour activer le formatage Markdown').click();
    const toolbar = composer.locator('.w-md-editor-toolbar').first();
    await expect(toolbar.getByRole('button', { name: 'Mettre en gras (ctrl + b)' })).toBeVisible();
    for (const name of [
      'Mettre en italique (ctrl + i)',
      'Barrer le texte (ctrl + maj + x)',
      'Insérer un trait horizontal (ctrl + h)',
      'Ajouter un lien (ctrl + l)',
      'Insérer une citation (ctrl + q)',
      'Insérer du code (ctrl + j)',
      'Insérer un bloc de code (ctrl + maj + j)',
      'Insérer un commentaire (ctrl + /)',
      'Ajouter une image (ctrl + k)',
      'Ajouter un tableau',
      'Ajouter une liste à puces (ctrl + maj + u)',
      'Ajouter une liste numérotée (ctrl + maj + o)',
      'Ajouter une liste de tâches (ctrl + maj + c)',
      'Ouvrir le guide Markdown',
      'Écrire sans l’aperçu (ctrl + 7)',
      'Écrire à côté de l’aperçu (ctrl + 8)',
      'Afficher seulement l’aperçu (ctrl + 9)',
      'Basculer en plein écran (ctrl + 0)',
    ]) {
      await expect(composer.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await composer.getByRole('button', { name: 'Insérer un titre', exact: true }).click();
    const heading = composer.getByRole('button', { name: 'Insérer un titre de niveau 2 (ctrl + 2)' });
    await expect(heading).toHaveText('Titre 2');
    await heading.click();
    await expect(composer.getByPlaceholder("Qu'avez-vous à l'esprit ?")).toHaveValue('## ');

    // No button keeps the editor's English name
    const names = await page.locator('.w-md-editor-toolbar button').evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent ?? ''));
    expect(names.filter((name) => /\b(Add|Insert|Open|Toggle|Edit|Live|Preview|Heading)\b/.test(name))).toEqual([]);

    await page.locator('#entry-801').getByRole('button', { name: 'Modifier' }).click();
    await expect(page.locator('#entry-801').getByRole('button', { name: 'Mettre en gras (ctrl + b)' })).toBeVisible();
    await expect(page.locator('#entry-801').getByRole('textbox', { name: 'Texte de l’entrée' })).toHaveValue('## Notes');
  });
});
