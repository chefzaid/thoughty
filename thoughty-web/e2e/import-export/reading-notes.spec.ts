import AxeBuilder from '../support/axe';
import { expect, test } from '../support/test';
import { buildZip } from '../../src/test/zipFixture';
import { buildMockBookPdf } from '../support/mockBookPdf';
import { setupMockApp } from '../support/mockApp';

const WALDEN = 'I went to the woods because I wished to live deliberately, to front only the essential facts of life.';

/** A small EPUB 3: a cover without text, then two chapters, the second one's file in another folder. */
async function epubBook(): Promise<Buffer> {
  const xhtml = (body: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;
  return Buffer.from(await buildZip([
    { name: 'mimetype', data: 'application/epub+zip', store: true },
    {
      name: 'META-INF/container.xml',
      data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    },
    {
      name: 'OEBPS/content.opf',
      data: `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>The Little Prince</dc:title><dc:creator>Antoine de Saint-Exupéry</dc:creator></metadata>
        <manifest><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="Text/one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="Text/two.xhtml" media-type="application/xhtml+xml"/></manifest>
        <spine><itemref idref="cover"/><itemref idref="c1"/><itemref idref="c2"/></spine></package>`,
    },
    { name: 'OEBPS/cover.xhtml', data: xhtml('<img src="cover.jpg" alt=""/>') },
    { name: 'OEBPS/Text/one.xhtml', data: xhtml('<h1>The Drawing</h1><p>Once when I was six years old I saw a magnificent picture.</p>') },
    { name: 'OEBPS/Text/two.xhtml', data: xhtml('<h1>The Fox</h1><p>What is essential is invisible to the eye.</p><script>document.title = "ran"</script>') },
  ]));
}

test.describe('Reading notes', () => {
  test('reads a PDF on the device, keeps notes on a selected passage until they are saved as private entries', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.clock.setFixedTime(new Date('2026-11-20T21:15:00'));
    await page.goto('/import-export?diary=2&section=import');
    const panel = page.getByRole('region', { name: 'Reading notes' });
    await expect(panel.getByText('each note you save becomes a private entry in Personal')).toBeVisible();
    const pdf = buildMockBookPdf({ title: 'Walden', author: 'Henry David Thoreau', includeToc: false, chapters: [{ title: 'Where I Lived', paragraphs: [WALDEN] }] });
    const file = { name: 'walden.pdf', mimeType: 'application/pdf', buffer: pdf };

    await panel.getByLabel('Open a book (PDF or EPUB)').setInputFiles(file);
    const dialog = page.getByRole('dialog', { name: 'walden' });
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await expect(dialog.getByRole('region', { name: 'Page 1' })).toContainText('Walden');
    await dialog.getByRole('button', { name: 'Next page' }).click();
    const text = dialog.getByRole('region', { name: 'Page 2' });
    await expect(text).toContainText('I went to the woods');

    // The reader selects a sentence of the page
    await text.locator('p').evaluate((paragraph) => {
      const node = paragraph.firstChild!;
      const value = node.textContent ?? '';
      const range = document.createRange();
      range.setStart(node, value.indexOf('I went'));
      range.setEnd(node, value.indexOf('deliberately') + 'deliberately'.length);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
    });
    await dialog.getByRole('button', { name: 'Add a note on the selected passage' }).click();
    const form = dialog.getByRole('form', { name: 'New note' });
    await expect(form.getByLabel('Passage (optional)')).toHaveValue('I went to the woods because I wished to live deliberately');
    await form.getByLabel('Your note').fill('The reason for this journal, too.');
    await form.getByRole('button', { name: 'Keep the note' }).click();
    await expect(dialog.getByRole('heading', { name: '1 note' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    // Closed without saving, the note waits on this device and comes back with the same file
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(panel.getByRole('list', { name: 'Notes not saved to your journal yet' })).toContainText('walden · 1 note');
    await panel.getByLabel('Open a book (PDF or EPUB)').setInputFiles(file);
    await expect(dialog.getByText('The reason for this journal, too.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Save the notes to Personal' }).click();
    await expect(dialog.getByText('1 note saved to Personal.')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '0 notes' })).toBeVisible();
    const payload = state.appImport.entryPayloads[0] as { source: string; diaryId: number; entries: Array<{ sourceId: string }> };
    expect(payload).toEqual(expect.objectContaining({ source: 'reading-notes', diaryId: 2 }));
    expect(payload.entries[0]!.sourceId).toMatch(/^[0-9a-f]{16}\/[0-9a-f-]{36}$/);
    const saved = state.entries.find((entry) => entry.title === 'walden')!;
    expect(saved).toEqual(expect.objectContaining({ date: '2026-11-20', time_of_day: '21:15', visibility: 'private', diaryId: 2 }));
    expect(saved.content).toBe('> I went to the woods because I wished to live deliberately\n\nThe reason for this journal, too.\n\n— *walden*, page 2');

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(panel.getByRole('list', { name: 'Notes not saved to your journal yet' })).toBeHidden();
  });

  test('reads an EPUB chapter by chapter as text only, in French, and saves a note on a chapter', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/import-export?diary=2&section=import');
    const panel = page.getByRole('region', { name: 'Notes de lecture' });

    await panel.getByLabel('Ouvrir un livre (PDF ou EPUB)').setInputFiles({ name: 'prince.epub', mimeType: 'application/epub+zip', buffer: await epubBook() });
    const dialog = page.getByRole('dialog', { name: 'The Little Prince' });
    await expect(dialog.getByText('Antoine de Saint-Exupéry')).toBeVisible();
    await expect(dialog.getByLabel('Aller à').locator('option')).toHaveText(['The Drawing', 'The Fox']);
    await dialog.getByRole('button', { name: 'Chapitre suivant' }).click();
    await expect(dialog.getByRole('region', { name: 'The Fox' })).toContainText('What is essential is invisible to the eye.');
    // The chapter's script is text the reader never runs
    expect(await page.title()).not.toBe('ran');

    await dialog.getByRole('button', { name: 'Ajouter une note', exact: true }).click();
    await dialog.getByLabel('Votre note').fill('Le renard a raison.');
    await dialog.getByRole('button', { name: 'Garder la note' }).click();
    await dialog.getByRole('button', { name: 'Enregistrer les notes dans Personal' }).click();
    await expect(dialog.getByText('1 note enregistrée dans Personal.')).toBeVisible();

    const saved = state.entries.find((entry) => entry.title === 'The Little Prince')!;
    expect(saved.content).toBe('Le renard a raison.\n\n— *The Little Prince*, Antoine de Saint-Exupéry, The Fox');
  });

  test('says when a file is not a book it can read', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/import-export?diary=2&section=import');
    const panel = page.getByRole('region', { name: 'Reading notes' });

    await panel.getByLabel('Open a book (PDF or EPUB)').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('just text') });
    await expect(panel.getByRole('alert')).toHaveText('This file is not a PDF or EPUB book.');
  });
});
