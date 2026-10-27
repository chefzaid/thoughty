import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const ENTRY = {
  id: 501,
  date: '2026-10-12',
  index: 1,
  title: 'Autumn light',
  content: 'The maple outside turned red overnight. 🍁 I sat with my tea and watched the leaves come down, one by one.',
  tags: ['autumn'],
  visibility: 'private' as const,
  diaryId: 1,
};

/** The width and height a PNG file declares in its IHDR chunk. */
function pngSize(bytes: Buffer) {
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The preview's top-left pixel, as `#rrggbb`. */
function cornerColor(page: Page) {
  return page.getByTestId('share-image-preview').evaluate((canvas: HTMLCanvasElement) => {
    const [r, g, b] = canvas.getContext('2d')!.getImageData(1, 1, 1, 1).data;
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  });
}

async function openShareDialog(page: Page) {
  const entry = page.locator(`#entry-${ENTRY.id}`);
  await entry.getByLabel('More actions').click();
  await page.getByRole('menuitem', { name: 'Share as image' }).click();
  return page.getByRole('dialog', { name: 'Share as image' });
}

test.describe('Share an entry as an image', () => {
  test('previews the card, switches colors and size, and downloads a high-DPI PNG', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [ENTRY] });
    await page.goto('/journal');

    const dialog = await openShareDialog(page);
    await expect(dialog.getByRole('button', { name: 'Close' }).first()).toBeFocused();
    await expect(dialog.getByRole('note')).toContainText('This entry is private');
    await expect(dialog.getByLabel('Text on the card')).toHaveValue(ENTRY.content);
    await expect(dialog.getByLabel('Show the title')).toBeChecked();

    const preview = dialog.getByRole('img', { name: /Image card preview: “The maple outside turned red overnight\./ });
    await expect(preview).toHaveAttribute('aria-label', /October 12, 2026$/);
    await expect(preview).toHaveAttribute('width', '1080');
    await expect(preview).toHaveAttribute('height', '1080');
    expect(await cornerColor(page)).toBe('#1f2937');

    await dialog.getByText('Violet', { exact: true }).click();
    await expect(dialog.getByRole('radio', { name: 'Violet' })).toBeChecked();
    expect(await cornerColor(page)).toBe('#3b82f6');
    await dialog.getByText('Portrait', { exact: true }).click();
    await expect(preview).toHaveAttribute('height', '1350');

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download PNG' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('thoughty-2026-10-12.png');
    expect(pngSize(await readFile(await download.path()))).toEqual({ width: 1080, height: 1350 });
    await expect(dialog.getByText('Image downloaded.')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(`#entry-${ENTRY.id}`).getByLabel('More actions')).toBeFocused();
  });

  test('starts from the selected excerpt, keeps the keyboard inside, and copies the image', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [ENTRY], config: { theme: 'light' } });
    await page.goto('/journal');

    await page.locator(`#entry-${ENTRY.id}`).getByText(/The maple outside/).evaluate((element) => {
      const text = element.firstChild ?? element;
      const range = document.createRange();
      const start = (text.textContent ?? '').indexOf('I sat');
      range.setStart(text, start);
      range.setEnd(text, start + 'I sat with my tea'.length);
      globalThis.getSelection()!.removeAllRanges();
      globalThis.getSelection()!.addRange(range);
    });

    const dialog = await openShareDialog(page);
    const text = dialog.getByLabel('Text on the card');
    await expect(text).toHaveValue('I sat with my tea');
    expect(await cornerColor(page)).toBe('#ffffff');
    await dialog.getByRole('button', { name: 'Use the whole entry' }).click();
    await expect(text).toHaveValue(ENTRY.content);

    for (let press = 0; press < 14; press += 1) {
      await page.keyboard.press('Tab');
      await expect(dialog.locator(':focus')).toHaveCount(1);
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    await text.fill('');
    await expect(dialog.getByText('Add some text to put on the card.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    await text.fill('Short and sweet');

    await dialog.getByRole('button', { name: 'Copy image' }).click();
    await expect(dialog.getByText('Image copied to the clipboard.')).toBeVisible();
    const copiedType = await page.evaluate(async () => (await navigator.clipboard.read())[0]?.types[0]);
    expect(copiedType).toBe('image/png');
  });

  test('offers the card for your own public entries in the feed, in French', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      config: { language: 'fr' },
      initialEntries: [
        { ...ENTRY, visibility: 'public', userId: 1, authorUsername: 'TestUser' },
        { id: 502, userId: 2, authorUsername: 'OtherWriter', date: '2026-10-11', index: 1, content: 'Someone else wrote this', tags: [], visibility: 'public' },
      ],
    });
    await page.goto('/feed');

    // Another writer's entry in the community feed has no image card button.
    await expect(page.getByText('Someone else wrote this')).toBeVisible();
    const shareButton = page.getByRole('button', { name: /Partager l'entrée du .* en image/ });
    await expect(shareButton).toHaveCount(0);

    await page.getByRole('button', { name: 'Mes entrées publiques' }).click();
    await expect(shareButton).toHaveCount(1);
    await shareButton.click();

    const dialog = page.getByRole('dialog', { name: 'Partager en image' });
    await expect(dialog.getByRole('img', { name: /Aperçu de la carte image/ })).toHaveAttribute('aria-label', /12 octobre 2026$/);
    await expect(dialog.getByRole('note')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Télécharger le PNG' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Fermer' }).first().click();
    await expect(dialog).toHaveCount(0);
  });
});
