import AxeBuilder from '../support/axe';
import { test, expect, type Locator } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const tooLarge = { name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc((5 * 1024 * 1024) + 1) };
const program = { name: 'setup.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') };
const note = { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('A short note') };

/** WCAG contrast of an element's text on its own opaque fill. */
async function ownContrast(element: Locator) {
  return element.evaluate((node) => {
    const luminance = (color: string) => {
      const [red, green, blue] = (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const style = getComputedStyle(node);
    const [light, dark] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
    return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
  });
}

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
      test(`passes an accessibility scan with a pending file attached and its remove badge shown, ${theme}${highContrast ? ' high contrast' : ''}`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, config: { theme, highContrast } });
        await page.goto('/journal');

        await page.locator('input[type="file"]').first().setInputFiles([note]);
        await expect(page.getByText('note.txt')).toBeVisible();
        await expect(page.getByText('Text · 12 B')).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

        // The remove badge shows while the card is hovered. axe leaves its one-character "×" unchecked
        // ("too short to determine if it is actual text"), so its contrast is measured here.
        const remove = page.getByRole('button', { name: 'Remove attachment note.txt' });
        await remove.hover();
        await expect(remove).toHaveCSS('opacity', '1');
        expect(await ownContrast(remove)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  test('reaches the remove badge with Tab, shows it while focused, and removes the file with Enter', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await page.locator('input[type="file"]').first().setInputFiles([note]);
    const remove = page.getByRole('button', { name: 'Remove attachment note.txt' });
    await expect(remove).toHaveCSS('opacity', '0');

    await page.getByTitle('Attach files').first().focus();
    for (let presses = 0; presses < 10 && !(await remove.evaluate((node) => node === document.activeElement)); presses += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(remove).toBeFocused();
    await expect(remove).toHaveCSS('opacity', '1');
    await expect(remove).toHaveCSS('outline-style', 'solid');

    await page.keyboard.press('Enter');
    await expect(page.getByText('note.txt')).toHaveCount(0);
    await expect(remove).toHaveCount(0);
  });

  test.describe('on a touch screen', () => {
    test.use({ hasTouch: true, isMobile: true });

    test('always shows the remove badge, since nothing can hover it', async ({ page }) => {
      await setupMockApp(page, { startAuthenticated: true });
      await page.goto('/journal');
      expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
      await page.locator('input[type="file"]').first().setInputFiles([note]);

      const remove = page.getByRole('button', { name: 'Remove attachment note.txt' });
      await expect(remove).toHaveCSS('opacity', '1');
      await remove.tap();
      await expect(page.getByText('note.txt')).toHaveCount(0);
    });
  });

  test('says which file is too large, in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/journal');

    await page.locator('input[type="file"]').first().setInputFiles([tooLarge]);

    await expect(page.getByRole('alert')).toHaveText('scan.pdf : Le fichier est trop volumineux. Taille maximale : 5 Mo.');
  });
});
