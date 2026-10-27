import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_PNG } from '../support/mockApp.routes.attachments';

const pier = { name: 'pier.png', mimeType: 'image/png', buffer: MOCK_PNG };
const picture = { id: 77, original_filename: 'harbour.png', stored_filename: 'stored-harbour', mimetype: 'image/png', size: 68 };

const axe = async (page: Parameters<typeof setupMockApp>[0]) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
};

test.describe('Inline images', () => {
  test('places a picked picture at the caret with its alt text, shows it in the text and opens it', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    const composer = page.locator('form').first();
    await page.getByTitle('Plain text - click to enable Markdown formatting').click();
    const text = composer.getByPlaceholder("What's on your mind?");
    // The Markdown editor loads on demand and takes the place of the plain field
    await expect(composer.getByRole('button', { name: 'Insert one of the attached pictures' })).toBeVisible();
    await text.fill('Morning walk. Back home.');
    // The caret goes before "Back home." by keyboard, then the writer attaches a picture
    await text.press('End');
    for (let step = 0; step < 'Back home.'.length; step++) await text.press('ArrowLeft');
    const chooser = page.waitForEvent('filechooser');
    await page.getByTitle('Attach files').first().click();
    await (await chooser).setFiles([pier]);

    await composer.getByRole('button', { name: 'Insert pier.png in the text' }).click();
    const dialog = page.getByRole('dialog', { name: 'Insert a picture' });
    const alt = dialog.getByRole('textbox', { name: 'Description (alt text)' });
    await expect(alt).toBeFocused();
    expect(await axe(page)).toEqual([]);
    await alt.fill('The old pier at dawn');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(dialog).toBeHidden();
    await expect(text).toHaveValue('Morning walk. ![The old pier at dawn](attachment:pier.png)Back home.');
    await expect(text).toBeFocused();

    await composer.locator('input[placeholder="tags..."]').fill('walks');
    await composer.locator('input[placeholder="tags..."]').press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // The picture was uploaded first, so the saved text names it by ID and the entry holds it
    const open = page.getByRole('button', { name: 'Open the picture The old pier at dawn' });
    await expect(open).toBeVisible();
    const saved = state.entries.find((entry) => entry.content.startsWith('Morning walk.'))!;
    const stored = saved.attachments!.find((attachment) => attachment.original_filename === 'pier.png')!;
    expect(saved.content).toBe(`Morning walk. ![The old pier at dawn](attachment:${stored.id})Back home.`);
    await expect(open.getByRole('img', { name: 'The old pier at dawn' })).toHaveAttribute('src', /^blob:/);
    // Shown in the text, so not again under the entry
    await expect(page.getByRole('img', { name: 'pier.png' })).toHaveCount(0);

    await open.click();
    const preview = page.getByRole('dialog', { name: 'Preview pier.png' });
    await expect(preview).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
    await expect(open).toBeFocused();
    expect(await axe(page)).toEqual([]);
  });

  test('places a stored picture from the toolbar while editing, and keeps a deleted one as a placeholder', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{
        id: 901, date: '2024-05-01', index: 1, format: 'markdown', tags: ['sea'], visibility: 'private', diaryId: 1,
        content: 'Harbour day\n\n![Old boat](attachment:12)', attachments: [picture],
      }],
    });
    await page.goto('/journal');

    const entry = page.locator('#entry-901');
    await expect(entry.getByText('Picture no longer available: Old boat')).toBeVisible();
    await entry.getByRole('button', { name: 'Edit' }).click();
    const text = entry.getByRole('textbox', { name: 'Text of the entry' });
    await text.click();
    await text.press('Control+Home');
    await text.press('End');
    await entry.getByRole('button', { name: 'Insert one of the attached pictures' }).click();

    const dialog = page.getByRole('dialog', { name: 'Insert a picture' });
    await expect(dialog.getByRole('combobox', { name: 'Picture' })).toHaveValue('attachment-77');
    await dialog.getByRole('textbox', { name: 'Description (alt text)' }).fill('Boats in the harbour');
    await dialog.getByRole('textbox', { name: 'Description (alt text)' }).press('Enter');
    await expect(text).toHaveValue('Harbour day![Boats in the harbour](attachment:77)\n\n![Old boat](attachment:12)');
    await entry.getByRole('button', { name: 'Save' }).click();

    await entry.scrollIntoViewIfNeeded();
    await expect(entry.getByRole('button', { name: 'Open the picture Boats in the harbour' })).toBeEnabled();
    // The reference to the deleted picture stays in the saved text, shown as a placeholder
    expect(state.entries.find((item) => item.id === 901)!.content).toContain('![Old boat](attachment:12)');
    await expect(entry.getByText('Picture no longer available: Old boat')).toBeVisible();
  });

  test('offers the picture actions in French', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      initialEntries: [{
        id: 902, date: '2024-05-01', index: 1, format: 'markdown', tags: [], visibility: 'private', diaryId: 1,
        content: '![Le port](attachment:77)', attachments: [picture],
      }],
    });
    await page.goto('/journal');

    // Loaded only once it comes near the screen
    const loading = page.getByRole('button', { name: 'Chargement de l’image Le port' });
    await expect(loading).toBeDisabled();
    await loading.scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Ouvrir l’image Le port' })).toBeEnabled();
    await page.locator('#entry-902').getByRole('button', { name: 'Modifier' }).click();
    await page.locator('#entry-902').getByRole('button', { name: 'Insérer harbour.png dans le texte' }).click();
    const dialog = page.getByRole('dialog', { name: 'Insérer une image' });
    await expect(dialog.getByRole('textbox', { name: 'Description (texte alternatif)' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Insérer' })).toBeVisible();
  });
});
