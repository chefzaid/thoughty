import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const tooLarge = { name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc((5 * 1024 * 1024) + 1) };
const program = { name: 'setup.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') };
const note = { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('A short note') };

test.describe('Attachment upload errors', () => {
  test('says next to the attach button which files were turned away, without a browser dialog', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    const attach = page.getByTitle('Attach files').first();
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([program, tooLarge]);

    const error = page.getByRole('alert');
    await expect(error).toContainText('setup.exe: This file type is not allowed. Allowed: images, audio, videos (MP4, WebM, MOV), PDF, plain text.');
    await expect(error).toContainText('scan.pdf: File is too large. Maximum size is 5 MB.');
    await expect(attach).toHaveAttribute('aria-describedby', (await error.getAttribute('id')) ?? '');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    // A pick with nothing turned away clears the message and attaches the file
    await fileInput.setInputFiles([note]);
    await expect(error).toHaveCount(0);
    await expect(attach).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('note.txt')).toBeVisible();
    expect(dialogs).toEqual([]);
  });

  for (const theme of ['dark', 'light'] as const) {
    for (const highContrast of [false, true]) {
      test(`passes an accessibility scan with a pending file attached, ${theme}${highContrast ? ' high contrast' : ''}`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, config: { theme, highContrast } });
        await page.goto('/journal');

        await page.locator('input[type="file"]').first().setInputFiles([note]);
        await expect(page.getByText('note.txt')).toBeVisible();
        await expect(page.getByText('Text · 12 B')).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
      });
    }
  }

  test('says which file is too large, in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/journal');

    await page.locator('input[type="file"]').first().setInputFiles([tooLarge]);

    await expect(page.getByRole('alert')).toHaveText('scan.pdf : Le fichier est trop volumineux. Taille maximale : 5 Mo.');
  });
});
